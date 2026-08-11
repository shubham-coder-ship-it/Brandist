import { z } from "zod";
import { getAdmin } from "./supabase-admin.server";
import { callAIStructured, firecrawlScrape, firecrawlMap } from "./ai.server";
import { detectFontsFromSite, substituteFor, type DetectedFont } from "./fonts.server";
import { extractColorsFromText, type ColorObservation } from "./css-colors.server";
import { probeLogos } from "./logo-probe.server";

// Normalize an asset URL so trivial differences (cache-busting query strings,
// fragment, trailing slash, host case, default port) collapse to the same key.
// Also collapses the file basename so `/images/logo.svg` and `/cdn/logo.svg`
// dedupe within the same `kind`.
function assetDedupKey(kind: string, url: string): string {
    let key = url;
    try {
        const u = new URL(url);
        u.hash = "";
        u.search = "";
        u.hostname = u.hostname.toLowerCase();
        if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
            u.port = "";
        }
        if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
            u.pathname = u.pathname.replace(/\/+$/, "");
        }
        key = u.toString();
    } catch {
        /* keep original */
    }
    // Same-basename + same-kind dedup (e.g. /a/logo.svg vs /b/logo.svg).
    const basename = key.split("?")[0].split("#")[0].split("/").pop()?.toLowerCase() ?? "";
    return `${kind}::${key}::${basename}`;
}

function dedupAssetsByKey<T extends { kind: string; url: string }>(items: T[]): T[] {
    const seenFull = new Set<string>();
    const seenBasename = new Set<string>();
    const out: T[] = [];
    for (const a of items) {
        const full = assetDedupKey(a.kind, a.url);
        const basename = full.split("::")[2];
        const basenameKey = `${a.kind}::${basename}`;
        if (seenFull.has(full)) continue;
        // Allow asset-less basenames (e.g. dynamic endpoints) to pass through.
        if (basename && seenBasename.has(basenameKey)) continue;
        seenFull.add(full);
        if (basename) seenBasename.add(basenameKey);
        out.push(a);
    }
    return out;
}

// Scan raw HTML for additional logo-ish images (logomarks, alternate logos, SVGs).
// Returns absolute URLs classified as logo / logo-mark / wordmark.
function harvestLogosFromHtml(html: string, baseUrl: string): Array<{ kind: string; url: string }> {
    const out: Array<{ kind: string; url: string }> = [];
    const seen = new Set<string>();
    const base = (() => {
        try {
            return new URL(baseUrl);
        } catch {
            return null;
        }
    })();
    const absolutize = (u: string): string | null => {
        if (!u) return null;
        if (u.startsWith("data:")) return null;
        try {
            return new URL(u, base ?? undefined).toString();
        } catch {
            return null;
        }
    };

    // <img ...> tags — match those whose attributes hint at logo/mark/wordmark
    const imgRe = /<img\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(html))) {
        const tag = m[0];
        const src =
            tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ??
            tag.match(/\bsrcset\s*=\s*["']([^"']+)["']/i)?.[1]?.split(/\s+/)[0] ??
            tag.match(/\bdata-src\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!src) continue;
        const hay = tag.toLowerCase();
        const isLogo = /\blogo\b|\bwordmark\b|\bbrand[-_ ]?mark\b|\bsymbol\b/.test(hay);
        if (!isLogo) continue;
        const abs = absolutize(src);
        if (!abs || seen.has(abs)) continue;
        seen.add(abs);
        const kind = /wordmark/.test(hay)
            ? "wordmark"
            : /mark|symbol|icon/.test(hay)
                ? "logo-mark"
                : "logo";
        out.push({ kind, url: abs });
        if (out.length >= 6) break;
    }

    // <link rel="...icon..." href="..."> for apple-touch-icon, mask-icon, etc.
    const linkRe = /<link\b[^>]*>/gi;
    while ((m = linkRe.exec(html))) {
        const tag = m[0];
        const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
        const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!href) continue;
        if (!/apple-touch-icon|mask-icon|fluid-icon|alternate icon/.test(rel)) continue;
        const abs = absolutize(href);
        if (!abs || seen.has(abs)) continue;
        seen.add(abs);
        out.push({ kind: "logo-mark", url: abs });
    }
    return out;
}

// Schema for AI-extracted brand kit
const ExtractionSchema = {
    type: "object",
    properties: {
        name: { type: "string", description: "Brand name" },
        summary: { type: "string", description: "One-paragraph brand summary" },
        colors: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    hex: { type: "string", description: "Hex color like #1a2b3c" },
                    role: {
                        type: "string",
                        enum: [
                            "primary",
                            "secondary",
                            "accent",
                            "accent-2",
                            "cta",
                            "background",
                            "surface",
                            "text",
                            "muted",
                            "success",
                            "warning",
                            "error",
                            "chart-1",
                            "chart-2",
                            "gradient-start",
                            "gradient-end",
                            "border",
                            "overlay",
                        ],
                    },
                    name: { type: "string" },
                },
                required: ["hex", "role", "name"],
            },
        },
        fonts: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    family: { type: "string" },
                    role: { type: "string", enum: ["heading", "body", "mono", "display"] },
                    weights: { type: "array", items: { type: "string" } },
                    google_font: { type: "boolean" },
                },
                required: ["family", "role"],
            },
        },
        tokens: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        enum: ["spacing", "radius", "shadow", "animation"],
                    },
                    name: { type: "string" },
                    value: { type: "string" },
                },
                required: ["category", "name", "value"],
            },
        },
        voice: {
            type: "object",
            properties: {
                tone: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            label: { type: "string" },
                            confidence: { type: "number" },
                        },
                        required: ["label"],
                    },
                },
                vocabulary: { type: "array", items: { type: "string" } },
                dos: { type: "array", items: { type: "string" } },
                donts: { type: "array", items: { type: "string" } },
                samples: {
                    type: "object",
                    properties: {
                        headline: { type: "string" },
                        cta: { type: "string" },
                        slide_title: { type: "string" },
                        email_intro: { type: "string" },
                    },
                },
            },
        },
        assets: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    kind: {
                        type: "string",
                        enum: ["logo", "logo-mark", "logo-light", "logo-dark", "favicon", "og-image"],
                    },
                    url: { type: "string" },
                },
                required: ["kind", "url"],
            },
        },
        typography_scale: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    role: { type: "string", enum: ["h1", "h2", "h3", "body", "caption", "label"] },
                    font_family: { type: "string" },
                    font_size_px: { type: ["number", "null"] },
                    line_height: { type: ["number", "null"] },
                    letter_spacing: { type: ["string", "null"] },
                    font_weight: { type: ["number", "null"] },
                    sample_text: { type: ["string", "null"] },
                },
                required: ["role", "font_family"],
            },
        },
        imagery_style: {
            type: "object",
            properties: {
                photography_style: { type: ["string", "null"] },
                illustration_style: { type: ["string", "null"] },
                iconography_style: { type: ["string", "null"] },
                mood_keywords: { type: "array", items: { type: "string" } },
            },
        },
        motion_style: {
            type: "object",
            properties: {
                overall_tempo: { type: "string", enum: ["fast", "medium", "slow", "none"] },
                easing_description: { type: ["string", "null"] },
                transition_notes: { type: ["string", "null"] },
            },
            required: ["overall_tempo"],
        },
        brand_positioning: {
            type: "object",
            properties: {
                tagline: { type: ["string", "null"] },
                mission: { type: ["string", "null"] },
                audience_description: { type: ["string", "null"] },
                industry_vertical: { type: ["string", "null"] },
                value_props: { type: "array", items: { type: "string" } },
            },
        },
    },
    required: ["name", "colors", "fonts", "tokens", "voice", "assets"],
};

type Extraction = {
    name: string;
    summary?: string;
    colors: Array<{ hex: string; role: string; name: string }>;
    fonts: Array<{ family: string; role: string; weights?: string[]; google_font?: boolean }>;
    tokens: Array<{ category: string; name: string; value: string }>;
    voice: {
        tone?: Array<{ label: string; confidence?: number }>;
        vocabulary?: string[];
        dos?: string[];
        donts?: string[];
        samples?: { headline?: string; cta?: string; slide_title?: string; email_intro?: string };
    };
    assets: Array<{ kind: string; url: string }>;
    typography_scale?: Array<{
        role: "h1" | "h2" | "h3" | "body" | "caption" | "label";
        font_family: string;
        font_size_px?: number | null;
        line_height?: number | null;
        letter_spacing?: string | null;
        font_weight?: number | null;
        sample_text?: string | null;
    }>;
    imagery_style?: {
        photography_style?: string | null;
        illustration_style?: string | null;
        iconography_style?: string | null;
        mood_keywords?: string[];
    };
    motion_style?: {
        overall_tempo: "fast" | "medium" | "slow" | "none";
        easing_description?: string | null;
        transition_notes?: string | null;
    };
    brand_positioning?: {
        tagline?: string | null;
        mission?: string | null;
        audience_description?: string | null;
        industry_vertical?: string | null;
        value_props?: string[];
    };
};

function fallbackExtraction(input: {
    url?: string;
    manual?: { brandName?: string; hexColors?: string[]; fontFamilies?: string[] };
    cssColors?: ColorObservation[];
    detectedFonts?: DetectedFont[];
}): Extraction {
    const host = input.url ? new URL(input.url).hostname.replace(/^www\./, "") : "brand";
    const baseName = input.manual?.brandName || host.split(".")[0] || "Brand";
    const name = baseName.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const observed = [
        ...(input.manual?.hexColors ?? []),
        ...(input.cssColors ?? []).map((c) => c.hex),
    ]
        .filter(Boolean)
        .map((hex) => (hex.startsWith("#") ? hex : `#${hex}`))
        .filter((hex, i, arr) => /^#[0-9a-f]{6}$/i.test(hex) && arr.indexOf(hex) === i)
        .slice(0, 6);
    const palette = observed.length >= 3 ? observed : ["#0A0A0A", "#F4EFE6", "#8B1A1A", "#5F5A52", "#D8D0C3"];
    const families = [
        ...(input.manual?.fontFamilies ?? []),
        ...(input.detectedFonts ?? []).map((f) => substituteFor(f.source_family) ?? f.source_family),
    ].filter(Boolean);
    const heading = families[0] ?? "Libre Baskerville";
    const body = families[1] ?? heading;
    return {
        name,
        summary: `${name} brand kit extracted from ${host}.`,
        colors: palette.map((hex, i) => ({
            hex,
            role: ["primary", "background", "accent", "text", "muted", "secondary"][i] ?? "secondary",
            name: ["Primary", "Background", "Accent", "Text", "Muted", "Secondary"][i] ?? `Color ${i + 1}`,
        })),
        fonts: [
            { family: heading, role: "heading", weights: ["400", "700"], google_font: false },
            { family: body, role: "body", weights: ["400"], google_font: false },
        ],
        tokens: [
            { category: "spacing", name: "base", value: "8px" },
            { category: "radius", name: "default", value: "8px" },
            { category: "shadow", name: "soft", value: "0 16px 40px rgba(0,0,0,0.10)" },
            { category: "animation", name: "standard", value: "200ms ease" },
        ],
        voice: {
            tone: [{ label: "clear", confidence: 0.6 }, { label: "direct", confidence: 0.55 }],
            vocabulary: [name, host, "brand", "system"],
            dos: ["Keep language direct", "Use concise calls to action"],
            donts: ["Avoid vague claims", "Do not overstate unsupported details"],
            samples: {
                headline: `${name}, clearly defined`,
                cta: "Explore the system",
                slide_title: `${name} identity`,
                email_intro: `A concise look at ${name}.`,
            },
        },
        assets: [],
        typography_scale: [
            { role: "h1", font_family: heading, font_size_px: null, line_height: null, letter_spacing: null, font_weight: 700, sample_text: name },
            { role: "h2", font_family: heading, font_size_px: null, line_height: null, letter_spacing: null, font_weight: 400, sample_text: "Brand system" },
            { role: "body", font_family: body, font_size_px: null, line_height: null, letter_spacing: null, font_weight: 400, sample_text: "Core brand language and visual tokens." },
        ],
        imagery_style: { photography_style: null, illustration_style: null, iconography_style: null, mood_keywords: ["clear", "restrained", "structured"] },
        motion_style: { overall_tempo: "medium", easing_description: "simple ease transitions", transition_notes: "Keep motion functional and restrained." },
        brand_positioning: { tagline: null, mission: null, audience_description: null, industry_vertical: null, value_props: [] },
    };
}

const SYSTEM = `You are a senior brand strategist and design systems expert. Given inputs from a website (markdown, branding metadata, screenshots, links) and/or PDF or image content, extract a complete brand identity.

Rules:
- Always output valid hex like #aabbcc.
- Pick exactly ONE color per role; if a role doesn't fit, omit it (don't invent). Use the extended role vocabulary (accent-2, chart-1, chart-2, gradient-start, gradient-end, border, overlay) when warranted.
- Identify 5-12 colors total.
- For tokens, infer reasonable spacing scale (xs/sm/md/lg/xl), border radii, shadow, and animation easings/durations from the brand's visual style.
- Voice: derive tone, vocabulary, do/don'ts, and write 4 sample copy strings IN THE BRAND'S VOICE.
- For assets, return absolute URLs to logos/favicons/og images you find.
- typography_scale: extract a REAL type scale from visual evidence — distinct sizes/weights/line-heights for h1/h2/h3/body/caption/label as observed in the scraped content. Include at least h1, h2, body. Use null for any value you cannot infer; never fabricate exact pixel sizes.
- imagery_style: describe photography_style and illustration_style in plain prose useful for selecting stock imagery (e.g., "desaturated editorial portraits with natural light" or "flat geometric illustrations with bold primary colors"). Include 3-8 mood_keywords.
- motion_style: ALWAYS provide overall_tempo. If no motion is observable, infer from brand personality (luxury/editorial → slow, playful/youth → fast, corporate → medium).
- brand_positioning: pull tagline, mission, audience_description, industry_vertical, and 3-6 value_props as DISCRETE fields. Do not lump them into the summary.
- Be specific and confident; avoid generic placeholders.`;

// ============================================================================
// Multi-page crawl: discover candidate pages and pick high-signal ones.
// ============================================================================

const PREFER_PATH = /\b(about|mission|manifesto|story|team|product|products|pricing|plans|solutions|features|work|cases|brand)\b/i;
const SKIP_PATH = /\b(blog|news|docs?|legal|privacy|terms|careers|jobs|contact|login|signup|search|press|help|support|account|cart|checkout)\b/i;

function pickExtraPages(homeUrl: string, links: string[], max = 2): string[] {
    let homeOrigin = "";
    let homePath = "/";
    try {
        const u = new URL(homeUrl);
        homeOrigin = u.origin;
        homePath = u.pathname.replace(/\/+$/, "") || "/";
    } catch {
        return [];
    }
    const seen = new Set<string>([homeUrl, `${homeOrigin}${homePath}`, `${homeOrigin}/`]);
    const scored: Array<{ url: string; score: number }> = [];
    for (const raw of links) {
        let u: URL;
        try { u = new URL(raw, homeUrl); } catch { continue; }
        if (u.origin !== homeOrigin) continue;
        const path = u.pathname.replace(/\/+$/, "") || "/";
        const norm = `${homeOrigin}${path}`;
        if (seen.has(norm)) continue;
        seen.add(norm);
        if (path === "/" || path === homePath) continue;
        if (SKIP_PATH.test(path)) continue;
        const segs = path.split("/").filter(Boolean);
        if (segs.length > 2) continue; // skip deep pages
        let score = 0;
        if (PREFER_PATH.test(path)) score += 5;
        if (segs.length === 1) score += 2;
        if (/^\/about/.test(path)) score += 2;
        if (/^\/(product|pricing|plans|features)/.test(path)) score += 1;
        scored.push({ url: norm, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, max).map((s) => s.url);
}

// ============================================================================
// Screenshot handling: upload base64 to storage, return public URL.
// ============================================================================

function dataUrlToBuffer(input: string): { buf: Uint8Array; contentType: string } | null {
    if (!input) return null;
    let b64 = input;
    let contentType = "image/png";
    const m = /^data:([^;]+);base64,(.+)$/.exec(input);
    if (m) { contentType = m[1]; b64 = m[2]; }
    try {
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return { buf, contentType };
    } catch {
        return null;
    }
}

async function uploadScreenshot(
    admin: ReturnType<typeof getAdmin>,
    kitId: string,
    raw: string,
): Promise<string | null> {
    if (!raw) return null;
    // If it's already an https URL, return as-is.
    if (/^https?:\/\//i.test(raw)) return raw;
    const decoded = dataUrlToBuffer(raw);
    if (!decoded) return null;
    const ext = decoded.contentType.includes("jpeg") ? "jpg" : decoded.contentType.includes("webp") ? "webp" : "png";
    const path = `${kitId}/screenshots/${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await admin.storage
        .from("brand-assets")
        .upload(path, decoded.buf, { contentType: decoded.contentType, upsert: false });
    if (error) return null;
    const { data: pub } = admin.storage.from("brand-assets").getPublicUrl(path);
    return pub?.publicUrl ?? null;
}

// ============================================================================
// Pass A: cheap inventory per page.
// ============================================================================

const InventorySchema = {
    type: "object",
    properties: {
        page_role: { type: "string", enum: ["home", "about", "product", "pricing", "other"] },
        headlines: { type: "array", items: { type: "string" }, description: "Top 3-5 hero/section headlines verbatim" },
        voice_samples: { type: "array", items: { type: "string" }, description: "5-10 short sentences capturing tone" },
        cta_labels: { type: "array", items: { type: "string" }, description: "Button/CTA labels seen on page" },
        notable_words: { type: "array", items: { type: "string" }, description: "Distinctive vocabulary used by the brand" },
        color_mentions: { type: "array", items: { type: "string" }, description: "Hex colors observed in inline styles, prominent UI" },
        font_mentions: { type: "array", items: { type: "string" }, description: "Font family names observed" },
        tagline_or_mission: { type: ["string", "null"] },
        industry_signals: { type: "array", items: { type: "string" }, description: "Words hinting at industry/audience" },
    },
    required: ["page_role", "headlines", "voice_samples"],
};

type Inventory = z.infer<typeof InventoryZ>;
const InventoryZ = z.object({
    page_role: z.string().optional(),
    headlines: z.array(z.string()).default([]),
    voice_samples: z.array(z.string()).default([]),
    cta_labels: z.array(z.string()).default([]),
    notable_words: z.array(z.string()).default([]),
    color_mentions: z.array(z.string()).default([]),
    font_mentions: z.array(z.string()).default([]),
    tagline_or_mission: z.string().nullable().optional(),
    industry_signals: z.array(z.string()).default([]),
});

async function inventoryPage(args: {
    url: string;
    markdown?: string;
}): Promise<Inventory | null> {
    if (!args.markdown || args.markdown.trim().length < 40) return null;
    try {
        const raw = await callAIStructured<any>({
            model: "google/gemini-3-flash-preview",
            system:
                "You are an observation engine, not an editor. Read the page and return literal observations only — verbatim quotes, observed tokens. Do not invent. Keep lists tight; quality over quantity.",
            user: `URL: ${args.url}\n\nPage markdown:\n${args.markdown.slice(0, 14000)}`,
            toolName: "save_inventory",
            toolDescription: "Save literal observations from one page.",
            parameters: InventorySchema,
        });
        return InventoryZ.parse(raw);
    } catch (e) {
        console.warn("[inventoryPage] failed", args.url, e);
        return null;
    }
}

async function runExtraction(input: {
    url?: string;
    markdown?: string;
    branding?: any;
    imageUrls?: string[];
    pdfTexts?: string[];
    manual?: { hexColors?: string[]; fontFamilies?: string[]; brandName?: string };
    detectedFonts?: DetectedFont[];
    cssColors?: ColorObservation[];
    inventories?: Array<{ url: string; data: Inventory }>;
    pageScreenshots?: string[];
}): Promise<Extraction> {
    const userParts: any[] = [];

    let textBlock = "";
    if (input.url) textBlock += `Source URL: ${input.url}\n\n`;
    if (input.manual?.brandName) textBlock += `Provided brand name: ${input.manual.brandName}\n`;
    if (input.manual?.hexColors?.length)
        textBlock += `User-provided hex colors: ${input.manual.hexColors.join(", ")}\n`;
    if (input.manual?.fontFamilies?.length)
        textBlock += `User-provided fonts: ${input.manual.fontFamilies.join(", ")}\n`;
    if (input.branding) textBlock += `\nFirecrawl branding metadata:\n${JSON.stringify(input.branding).slice(0, 8000)}\n`;
    if (input.detectedFonts?.length) {
        const lines = input.detectedFonts.map((f) => {
            const sub = substituteFor(f.source_family);
            return `- ${f.source_family} [${f.provider}, ${f.license}${sub ? `, suggested open substitute: ${sub}` : ""}]`;
        });
        textBlock += `\nFonts detected on the live site (use the EXACT family names below; if license is "commercial", use the suggested substitute as the primary family but keep the original noted):\n${lines.join("\n")}\n`;
    }
    if (input.cssColors?.length) {
        const top = input.cssColors.slice(0, 18);
        const lines = top.map(
            (c) => `- ${c.hex}  weight=${c.weight.toFixed(1)}${c.isNeutral ? "  (neutral)" : ""}`,
        );
        textBlock += `\nColors observed in the site's CSS, ranked by weighted frequency (background/CTA weighted higher; neutrals flagged). Treat these as ground truth — assign roles, do not invent new hexes:\n${lines.join("\n")}\n`;
    }
    if (input.inventories?.length) {
        const blocks = input.inventories
            .map((iv) => {
                const d = iv.data;
                return `--- ${iv.url} (${d.page_role ?? "page"}) ---
headlines: ${(d.headlines ?? []).slice(0, 5).join(" | ")}
ctas: ${(d.cta_labels ?? []).slice(0, 8).join(" | ")}
voice: ${(d.voice_samples ?? []).slice(0, 8).join(" / ")}
notable: ${(d.notable_words ?? []).slice(0, 12).join(", ")}
industry: ${(d.industry_signals ?? []).slice(0, 6).join(", ")}
tagline: ${d.tagline_or_mission ?? ""}`;
            })
            .join("\n\n");
        textBlock += `\nPer-page inventory (literal observations from a fast first pass):\n${blocks}\n`;
    }
    if (input.markdown) textBlock += `\nPage content (markdown):\n${input.markdown.slice(0, 16000)}\n`;
    if (input.pdfTexts?.length) {
        for (const t of input.pdfTexts.slice(0, 6)) {
            textBlock += `\n${t.slice(0, 12000)}\n`;
        }
    }

    if (!textBlock.trim() && !input.imageUrls?.length) {
        throw new Error("No content to analyze");
    }

    userParts.push({ type: "text", text: textBlock || "Analyze the attached image(s) for brand identity." });

    for (const u of (input.imageUrls ?? []).slice(0, 4)) {
        userParts.push({ type: "image_url", image_url: { url: u } });
    }
    for (const u of (input.pageScreenshots ?? []).slice(0, 3)) {
        userParts.push({ type: "image_url", image_url: { url: u } });
    }

    return callAIStructured<Extraction>({
        // Synthesis pass must stay inside the server response window.
        model: "google/gemini-3-flash-preview",
        system: SYSTEM,
        user: userParts,
        toolName: "save_brand_kit",
        toolDescription: "Save the extracted brand identity as a structured kit.",
        parameters: ExtractionSchema,
    });
}

export const ExtractKitInputSchema = z.object({
    kitId: z.string().uuid(),
    ownerToken: z.string().min(1).max(200),
    url: z.string().url().optional(),
    imageUrls: z.array(z.string().url()).max(8).optional(),
    text: z.string().max(50000).optional(),
    pdfTexts: z.array(z.string().max(40000)).max(10).optional(),
    manual: z
        .object({
            brandName: z.string().max(120).optional(),
            hexColors: z.array(z.string().max(10)).max(20).optional(),
            fontFamilies: z.array(z.string().max(80)).max(10).optional(),
        })
        .optional(),
});
export type ExtractKitInput = z.infer<typeof ExtractKitInputSchema>;

async function rehostAsset(
    admin: ReturnType<typeof getAdmin>,
    kitId: string,
    kind: string,
    url: string,
): Promise<string | null> {
    try {
        const { isBlockedSourceUrl } = await import("./url-guard.server");
        if (isBlockedSourceUrl(url)) return null;
        const res = await fetch(url, { redirect: "follow" });
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength === 0 || buf.byteLength > 10 * 1024 * 1024) return null;
        const extFromUrl = url.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
        const ext =
            extFromUrl ??
            (contentType.includes("svg")
                ? "svg"
                : contentType.includes("png")
                    ? "png"
                    : contentType.includes("webp")
                        ? "webp"
                        : contentType.includes("jpeg") || contentType.includes("jpg")
                            ? "jpg"
                            : contentType.includes("ico")
                                ? "ico"
                                : "bin");
        const safeKind = kind.replace(/[^a-z0-9-]/gi, "_");
        const path = `${kitId}/assets/${safeKind}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
        const { error } = await admin.storage
            .from("brand-assets")
            .upload(path, buf, { contentType, upsert: false });
        if (error) return null;
        return path;
    } catch {
        return null;
    }
}


export async function extractKitImpl(data: ExtractKitInput) {
    const admin = getAdmin();

    // Shared workspace — any visitor may re-extract any kit.
    void data.ownerToken;
    const { data: kit, error: kitErr } = await admin
        .from("brand_kits")
        .select("id")
        .eq("id", data.kitId)
        .maybeSingle();
    if (kitErr || !kit) throw new Error("Kit not found");

    await admin.from("brand_kits").update({ status: "processing" }).eq("id", data.kitId);

    try {
        let markdown: string | undefined;
        let rawHtml: string | undefined;
        let branding: any;
        let assets: Array<{ kind: string; url: string }> = [];
        let detectedFonts: DetectedFont[] = [];
        let cssColors: ColorObservation[] = [];
        let inventories: Array<{ url: string; data: Inventory }> = [];
        let pageScreenshots: string[] = [];
        let extraction: Extraction | null = null;

        // 1. Scrape URL if provided
        if (data.url) {
            // 1a. Discover candidate pages and pick top extras alongside homepage.
            const mapped = await firecrawlMap(data.url, 60);
            const extras = pickExtraPages(data.url, mapped, 2);
            const targets = [data.url, ...extras];

            // 1b. Scrape all targets in parallel. Homepage is required; extras best-effort.
            const scraped = await Promise.allSettled(targets.map((u) => firecrawlScrape(u)));
            const homeRes = scraped[0];
            if (homeRes.status === "rejected") {
                console.warn("[extractKit] homepage scrape failed; using fallback extraction", homeRes.reason);
                extraction = fallbackExtraction({
                    url: data.url,
                    manual: data.manual,
                    cssColors,
                    detectedFonts,
                });
            }

            if (!extraction) {
                type PageDoc = { url: string; doc: any };
                const pages: PageDoc[] = [];
                scraped.forEach((r, i) => {
                    if (r.status === "fulfilled") {
                        pages.push({ url: targets[i], doc: r.value.data ?? r.value });
                    }
                });

                const home = pages[0].doc;
                markdown = pages.map((p) => `# ${p.url}\n\n${p.doc.markdown ?? ""}`).join("\n\n---\n\n");
                rawHtml = home.rawHtml ?? home.html;
                branding = home.branding;

                // 1c. Upload screenshots → public URLs the AI can ingest.
                const shotPromises = pages.map(async (p) => {
                    const raw: string | undefined = p.doc.screenshot ?? p.doc.screenshotUrl;
                    if (!raw) return null;
                    return uploadScreenshot(admin, data.kitId, raw);
                });
                const shots = await Promise.all(shotPromises);
                pageScreenshots = shots.filter((u): u is string => !!u);

                // 1d. Auto-collect logo/favicon/og from Firecrawl branding (homepage).
                if (branding?.images) {
                    for (const k of ["logo", "favicon", "ogImage"] as const) {
                        if (branding.images[k]) {
                            assets.push({
                                kind: k === "ogImage" ? "og-image" : k,
                                url: branding.images[k],
                            });
                        }
                    }
                }

                // 1e. HTML logo harvest across every scraped page.
                for (const p of pages) {
                    const html = p.doc.rawHtml ?? p.doc.html;
                    if (!html) continue;
                    try {
                        for (const a of harvestLogosFromHtml(html, p.url)) assets.push(a);
                    } catch (e) {
                        console.warn("[extractKit] logo harvest failed", p.url, e);
                    }
                }

                // 1f. Deterministic logo probes (favicon.ico, apple-touch-icon, og:image, tile).
                try {
                    const probed = await probeLogos({ baseUrl: data.url, rawHtml });
                    for (const a of probed) assets.push(a);
                } catch (e) {
                    console.warn("[extractKit] logo probes failed", e);
                }

                // 1g. Detect real fonts from CSS across all pages.
                try {
                    const fontResults = await Promise.all(
                        pages.map((p) =>
                            detectFontsFromSite({ url: p.url, rawHtml: p.doc.rawHtml ?? p.doc.html }).catch(() => []),
                        ),
                    );
                    const seenFont = new Map<string, DetectedFont>();
                    for (const list of fontResults) {
                        for (const f of list) {
                            const k = f.source_family.toLowerCase();
                            if (!seenFont.has(k)) seenFont.set(k, f);
                        }
                    }
                    detectedFonts = [...seenFont.values()].slice(0, 8);
                } catch (e) {
                    console.warn("[extractKit] font detection failed", e);
                }

                // 1h. CSS color frequency across every page (HTML + inline CSS).
                try {
                    const corpus = pages
                        .map((p) => (p.doc.rawHtml ?? p.doc.html ?? ""))
                        .join("\n");
                    if (corpus) cssColors = extractColorsFromText(corpus, 24);
                } catch (e) {
                    console.warn("[extractKit] css color extraction failed", e);
                }

                // Avoid an extra AI pass before synthesis; it caused first-run timeouts.
                inventories = [];
            }
        }

        // 2. Run AI extraction
        if (!extraction) {
            try {
                extraction = await runExtraction({
                    url: data.url,
                    markdown: markdown ?? data.text,
                    branding,
                    imageUrls: data.imageUrls,
                    pdfTexts: data.pdfTexts,
                    manual: data.manual,
                    detectedFonts,
                    cssColors,
                    inventories,
                    pageScreenshots,
                });
            } catch (e: any) {
                const msg = String(e?.message ?? "");
                if (/rate limit/i.test(msg)) e.code = "ai_rate_limit";
                else if (/credits exhausted/i.test(msg)) e.code = "ai_credits_exhausted";
                else if (/no content to analyze/i.test(msg)) e.code = "parse_failed";
                else if (!e.code) e.code = "ai_failed";
                extraction = fallbackExtraction({
                    url: data.url,
                    manual: data.manual,
                    cssColors,
                    detectedFonts,
                });
            }
        }

        // Build merged font records: enrich AI fonts with detected metadata,
        // then add any detected fonts the AI missed.
        const detectedByName = new Map<string, DetectedFont>();
        for (const d of detectedFonts) detectedByName.set(d.source_family.toLowerCase(), d);

        const usedDetected = new Set<string>();
        const enrichedAiFonts = extraction.fonts.map((f) => {
            // Try to match AI-suggested family to a detected family
            const lc = f.family.toLowerCase();
            const direct = detectedByName.get(lc);
            if (direct) {
                usedDetected.add(lc);
                const sub = substituteFor(direct.source_family);
                return {
                    family: sub ?? f.family,
                    role: f.role,
                    weights: f.weights ?? direct.weights ?? [],
                    google_font: sub ? true : direct.provider === "google" || (f.google_font ?? false),
                    source_family: direct.source_family,
                    provider: direct.provider,
                    provider_url: direct.provider_url,
                    license: direct.license,
                    license_note: direct.license_note,
                    file_urls: direct.file_urls,
                    is_substitute: !!sub,
                };
            }
            return {
                family: f.family,
                role: f.role,
                weights: f.weights ?? [],
                google_font: f.google_font ?? false,
                source_family: null,
                provider: null,
                provider_url: null,
                license: null,
                license_note: null,
                file_urls: [],
                is_substitute: false,
            };
        });

        // Append detected fonts the AI didn't surface (e.g. body font missed).
        const extraDetected = detectedFonts
            .filter((d) => !usedDetected.has(d.source_family.toLowerCase()))
            .slice(0, 4)
            .map((d) => {
                const sub = substituteFor(d.source_family);
                // Heuristic role
                const lc = d.source_family.toLowerCase();
                const role = /mono|code/.test(lc)
                    ? "mono"
                    : enrichedAiFonts.some((f) => f.role === "heading")
                        ? "body"
                        : "heading";
                return {
                    family: sub ?? d.source_family,
                    role,
                    weights: d.weights,
                    google_font: sub ? true : d.provider === "google",
                    source_family: d.source_family,
                    provider: d.provider,
                    provider_url: d.provider_url,
                    license: d.license,
                    license_note: d.license_note,
                    file_urls: d.file_urls,
                    is_substitute: !!sub,
                };
            });

        const mergedFonts = [...enrichedAiFonts, ...extraDetected];

        // Merge AI-found assets with scrape-found assets, dedupe by URL
        // Absolutize any relative URLs (the AI sometimes returns "/foo/bar.png").
        const absolutize = (u: string): string | null => {
            if (!u) return null;
            if (u.startsWith("data:")) return null;
            try { return new URL(u, data.url ?? undefined).toString(); } catch { return null; }
        };
        const allAssets = [...assets, ...extraction.assets]
            .map((a) => ({ kind: a.kind, url: absolutize(a.url) }))
            .filter((a): a is { kind: string; url: string } => !!a.url);
        const dedupedAssets: Array<{ kind: string; url: string }> = dedupAssetsByKey(allAssets);

        // 3. Persist
        const updateRow: Record<string, any> = {
            name: extraction.name,
            status: "ready",
            typography_scale: extraction.typography_scale ?? [],
            imagery_style: extraction.imagery_style ?? null,
            motion_style: extraction.motion_style ?? null,
            brand_positioning: extraction.brand_positioning ?? null,
            error_code: null,
            error_status: null,
            error_message: null,
        };
        if (data.url) updateRow.source_url = data.url;
        await admin.from("brand_kits").update(updateRow).eq("id", data.kitId);

        // Wipe and re-insert children (simple approach for this template)
        await Promise.all([
            admin.from("kit_colors").delete().eq("kit_id", data.kitId),
            admin.from("kit_fonts").delete().eq("kit_id", data.kitId),
            admin.from("kit_tokens").delete().eq("kit_id", data.kitId),
            admin.from("kit_assets").delete().eq("kit_id", data.kitId),
            admin.from("kit_voice").delete().eq("kit_id", data.kitId),
        ]);

        if (extraction.colors.length)
            await admin.from("kit_colors").insert(
                extraction.colors.map((c, i) => ({
                    kit_id: data.kitId,
                    hex: c.hex.startsWith("#") ? c.hex : `#${c.hex}`,
                    role: c.role,
                    name: c.name,
                    position: i,
                })),
            );
        if (mergedFonts.length)
            await admin.from("kit_fonts").insert(
                mergedFonts.map((f, i) => ({
                    kit_id: data.kitId,
                    family: f.family,
                    role: f.role,
                    weights: f.weights ?? [],
                    google_font: f.google_font ?? false,
                    source_family: f.source_family,
                    provider: f.provider,
                    provider_url: f.provider_url,
                    license: f.license,
                    license_note: f.license_note,
                    file_urls: f.file_urls ?? [],
                    is_substitute: f.is_substitute ?? false,
                    position: i,
                })),
            );
        if (extraction.tokens.length)
            await admin.from("kit_tokens").insert(
                extraction.tokens.map((t, i) => ({
                    kit_id: data.kitId,
                    category: t.category,
                    name: t.name,
                    value: t.value,
                    position: i,
                })),
            );
        if (dedupedAssets.length) {
            // Best-effort rehost into brand-assets bucket so logos survive source changes.
            const rehosted = await Promise.all(
                dedupedAssets.map(async (a) => ({
                    ...a,
                    storage_path: await rehostAsset(admin, data.kitId, a.kind, a.url),
                })),
            );
            // Drop assets whose source URL we couldn't fetch — those are dead links
            // that would render as broken images on the kit page.
            const reachable = rehosted.filter((a) => !!a.storage_path);
            if (reachable.length) await admin.from("kit_assets").insert(
                reachable.map((a, i) => ({
                    kit_id: data.kitId,
                    kind: a.kind,
                    url: a.url,
                    storage_path: a.storage_path,
                    position: i,
                })),
            );
        }
        await admin.from("kit_voice").insert({
            kit_id: data.kitId,
            tone: extraction.voice.tone ?? [],
            vocabulary: extraction.voice.vocabulary ?? [],
            dos: extraction.voice.dos ?? [],
            donts: extraction.voice.donts ?? [],
            samples: extraction.voice.samples ?? {},
            summary: extraction.summary ?? null,
        });

        return { ok: true, kitId: data.kitId };
    } catch (e: any) {
        const rawMsg = String(e?.message ?? "Extraction failed");
        const errMessage = rawMsg.slice(0, 500);
        const code: string = e?.code ?? "unknown";
        const statusMatch = rawMsg.match(/\[(\d{3})\]|error (\d{3})/i);
        const errStatus = statusMatch ? Number(statusMatch[1] ?? statusMatch[2]) : null;
        await admin
            .from("brand_kits")
            .update({
                status: "error",
                error_code: code,
                error_status: errStatus,
                error_message: errMessage,
            })
            .eq("id", data.kitId);
        console.error("[extractKit]", e);
        return { ok: false, error: errMessage, kitId: data.kitId };
    }
}

// Generate sample brand-voice copy on demand
export const GenerateSampleCopyInputSchema = z.object({
    kitId: z.string().uuid(),
    kind: z.enum(["headline", "cta", "slide_title", "email_intro", "social_post"]),
    topic: z.string().min(1).max(300),
});
export type GenerateSampleCopyInput = z.infer<typeof GenerateSampleCopyInputSchema>;

export async function generateSampleCopyImpl(data: GenerateSampleCopyInput) {
    const admin = getAdmin();
    const { data: voice } = await admin
        .from("kit_voice")
        .select("tone, vocabulary, dos, donts, samples, summary")
        .eq("kit_id", data.kitId)
        .maybeSingle();
    const { data: kit } = await admin
        .from("brand_kits")
        .select("name")
        .eq("id", data.kitId)
        .maybeSingle();

    if (!voice || !kit) throw new Error("Kit not found");

    const result = await callAIStructured<{ output: string }>({
        system: `You write copy in a brand's voice. Brand: ${kit.name}.
Tone: ${JSON.stringify(voice.tone)}
Vocabulary to favor: ${JSON.stringify(voice.vocabulary)}
DO: ${JSON.stringify(voice.dos)}
DON'T: ${JSON.stringify(voice.donts)}
Existing samples: ${JSON.stringify(voice.samples)}.
Match this voice exactly. Be specific, not generic.`,
        user: `Write a ${data.kind.replace("_", " ")} for: ${data.topic}`,
        toolName: "save_copy",
        toolDescription: "Return one piece of copy in the brand's voice.",
        parameters: {
            type: "object",
            properties: { output: { type: "string" } },
            required: ["output"],
        },
    });

    return result.output;
}

// Re-scan the kit's source URL for additional logo / mark / icon assets.
// Preserves existing assets (including AI-generated variants) and only inserts
// URLs we have not seen before.
export const HarvestMoreAssetsInputSchema = z.object({
    kitId: z.string().uuid(),
    ownerToken: z.string().min(1),
});
export type HarvestMoreAssetsInput = z.infer<typeof HarvestMoreAssetsInputSchema>;

export async function harvestMoreAssetsImpl(data: HarvestMoreAssetsInput) {
    const admin = getAdmin();

    void data.ownerToken;
    const { data: kit, error: kitErr } = await admin
        .from("brand_kits")
        .select("id, source_url")
        .eq("id", data.kitId)
        .maybeSingle();
    if (kitErr || !kit) throw new Error("Kit not found");
    if (!kit.source_url) return { ok: false, added: 0, error: "No source URL" };

    const { data: existing } = await admin
        .from("kit_assets")
        .select("url, kind, position")
        .eq("kit_id", data.kitId);
    // Build a normalized-key set from existing rows so cache-busted / mirror
    // URLs of the same logo don't get re-imported.
    const existingKeys = new Set<string>(
        (existing ?? []).map((a: { kind: string; url: string }) => assetDedupKey(a.kind, a.url)),
    );
    const existingBasenameKeys = new Set<string>(
        (existing ?? []).map((a: { kind: string; url: string }) => {
            const basename = assetDedupKey(a.kind, a.url).split("::")[2];
            return `${a.kind}::${basename}`;
        }),
    );
    const startPos = (existing ?? []).reduce(
        (m: number, a: any) => Math.max(m, a.position ?? 0),
        -1,
    ) + 1;

    let scraped: any;
    try {
        scraped = await firecrawlScrape(kit.source_url);
    } catch (e: any) {
        return { ok: false, added: 0, error: e?.message ?? "Scrape failed" };
    }
    const doc = scraped.data ?? scraped;
    const rawHtml: string | undefined = doc.rawHtml ?? doc.html;
    const branding = doc.branding;

    const candidates: Array<{ kind: string; url: string }> = [];
    if (branding?.images) {
        for (const k of ["logo", "favicon", "ogImage"] as const) {
            if (branding.images[k]) {
                candidates.push({
                    kind: k === "ogImage" ? "og-image" : k,
                    url: branding.images[k],
                });
            }
        }
    }
    if (rawHtml) {
        try {
            for (const a of harvestLogosFromHtml(rawHtml, kit.source_url)) candidates.push(a);
        } catch (e) {
            console.warn("[harvestMoreAssets] harvest failed", e);
        }
    }

    // Dedup the new candidates among themselves AND against existing rows.
    const dedupedCandidates = dedupAssetsByKey(candidates);
    const fresh = dedupedCandidates.filter((c) => {
        const key = assetDedupKey(c.kind, c.url);
        const basenameKey = `${c.kind}::${key.split("::")[2]}`;
        if (existingKeys.has(key)) return false;
        if (basenameKey.split("::")[1] && existingBasenameKeys.has(basenameKey)) return false;
        return true;
    });
    if (!fresh.length) return { ok: true, added: 0 };

    const rehosted = await Promise.all(
        fresh.map(async (a) => ({
            ...a,
            storage_path: await rehostAsset(admin, data.kitId, a.kind, a.url),
        })),
    );
    const { error: insErr } = await admin.from("kit_assets").insert(
        rehosted.map((a, i) => ({
            kit_id: data.kitId,
            kind: a.kind,
            url: a.url,
            storage_path: a.storage_path,
            position: startPos + i,
        })),
    );
    if (insErr) return { ok: false, added: 0, error: insErr.message };
    return { ok: true, added: fresh.length };
}
