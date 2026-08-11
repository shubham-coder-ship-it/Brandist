// Client-side export builders for the brand kit.
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { contrastRatio } from "@/lib/color";

type Color = { id: string; hex: string; role?: string | null; name?: string | null };
type Font = {
    id: string;
    family: string;
    role?: string | null;
    weights?: string[];
    google_font?: boolean;
    source_family?: string | null;
    provider?: string | null;
    provider_url?: string | null;
    license?: string | null;
    license_note?: string | null;
    file_urls?: Array<{ url: string; weight?: string; style?: string; format?: string }> | null;
    is_substitute?: boolean | null;
};

export type FontFileBlob = {
    url: string;
    contentType?: string;
    base64?: string;
};
export type AssetFileBlob = {
    url: string;
    contentType?: string;
    base64?: string;
};
type Token = { id: string; category: string; name: string; value: string };
type Asset = { id: string; kind: string; url: string };
type Voice = {
    tone?: any[];
    vocabulary?: string[];
    dos?: string[];
    donts?: string[];
    samples?: Record<string, string>;
    summary?: string | null;
} | null;

export function slug(s: string) {
    return String(s || "kit").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// W3C Design Tokens JSON
export function buildTokensJSON(p: { colors: Color[]; fonts: Font[]; tokens: Token[] }) {
    const obj: any = { color: {}, font: {}, spacing: {}, radius: {}, shadow: {}, animation: {} };
    p.colors.forEach((c) => {
        obj.color[c.role || c.name || c.hex] = { $value: c.hex, $type: "color" };
    });
    p.fonts.forEach((f) => {
        obj.font[f.role || f.family] = { $value: f.family, $type: "fontFamily" };
    });
    p.tokens.forEach((t) => {
        const cat = t.category as keyof typeof obj;
        if (obj[cat]) obj[cat][t.name] = { $value: t.value, $type: t.category };
    });
    return JSON.stringify(obj, null, 2);
}

// Plain CSS variables
export function buildCSS(p: { colors: Color[]; fonts: Font[]; tokens: Token[] }) {
    const lines = [":root {"];
    p.colors.forEach((c) => lines.push(`  --color-${c.role || slug(c.name || c.hex)}: ${c.hex};`));
    p.fonts.forEach((f) => lines.push(`  --font-${f.role || slug(f.family)}: "${f.family}";`));
    p.tokens.forEach((t) => lines.push(`  --${t.category}-${slug(t.name)}: ${t.value};`));
    lines.push("}");
    return lines.join("\n");
}

// Tailwind v4 @theme block
export function buildTailwindTheme(p: { colors: Color[]; fonts: Font[]; tokens: Token[] }) {
    const lines = ["@import \"tailwindcss\";", "", "@theme {"];
    p.colors.forEach((c) => lines.push(`  --color-${c.role || slug(c.name || c.hex)}: ${c.hex};`));
    p.fonts.forEach((f) => lines.push(`  --font-${f.role || slug(f.family)}: "${f.family}", ${f.role === "mono" ? "monospace" : "sans-serif"};`));
    p.tokens.forEach((t) => {
        if (t.category === "radius") lines.push(`  --radius-${slug(t.name)}: ${t.value};`);
        else if (t.category === "spacing") lines.push(`  --spacing-${slug(t.name)}: ${t.value};`);
        else if (t.category === "shadow") lines.push(`  --shadow-${slug(t.name)}: ${t.value};`);
    });
    lines.push("}");
    return lines.join("\n");
}

// Tokens Studio (Figma) JSON
export function buildTokensStudioJSON(p: { colors: Color[]; fonts: Font[]; tokens: Token[] }) {
    const out: any = { global: {} };
    p.colors.forEach((c) => {
        out.global[c.role || c.name || c.hex] = { value: c.hex, type: "color" };
    });
    p.fonts.forEach((f) => {
        out.global[`font-${f.role || slug(f.family)}`] = { value: f.family, type: "fontFamilies" };
    });
    p.tokens.forEach((t) => {
        out.global[`${t.category}-${slug(t.name)}`] = {
            value: t.value,
            type:
                t.category === "radius"
                    ? "borderRadius"
                    : t.category === "shadow"
                        ? "boxShadow"
                        : t.category === "spacing"
                            ? "spacing"
                            : "other",
        };
    });
    return JSON.stringify(out, null, 2);
}

// Full design instructions (DESIGN.md) — palette, typography, voice, tokens,
// usage rules. Human-readable spec that ships next to the PDF.
export function buildDesignMarkdown(args: {
    name: string;
    colors: Color[];
    fonts: Font[];
    tokens: Token[];
    voice: Voice;
}): string {
    const L: string[] = [];
    L.push(`# ${args.name} — Design Instructions`, "");
    L.push(
        "Source-of-truth design spec for this brand. Use alongside `tokens.json`, the CSS files and the brand guide PDF. Every rule below is binding — break it only with intent.",
        "",
        `_Generated ${new Date().toISOString().slice(0, 10)}._`,
        "",
        "---",
        "",
    );

    L.push("## 01. Palette", "");
    if (args.colors.length) {
        L.push("| Role | Name | Hex |", "| --- | --- | --- |");
        for (const c of args.colors) {
            L.push(`| ${c.role ?? "—"} | ${c.name ?? "—"} | \`${c.hex.toUpperCase()}\` |`);
        }
        L.push("", "**Rules**", "");
        L.push(
            "- Use color roles (`primary`, `accent`, `surface`, `ink`…) — never the hex directly in product code.",
            "- One accent per surface. Reserve the most saturated value for primary CTAs and errors.",
            "- Maintain WCAG AA contrast (4.5:1 body, 3:1 large text). Verify pairings before shipping.",
            "",
        );
    } else {
        L.push("_No colors captured._", "");
    }

    // ── Contrast (machine-readable WCAG matrix) ─────────────────────
    L.push("## 01a. Contrast — WCAG rules (binding)", "");
    if (args.colors.length) {
        L.push(
            "These pairings are computed from the palette above using the WCAG 2.1 contrast formula.",
            "**An AI / designer / engineer using this kit MUST obey them verbatim. Never invent a pairing not listed as ✅ here.**",
            "",
            "**Thresholds**",
            "",
            "- `AAA` ≥ 7.0:1 — required for body copy at small sizes when possible.",
            "- `AA`  ≥ 4.5:1 — minimum for body copy under 18pt / 14pt bold.",
            "- `AA Large` ≥ 3.0:1 — only valid for text ≥ 24px (or ≥ 18.66px bold), large icons, focus rings.",
            "- `FAIL` < 3.0:1 — **never use for text or meaningful UI** under any circumstance.",
            "",
            "**Decision rule (apply in order)**",
            "",
            "1. If a pairing is `FAIL`, do not use it for text, icons, borders carrying meaning, or focus states. Decorative fills only.",
            "2. If a pairing is `AA Large`, use it only for text ≥ 24px regular / ≥ 18.66px bold, or for non-text UI (icons, focus rings).",
            "3. Prefer `AAA` for any body copy. Fall back to `AA` only when palette constraints force it.",
            "4. When in doubt, use the highest-ratio pairing the design will allow — **never** pick a lower one because it 'looks nicer'.",
            "",
        );

        const palette: Array<{ label: string; hex: string }> = [
            ...args.colors.map((c) => ({
                label: c.role || c.name || c.hex.toUpperCase(),
                hex: c.hex,
            })),
            { label: "white", hex: "#FFFFFF" },
            { label: "black", hex: "#000000" },
        ];

        const verdict = (r: number) =>
            r >= 7 ? "AAA ✅" : r >= 4.5 ? "AA ✅" : r >= 3 ? "AA Large ⚠️" : "FAIL ❌";

        L.push("**Pairing matrix** (foreground × background)", "");
        L.push("| Foreground | Background | Ratio | Verdict | Allowed for |", "| --- | --- | --- | --- | --- |");
        for (const fg of palette) {
            for (const bg of palette) {
                if (fg.hex.toLowerCase() === bg.hex.toLowerCase()) continue;
                const r = contrastRatio(fg.hex, bg.hex);
                if (r < 1.05) continue; // skip near-identical
                const allowed =
                    r >= 7
                        ? "Body, headings, icons, all UI"
                        : r >= 4.5
                            ? "Body copy, headings, icons"
                            : r >= 3
                                ? "Large text only (≥24px), focus rings, large icons"
                                : "**Decoration only — never text or meaningful UI**";
                L.push(
                    `| \`${fg.label}\` (${fg.hex.toUpperCase()}) | \`${bg.label}\` (${bg.hex.toUpperCase()}) | ${r.toFixed(2)}:1 | ${verdict(r)} | ${allowed} |`,
                );
            }
        }
        L.push("");

        // Explicit forbidden list — easiest signal for an LLM to obey.
        const forbidden: string[] = [];
        for (const fg of palette) {
            for (const bg of palette) {
                if (fg.hex.toLowerCase() === bg.hex.toLowerCase()) continue;
                const r = contrastRatio(fg.hex, bg.hex);
                if (r < 3) {
                    forbidden.push(
                        `- **NEVER** place \`${fg.label}\` (${fg.hex.toUpperCase()}) text on \`${bg.label}\` (${bg.hex.toUpperCase()}) — ratio ${r.toFixed(2)}:1.`,
                    );
                }
            }
        }
        if (forbidden.length) {
            L.push("**Forbidden pairings (do not use for text or UI):**", "");
            // Dedupe symmetric pairs (a→b == b→a for ratio), keep one direction.
            const seen = new Set<string>();
            const unique = forbidden.filter((line) => {
                const m = line.match(/`([^`]+)`[^`]*\`([^`]+)`/);
                if (!m) return true;
                const key = [m[1], m[2]].sort().join("|");
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            L.push(...unique, "");
        } else {
            L.push("_All palette pairings clear at least the AA Large threshold._", "");
        }
    } else {
        L.push("_No colors captured — contrast matrix unavailable._", "");
    }

    L.push("## 02. Typography", "");
    if (args.fonts.length) {
        L.push("| Role | Family | Weights | License |", "| --- | --- | --- | --- |");
        for (const f of args.fonts) {
            L.push(
                `| ${f.role ?? "—"} | ${f.family}${f.is_substitute && f.source_family ? ` _(substitute for ${f.source_family})_` : ""} | ${(f.weights ?? []).join(", ") || "—"} | ${f.license ?? "unknown"} |`,
            );
        }
        L.push("", "**Rules**", "");
        L.push(
            "- Respect role assignments. Display faces are not body faces.",
            "- Set heading line-height ~1.05–1.15. Body 1.45–1.6. Mono / labels uppercase tracked +60–120.",
            "- Substitute fonts are open-source stand-ins. Original commercial fonts must be licensed before production use.",
            "",
        );
    } else {
        L.push("_No fonts captured._", "");
    }

    L.push("## 03. Voice", "");
    const v = args.voice;
    if (v) {
        if (v.summary) L.push(v.summary, "");
        if (v.tone?.length) {
            L.push("**Tone**", "");
            for (const t of v.tone as any[]) {
                L.push(`- ${t.label}${t.confidence ? ` (${Math.round(t.confidence * 100)}%)` : ""}`);
            }
            L.push("");
        }
        if (v.vocabulary?.length) L.push("**Vocabulary**", "", v.vocabulary.join(", "), "");
        if (v.dos?.length) {
            L.push("**Do**", "");
            v.dos.forEach((d) => L.push(`- ${d}`));
            L.push("");
        }
        if (v.donts?.length) {
            L.push("**Don't**", "");
            v.donts.forEach((d) => L.push(`- ${d}`));
            L.push("");
        }
        if (v.samples) {
            L.push("**Sample copy**", "");
            Object.entries(v.samples).forEach(([k, val]) =>
                L.push(`- _${k.replace(/_/g, " ")}_: ${val}`),
            );
            L.push("");
        }
    } else {
        L.push("_No voice analysis available._", "");
    }

    L.push("## 04. Tokens", "");
    if (args.tokens.length) {
        const grouped: Record<string, Token[]> = {};
        args.tokens.forEach((t) => ((grouped[t.category] ||= []).push(t)));
        for (const [cat, items] of Object.entries(grouped)) {
            L.push(`### ${cat}`, "");
            L.push("| Name | Value |", "| --- | --- |");
            for (const t of items) L.push(`| \`${t.name}\` | \`${t.value}\` |`);
            L.push("");
        }
    } else {
        L.push("_No tokens captured._", "");
    }

    L.push("## 05. Usage", "");
    L.push(
        "- `tokens.json` (W3C Design Tokens) is the canonical machine-readable source.",
        "- `*.css` ships CSS custom properties; `*-tailwind.css` ships a Tailwind v4 `@theme` block.",
        "- `*-tokens-studio.json` imports into Figma via the Tokens Studio plugin.",
        "- `fonts/` holds open-licensed font files. `FONTS.md` documents licensing.",
        "- `assets/` holds extracted logos and brand imagery.",
        "- `brand-guide.pdf` is the print-ready editorial guide.",
        "",
    );

    return L.join("\n");
}

// Brand voice markdown
export function buildVoiceMarkdown(name: string, voice: Voice) {
    if (!voice) return `# ${name}\n\nNo brand voice analysis available.\n`;
    const lines: string[] = [`# ${name} — Brand Voice`, ""];
    if (voice.summary) lines.push(voice.summary, "");
    if (voice.tone?.length) {
        lines.push("## Tone", "");
        voice.tone.forEach((t: any) => lines.push(`- ${t.label}${t.confidence ? ` (${Math.round(t.confidence * 100)}%)` : ""}`));
        lines.push("");
    }
    if (voice.vocabulary?.length) {
        lines.push("## Vocabulary", "", voice.vocabulary.join(", "), "");
    }
    if (voice.dos?.length) {
        lines.push("## Do", "");
        voice.dos.forEach((d) => lines.push(`- ${d}`));
        lines.push("");
    }
    if (voice.donts?.length) {
        lines.push("## Don't", "");
        voice.donts.forEach((d) => lines.push(`- ${d}`));
        lines.push("");
    }
    if (voice.samples) {
        lines.push("## Sample copy", "");
        Object.entries(voice.samples).forEach(([k, v]) =>
            lines.push(`**${k.replace(/_/g, " ")}**: ${v}`, ""),
        );
    }
    return lines.join("\n");
}

// PDF brand guide
async function fetchGoogleFontBase64(family: string): Promise<{ regular?: string; bold?: string } | null> {
    try {
        const familySlug = slug(family);
        const meta = await fetch(`https://gwfh.mranftl.com/api/fonts/${familySlug}?subsets=latin`);
        if (!meta.ok) return null;
        const json: any = await meta.json();
        const variants: any[] = Array.isArray(json?.variants) ? json.variants : [];
        const pick = async (preds: ((v: any) => boolean)[]) => {
            for (const p of preds) {
                const v = variants.find(p);
                if (v?.ttf) {
                    const r = await fetch(v.ttf);
                    if (!r.ok) continue;
                    const buf = new Uint8Array(await r.arrayBuffer());
                    let bin = "";
                    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
                    return btoa(bin);
                }
            }
            return undefined;
        };
        const regular = await pick([
            (v) => v.fontWeight === "regular" || v.fontWeight === "400",
            (v) => v.fontStyle === "normal",
            () => true,
        ]);
        const bold = await pick([
            (v) => v.fontWeight === "700" || v.fontWeight === "bold",
        ]);
        return { regular, bold };
    } catch {
        return null;
    }
}

export async function buildBrandPDF(args: {
    name: string;
    colors: Color[];
    fonts: Font[];
    tokens: Token[];
    voice: Voice;
}): Promise<Blob> {
    // Editorial brand guide. A4 portrait. Washi paper / sumi ink / hanko red accent.
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();   // 595.28
    const pageH = doc.internal.pageSize.getHeight();  // 841.89
    const M = 56; // outer margin
    const colW = pageW - M * 2;

    // Project palette (constants — frame, never the brand itself)
    const WASHI: [number, number, number] = [244, 239, 230];
    const SUMI: [number, number, number] = [10, 10, 10];
    const HANKO: [number, number, number] = [139, 26, 26];
    const INK_SOFT: [number, number, number] = [60, 56, 50];
    const INK_MUTED: [number, number, number] = [128, 122, 112];
    const RULE: [number, number, number] = [205, 198, 184];

    // ── Font registration ────────────────────────────────────────────
    // Try to load Cormorant Garamond (display), Libre Baskerville (body),
    // Courier Prime (mono), plus the brand's own heading + body fonts.
    const tryRegister = async (family: string): Promise<{ ok: boolean; bold: boolean }> => {
        const data = await fetchGoogleFontBase64(family);
        if (!data?.regular) return { ok: false, bold: false };
        try {
            const base = `${slug(family)}.ttf`;
            doc.addFileToVFS(base, data.regular);
            doc.addFont(base, family, "normal");
            let bold = false;
            if (data.bold) {
                const bf = `${slug(family)}-bold.ttf`;
                doc.addFileToVFS(bf, data.bold);
                doc.addFont(bf, family, "bold");
                bold = true;
            }
            return { ok: true, bold };
        } catch {
            return { ok: false, bold: false };
        }
    };

    const nonMono = args.fonts.filter((f) => f.role !== "mono");
    const brandHeading = nonMono.find((f) => f.role === "heading" || f.role === "display") ?? nonMono[0];
    const brandBody =
        nonMono.find((f) => f.role === "body") ?? nonMono.find((f) => f !== brandHeading) ?? brandHeading;

    // Frame fonts (project aesthetic)
    const frameDisplayName = "Cormorant Garamond";
    const frameBodyName = "Libre Baskerville";
    const frameMonoName = "Courier Prime";

    const wantedFrame = [frameDisplayName, frameBodyName, frameMonoName];
    const brandFamilies = [brandHeading?.family, brandBody?.family]
        .filter((f): f is string => !!f && f.length > 0 && !wantedFrame.includes(f));
    const uniqueFamilies = Array.from(new Set([...wantedFrame, ...brandFamilies]));
    const registered: Record<string, { ok: boolean; bold: boolean }> = {};
    await Promise.all(
        uniqueFamilies.map(async (fam) => {
            registered[fam] = await tryRegister(fam);
        }),
    );

    const FRAME_DISPLAY = registered[frameDisplayName]?.ok ? frameDisplayName : "times";
    const FRAME_DISPLAY_BOLD = registered[frameDisplayName]?.bold ?? true;
    const FRAME_BODY = registered[frameBodyName]?.ok ? frameBodyName : "times";
    const FRAME_MONO = registered[frameMonoName]?.ok ? frameMonoName : "courier";

    // ── Helpers ──────────────────────────────────────────────────────
    const setRGB = (which: "fill" | "text" | "draw", c: [number, number, number]) => {
        if (which === "fill") doc.setFillColor(c[0], c[1], c[2]);
        else if (which === "text") doc.setTextColor(c[0], c[1], c[2]);
        else doc.setDrawColor(c[0], c[1], c[2]);
    };

    const hexToRgb = (hex: string): [number, number, number] => {
        const h = hex.replace("#", "").trim();
        const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
        return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
    };
    const paintWashi = () => {
        setRGB("fill", WASHI);
        doc.rect(0, 0, pageW, pageH, "F");
    };

    let y = M;
    const pageStartY = M + 56; // leaves room for header band

    const newContentPage = () => {
        doc.addPage();
        paintWashi();
        y = pageStartY;
    };

    const ensure = (h: number) => {
        if (y + h > pageH - M - 40) newContentPage();
    };

    const eyebrow = (num: string, label: string) => {
        setRGB("text", HANKO);
        doc.setFont(FRAME_MONO, "normal");
        doc.setFontSize(8);
        doc.text(num.toUpperCase(), M, y);
        setRGB("text", INK_MUTED);
        doc.text(label.toUpperCase(), M + 38, y);
        y += 28;
    };

    const display = (text: string, size = 44) => {
        setRGB("text", SUMI);
        doc.setFont(FRAME_DISPLAY, FRAME_DISPLAY_BOLD ? "bold" : "normal");
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, colW);
        lines.forEach((ln: string, i: number) => {
            ensure(size + 6);
            // move baseline DOWN before drawing so the glyphs don't ascend
            // into the previous element (eyebrow / rule).
            y += i === 0 ? size * 0.82 : size * 0.96;
            doc.text(ln, M, y);
        });
        y += 14;
    };

    // Strip CSS-var noise / "Variable" suffixes from a font family display name.
    const cleanFamily = (raw: string): string => {
        let s = String(raw || "").trim();
        // Match var(--name) with optional fallback and tolerate missing closing paren.
        const m = s.match(/var\(\s*--([a-z0-9-]+)/i);
        if (m) {
            s = m[1].replace(/^(default|fallback)-/i, "").replace(/-?(font-family|font|family)$/i, "");
            s = s.replace(/[-_]/g, " ").trim();
        }
        // Strip any leftover var( ... fragments
        s = s.replace(/var\([^)]*\)?/gi, "").trim();
        s = s.replace(/^["'`]+|["'`]+$/g, "");
        s = s.replace(/\s+(Variable|VF|Subset|Latin)$/i, "");
        s = s.replace(/\s+/g, " ").trim();
        if (!s || /^(serif|sans-serif|monospace|system-ui|ui-[a-z-]+)$/i.test(s)) return "System Default";
        return s.replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const sectionRule = () => {
        setRGB("draw", RULE);
        doc.setLineWidth(0.5);
        doc.line(M, y, pageW - M, y);
        y += 18;
    };

    const body = (text: string, size = 10.5, lineH = 1.55, color: [number, number, number] = INK_SOFT) => {
        setRGB("text", color);
        doc.setFont(FRAME_BODY, "normal");
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, colW);
        lines.forEach((ln: string) => {
            ensure(size * lineH);
            doc.text(ln, M, y);
            y += size * lineH;
        });
        y += 6;
    };

    const label = (text: string) => {
        setRGB("text", INK_MUTED);
        doc.setFont(FRAME_MONO, "normal");
        doc.setFontSize(8);
        doc.text(text.toUpperCase(), M, y);
        y += 14;
    };

    // ── Cover (page 1) ───────────────────────────────────────────────
    // Sumi background, asymmetric type, washi rule, hanko stamp accent
    setRGB("fill", SUMI);
    doc.rect(0, 0, pageW, pageH, "F");

    // Top frame
    setRGB("text", WASHI);
    doc.setFont(FRAME_MONO, "normal");
    doc.setFontSize(8);
    doc.text("// BRAND GUIDELINES", M, M + 12);
    doc.text(new Date().getFullYear().toString(), pageW - M, M + 12, { align: "right" });

    // Hairline rule
    setRGB("draw", [60, 56, 50]);
    doc.setLineWidth(0.5);
    doc.line(M, M + 24, pageW - M, M + 24);

    // Hanko stamp (small filled square top right with kanji-feel — just a red block)
    setRGB("fill", HANKO);
    doc.rect(pageW - M - 32, pageH / 2 - 200, 32, 32, "F");

    // Display name — wraps on long titles
    setRGB("text", WASHI);
    doc.setFont(FRAME_DISPLAY, FRAME_DISPLAY_BOLD ? "bold" : "normal");
    const titleSize = args.name.length > 20 ? 64 : args.name.length > 12 ? 84 : 108;
    doc.setFontSize(titleSize);
    const titleLines = doc.splitTextToSize(args.name, colW) as string[];
    let ty = pageH / 2 - 40;
    titleLines.forEach((ln) => {
        doc.text(ln, M, ty);
        ty += titleSize * 0.92;
    });

    // Subtitle
    setRGB("text", [180, 172, 158]);
    doc.setFont(FRAME_BODY, "normal");
    doc.setFontSize(11);
    doc.text("The complete brand identity system —", M, ty + 24);
    doc.text("colour, typography, tokens & voice.", M, ty + 40);

    // Bottom frame
    setRGB("draw", [60, 56, 50]);
    doc.line(M, pageH - M - 24, pageW - M, pageH - M - 24);
    setRGB("text", [180, 172, 158]);
    doc.setFont(FRAME_MONO, "normal");
    doc.setFontSize(8);
    doc.text("EDITION 01", M, pageH - M - 8);
    doc.text(slug(args.name).toUpperCase(), pageW - M, pageH - M - 8, { align: "right" });

    // ── Section 01 — Foreword / summary ──────────────────────────────
    newContentPage();
    eyebrow("01.", "Foreword");
    display("A system, not\na style.", 52);
    sectionRule();
    body(
        args.voice?.summary ||
        `${args.name} is built on a small set of decisions made carefully — a palette, a few typefaces, a vocabulary, and the rules that hold them together. This document is the source of truth. Treat it as one.`,
        11,
        1.65,
    );

    // ── Section 02 — Colour ──────────────────────────────────────────
    if (args.colors.length) {
        newContentPage();
        eyebrow("02.", "Colour");
        display("Palette.", 52);
        sectionRule();
        body(
            "The palette is finite by design. Use the primary as the dominant note, secondaries as support, and reserve accents for moments that demand attention. Never introduce colours outside this set.",
            10.5,
        );
        y += 6;

        // Adaptive grid — fit the entire palette on a single page.
        // 3-up for ≤ 9 colours, 4-up otherwise.
        const n = args.colors.length;
        const cols = n <= 9 ? 3 : 4;
        const gap = 14;
        const cardW = (colW - gap * (cols - 1)) / cols;
        const cardH = cols === 3 ? 132 : 110;
        args.colors.forEach((c, i) => {
            const col = i % cols;
            if (col === 0 && i !== 0) y += cardH + gap;
            ensure(cardH + gap);
            const x = M + col * (cardW + gap);
            const rgb = hexToRgb(c.hex);
            const swH = Math.round(cardH * 0.6);
            setRGB("fill", rgb);
            doc.rect(x, y, cardW, swH, "F");
            setRGB("draw", RULE);
            doc.setLineWidth(0.5);
            doc.rect(x, y, cardW, cardH, "S");
            const ix = x + 10;
            let iy = y + swH + 16;
            setRGB("text", INK_MUTED);
            doc.setFont(FRAME_MONO, "normal");
            doc.setFontSize(6.8);
            doc.text(String(c.role ?? "—").toUpperCase(), ix, iy);
            iy += 12;
            setRGB("text", SUMI);
            doc.setFont(FRAME_DISPLAY, FRAME_DISPLAY_BOLD ? "bold" : "normal");
            doc.setFontSize(13);
            const nm = doc.splitTextToSize(c.name || c.role || c.hex, cardW - 20)[0] as string;
            doc.text(nm, ix, iy);
            iy += 12;
            setRGB("text", INK_MUTED);
            doc.setFont(FRAME_MONO, "normal");
            doc.setFontSize(7);
            doc.text(c.hex.toUpperCase(), ix, iy);
        });
        y += cardH + 24;
    }

    // ── Section 02b — Contrast (WCAG) ────────────────────────────────
    if (args.colors.length) {
        newContentPage();
        eyebrow("02b.", "Contrast");
        display("Legible by\nrule, not luck.", 52);
        sectionRule();
        body(
            "Every text/background pairing is judged against WCAG 2.1. Use the pairings below as the source of truth — the Do group is safe for text and meaningful UI, the Don't group is not.",
            10.5,
        );
        y += 6;

        // Two buckets: "Do" (AA and above, ≥ 4.5:1) vs "Don't" (below AA, < 4.5:1).
        const isDo = (r: number) => r >= 4.5;

        // Build unique unordered pairings: palette + white + black.
        type Stop = { name: string; hex: string; rgb: [number, number, number] };
        const stops: Stop[] = [
            ...args.colors.map((c) => ({
                name: (c.name || c.role || c.hex).toString(),
                hex: c.hex.toUpperCase(),
                rgb: hexToRgb(c.hex),
            })),
            { name: "Paper", hex: "#FFFFFF", rgb: [255, 255, 255] },
            { name: "Ink", hex: "#000000", rgb: [0, 0, 0] },
        ];
        const seen = new Set<string>();
        type Pair = { a: Stop; b: Stop; r: number };
        const pairs: Pair[] = [];
        for (let i = 0; i < stops.length; i++) {
            for (let j = i + 1; j < stops.length; j++) {
                const a = stops[i], b = stops[j];
                if (a.hex === b.hex) continue;
                const key = [a.hex, b.hex].sort().join("|");
                if (seen.has(key)) continue;
                seen.add(key);
                pairs.push({ a, b, r: contrastRatio(a.hex, b.hex) });
            }
        }
        // Sort by ratio desc — best pairings read first.
        pairs.sort((x, y2) => y2.r - x.r);

        const doPairs = pairs.filter((p) => isDo(p.r));
        const dontPairs = pairs.filter((p) => !isDo(p.r));

        // 3-up cards. Each: bg color block with "Aa" in fg, then meta strip below.
        const cols = 3;
        const gap = 12;
        const cardW = (colW - gap * (cols - 1)) / cols;
        const swH = 70;
        const metaH = 44;
        const cardH = swH + metaH;

        const drawPairCard = (p: Pair, col: number) => {
            const x = M + col * (cardW + gap);
            const luma = (rgb: [number, number, number]) =>
                0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
            const bg = luma(p.a.rgb) >= luma(p.b.rgb) ? p.a : p.b;
            const fg = bg === p.a ? p.b : p.a;

            setRGB("fill", bg.rgb);
            doc.rect(x, y, cardW, swH, "F");
            setRGB("draw", RULE);
            doc.setLineWidth(0.5);
            doc.rect(x, y, cardW, cardH, "S");
            // "Aa" sample
            setRGB("text", fg.rgb);
            doc.setFont(FRAME_DISPLAY, FRAME_DISPLAY_BOLD ? "bold" : "normal");
            doc.setFontSize(34);
            doc.text("Aa", x + 12, y + swH - 14);
            // Ratio top-right corner of swatch
            doc.setFont(FRAME_MONO, "normal");
            doc.setFontSize(9);
            const ratioStr = `${p.r.toFixed(2)}:1`;
            const rW = doc.getTextWidth(ratioStr);
            doc.text(ratioStr, x + cardW - rW - 10, y + 16);

            // Meta strip — pairing names + hex
            const mx = x + 10;
            const my = y + swH + 16;
            setRGB("text", SUMI);
            doc.setFont(FRAME_BODY, "normal");
            doc.setFontSize(8.5);
            const names = `${fg.name} on ${bg.name}`;
            const nLines = doc.splitTextToSize(names, cardW - 20) as string[];
            doc.text(nLines[0] ?? names, mx, my);
            setRGB("text", INK_MUTED);
            doc.setFont(FRAME_MONO, "normal");
            doc.setFontSize(7);
            doc.text(`${fg.hex} / ${bg.hex}`, mx, my + 12);
        };

        const renderGroup = (title: string, sub: string, list: Pair[], accent: [number, number, number]) => {
            ensure(40);
            // Group header bar
            setRGB("text", accent);
            doc.setFont(FRAME_MONO, "normal");
            doc.setFontSize(9);
            doc.text(title.toUpperCase(), M, y);
            setRGB("text", INK_MUTED);
            doc.text(sub, pageW - M, y, { align: "right" });
            y += 6;
            setRGB("draw", accent);
            doc.setLineWidth(1);
            doc.line(M, y, pageW - M, y);
            y += 18;

            if (!list.length) {
                setRGB("text", INK_MUTED);
                doc.setFont(FRAME_BODY, "italic");
                doc.setFontSize(10);
                doc.text("No pairings in this group.", M, y);
                y += 18;
                return;
            }

            list.forEach((p, i) => {
                const col = i % cols;
                if (col === 0 && i !== 0) y += cardH + gap;
                ensure(cardH + gap);
                drawPairCard(p, col);
            });
            y += cardH + 22;
        };

        renderGroup(
            "Do — use these",
            "AA and above (≥ 4.5 : 1)",
            doPairs,
            [40, 90, 50],
        );
        renderGroup(
            "Don't — avoid for text & UI",
            "Below AA (< 4.5 : 1)",
            dontPairs,
            HANKO,
        );

        // Closing rule for AI/designers.
        ensure(60);
        label("Rule of use");
        body(
            "Pick from the Do group for any text, icon, or meaningful UI. Pairings in the Don't group are reserved for decorative fills only — never body copy, captions, or states that must remain identifiable.",
            10,
            1.55,
        );
    }

    // ── Section 03 — Typography ──────────────────────────────────────
    if (args.fonts.length) {
        newContentPage();
        eyebrow("03.", "Typography");
        display("Voice in\nletterform.", 52);
        sectionRule();
        body(
            "Typography is the system's voice made visible. Each face has a job. Respect role, weight, and tracking — these are not decorative choices.",
            10.5,
        );
        y += 8;

        args.fonts.forEach((f) => {
            ensure(170);
            // role label
            setRGB("text", HANKO);
            doc.setFont(FRAME_MONO, "normal");
            doc.setFontSize(8);
            doc.text(String(f.role ?? "TYPE").toUpperCase(), M, y);
            // family meta right-aligned
            setRGB("text", INK_MUTED);
            const meta = [f.provider || (f.google_font ? "Google Fonts" : ""), f.license || ""]
                .filter(Boolean)
                .join(" — ");
            if (meta) doc.text(meta, pageW - M, y, { align: "right" });
            // Family display in its own face if registered, else frame display.
            const useFamily = registered[f.family]?.ok ? f.family : FRAME_DISPLAY;
            const useBold = registered[f.family]?.bold ?? FRAME_DISPLAY_BOLD;
            const displayName = cleanFamily(f.family);
            setRGB("text", SUMI);
            doc.setFont(useFamily, useBold ? "bold" : "normal");
            doc.setFontSize(34);
            ensure(50);
            // Move baseline well below the role label to avoid overlap.
            y += 38;
            doc.text(displayName, M, y);
            y += 24;

            // alphabet specimen
            doc.setFont(useFamily, "normal");
            doc.setFontSize(14);
            setRGB("text", INK_SOFT);
            const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789";
            const aLines = doc.splitTextToSize(alpha, colW);
            aLines.forEach((ln: string) => {
                ensure(24);
                doc.text(ln, M, y);
                y += 22;
            });
            y += 6;

            // size scale
            [
                { label: "DISPLAY · 32", size: 32 },
                { label: "HEADING · 20", size: 20 },
                { label: "BODY · 12", size: 12 },
            ].forEach((s) => {
                ensure(s.size + 16);
                setRGB("text", INK_MUTED);
                doc.setFont(FRAME_MONO, "normal");
                doc.setFontSize(7.5);
                doc.text(s.label, M, y);
                setRGB("text", SUMI);
                doc.setFont(useFamily, "normal");
                doc.setFontSize(s.size);
                doc.text("The quick brown fox.", M + 90, y + 2);
                y += s.size + 8;
            });

            // divider between fonts
            y += 6;
            setRGB("draw", RULE);
            doc.setLineWidth(0.4);
            doc.line(M, y, pageW - M, y);
            y += 18;
        });
    }

    // ── Section 04 — Tokens ──────────────────────────────────────────
    if (args.tokens.length) {
        newContentPage();
        eyebrow("04.", "Tokens");
        display("The atomic\nlayer.", 52);
        sectionRule();
        body(
            "Tokens are the smallest decisions of the system — spacing, radius, shadow, motion. They make the brand reproducible across surfaces.",
            10.5,
        );
        y += 6;

        const grouped: Record<string, Token[]> = {};
        args.tokens.forEach((t) => ((grouped[t.category] ||= []).push(t)));
        Object.entries(grouped).forEach(([cat, items]) => {
            ensure(40);
            label(cat);
            // 2-column key/value table
            const rowPad = 6;
            const lineH = 12;
            const half = colW / 2;
            const valueW = colW - half - 8;
            items.forEach((t, idx) => {
                doc.setFont(FRAME_MONO, "normal");
                doc.setFontSize(9);
                const valueLines = doc.splitTextToSize(t.value, valueW) as string[];
                const rowH = Math.max(18, valueLines.length * lineH + rowPad);
                ensure(rowH);
                if (idx % 2 === 0) {
                    setRGB("fill", [236, 230, 218]);
                    doc.rect(M - 4, y - 12, colW + 8, rowH, "F");
                }
                setRGB("text", SUMI);
                doc.text(t.name, M, y);
                setRGB("text", INK_SOFT);
                doc.text(valueLines, M + half, y);
                y += rowH;
            });
            y += 14;
        });
    }

    // ── Section 05 — Voice ───────────────────────────────────────────
    if (args.voice) {
        newContentPage();
        eyebrow("05.", "Voice");
        display("How the brand\nspeaks.", 52);
        sectionRule();

        if (args.voice.tone?.length) {
            label("Tone");
            y += 8;
            // chips
            doc.setFont(FRAME_MONO, "normal");
            doc.setFontSize(8.5);
            let cx = M;
            const chipPadX = 10;
            const chipH = 20;
            args.voice.tone.forEach((t: any) => {
                const text = String(t.label ?? t).toUpperCase();
                const w = doc.getTextWidth(text) + chipPadX * 2;
                if (cx + w > pageW - M) {
                    cx = M;
                    y += chipH + 6;
                }
                ensure(chipH + 6);
                setRGB("draw", SUMI);
                doc.setLineWidth(0.6);
                doc.roundedRect(cx, y - chipH + 6, w, chipH, chipH / 2, chipH / 2, "S");
                setRGB("text", SUMI);
                doc.text(text, cx + chipPadX, y);
                cx += w + 6;
            });
            y += chipH + 8;
        }

        if (args.voice.vocabulary?.length) {
            label("Vocabulary");
            body(args.voice.vocabulary.join(" · "), 11, 1.6);
        }

        // Do / Don't grid
        if (args.voice.dos?.length || args.voice.donts?.length) {
            ensure(40);
            const colGap = 16;
            const cw = (colW - colGap) / 2;
            const startY = y;
            // header row
            setRGB("text", HANKO);
            doc.setFont(FRAME_MONO, "normal");
            doc.setFontSize(8);
            doc.text("// DO", M, startY);
            doc.text("// DON'T", M + cw + colGap, startY);
            let yL = startY + 16;
            let yR = startY + 16;
            const writeCol = (items: string[], x: number, startYy: number) => {
                let yy = startYy;
                setRGB("text", SUMI);
                items.forEach((d) => {
                    doc.setFont(FRAME_BODY, "normal");
                    doc.setFontSize(10);
                    const lines = doc.splitTextToSize(`— ${d}`, cw);
                    lines.forEach((ln: string) => {
                        if (yy > pageH - M - 40) return;
                        doc.text(ln, x, yy);
                        yy += 14;
                    });
                    yy += 4;
                });
                return yy;
            };
            yL = writeCol(args.voice.dos ?? [], M, yL);
            yR = writeCol(args.voice.donts ?? [], M + cw + colGap, yR);
            y = Math.max(yL, yR) + 10;
        }

        if (args.voice.samples) {
            ensure(40);
            label("Sample copy");
            Object.entries(args.voice.samples).forEach(([k, v]) => {
                ensure(40);
                setRGB("text", INK_MUTED);
                doc.setFont(FRAME_MONO, "normal");
                doc.setFontSize(7.5);
                doc.text(String(k).replace(/_/g, " ").toUpperCase(), M, y);
                y += 14;
                setRGB("text", SUMI);
                doc.setFont(FRAME_DISPLAY, "normal");
                doc.setFontSize(15);
                const lines = doc.splitTextToSize(`“${v}”`, colW);
                lines.forEach((ln: string) => {
                    ensure(22);
                    doc.text(ln, M, y);
                    y += 20;
                });
                y += 8;
            });
        }
    }

    // ── Closing colophon ─────────────────────────────────────────────
    newContentPage();
    eyebrow("—", "Colophon");
    display("End of\ndocument.", 52);
    sectionRule();
    body(
        `${args.name} brand guidelines. Set in ${FRAME_DISPLAY === "times" ? "Times" : FRAME_DISPLAY}, ${FRAME_BODY === "times" ? "Times" : FRAME_BODY
        } and ${FRAME_MONO === "courier" ? "Courier" : FRAME_MONO}. Generated as a single source of truth — distribute, do not paraphrase.`,
        10,
        1.6,
        INK_MUTED,
    );

    // ── Running header / footer on every page after the cover ────────
    const total = doc.getNumberOfPages();
    for (let p = 2; p <= total; p++) {
        doc.setPage(p);
        // top hairline
        setRGB("draw", RULE);
        doc.setLineWidth(0.4);
        doc.line(M, M + 28, pageW - M, M + 28);
        // running head
        setRGB("text", INK_MUTED);
        doc.setFont(FRAME_MONO, "normal");
        doc.setFontSize(7.5);
        doc.text(`${args.name.toUpperCase()} — BRAND GUIDELINES`, M, M + 18);
        doc.text(`P. ${String(p).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, pageW - M, M + 18, {
            align: "right",
        });
        // bottom hairline + footer
        doc.line(M, pageH - M - 18, pageW - M, pageH - M - 18);
        doc.text("EDITION 01", M, pageH - M - 6);
        // tiny hanko
        setRGB("fill", HANKO);
        doc.rect(pageW / 2 - 3, pageH - M - 12, 6, 6, "F");
        setRGB("text", INK_MUTED);
        doc.text(slug(args.name).toUpperCase(), pageW - M, pageH - M - 6, { align: "right" });
    }

    return doc.output("blob");
}

// Full ZIP bundle: tokens.json, theme.css, tailwind.css, tokens-studio.json, voice.md, brand-guide.pdf, assets/
export async function buildKitZip(args: {
    name: string;
    colors: Color[];
    fonts: Font[];
    tokens: Token[];
    assets: Asset[];
    voice: Voice;
    fontFiles?: FontFileBlob[];
    assetFiles?: AssetFileBlob[];
}): Promise<Blob> {
    const zip = new JSZip();
    const base = slug(args.name);
    zip.file(`${base}-tokens.json`, buildTokensJSON(args));
    zip.file(`${base}.css`, buildCSS(args));
    zip.file(`${base}-tailwind.css`, buildTailwindTheme(args));
    zip.file(`${base}-tokens-studio.json`, buildTokensStudioJSON(args));
    zip.file(`${base}-voice.md`, buildVoiceMarkdown(args.name, args.voice));
    zip.file(`${base}-DESIGN.md`, buildDesignMarkdown(args));
    zip.file(`${base}-brand-guide.pdf`, await buildBrandPDF(args));

    // FONTS.md — always include if there are fonts; explains licensing.
    if (args.fonts.length) {
        zip.file("FONTS.md", buildFontsReadme(args.fonts));
    }

    // Bundle font files (woff2/ttf) for fonts where we have downloadable URLs.
    if (args.fontFiles?.length) {
        const fontsFolder = zip.folder("fonts");
        if (fontsFolder) {
            const byUrl = new Map(args.fontFiles.map((f) => [f.url, f]));
            for (const font of args.fonts) {
                if (!font.file_urls?.length) continue;
                const familySlug = slug(font.source_family ?? font.family);
                const familyFolder = fontsFolder.folder(familySlug);
                if (!familyFolder) continue;
                for (const file of font.file_urls) {
                    const blob = byUrl.get(file.url);
                    if (!blob?.base64) continue;
                    const ext = guessFontExt(file.format, blob.contentType, file.url);
                    const w = (file.weight ?? "400").replace(/[^a-z0-9]+/gi, "");
                    const st = (file.style ?? "normal").replace(/[^a-z0-9]+/gi, "");
                    const filename = `${familySlug}-${w}${st === "normal" ? "" : "-" + st}.${ext}`;
                    familyFolder.file(filename, base64ToUint8(blob.base64));
                }
            }
        }
    }

    // Try to fetch assets (CORS-permitting); skip silently on failure.
    const assetsFolder = zip.folder("assets");
    if (assetsFolder) {
        const preFetched = new Map<string, AssetFileBlob>(
            (args.assetFiles ?? []).filter((a) => a.base64).map((a) => [a.url, a]),
        );
        await Promise.all(
            args.assets.map(async (a, i) => {
                try {
                    const pre = preFetched.get(a.url);
                    if (pre?.base64) {
                        const ext = guessAssetExt(pre.contentType, a.url);
                        assetsFolder.file(
                            `${i + 1}-${slug(a.kind)}.${ext}`,
                            base64ToUint8(pre.base64),
                        );
                        return;
                    }
                    const res = await fetch(a.url);
                    if (!res.ok) return;
                    const blob = await res.blob();
                    const ext = guessAssetExt(blob.type, a.url);
                    assetsFolder.file(`${i + 1}-${slug(a.kind)}.${ext}`, blob);
                } catch {
                    // ignore CORS failures
                }
            }),
        );
    }

    return zip.generateAsync({ type: "blob" });
}

function base64ToUint8(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function guessFontExt(format?: string, contentType?: string, url?: string): string {
    const f = (format ?? "").toLowerCase();
    if (f.includes("woff2")) return "woff2";
    if (f.includes("woff")) return "woff";
    if (f.includes("truetype") || f.includes("ttf")) return "ttf";
    if (f.includes("opentype") || f.includes("otf")) return "otf";
    const ct = (contentType ?? "").toLowerCase();
    if (ct.includes("woff2")) return "woff2";
    if (ct.includes("woff")) return "woff";
    if (ct.includes("ttf") || ct.includes("truetype")) return "ttf";
    if (ct.includes("otf") || ct.includes("opentype")) return "otf";
    const m = (url ?? "").toLowerCase().match(/\.(woff2|woff|ttf|otf)(\?|$)/);
    return m?.[1] ?? "woff2";
}

function guessAssetExt(contentType?: string, url?: string): string {
    const ct = (contentType ?? "").toLowerCase();
    if (ct.includes("svg")) return "svg";
    if (ct.includes("png")) return "png";
    if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
    if (ct.includes("webp")) return "webp";
    if (ct.includes("avif")) return "avif";
    if (ct.includes("gif")) return "gif";
    if (ct.includes("ico") || ct.includes("icon")) return "ico";
    const m = (url ?? "")
        .toLowerCase()
        .match(/\.(svg|png|jpg|jpeg|webp|avif|gif|ico)(\?|#|$)/);
    if (m) return m[1] === "jpeg" ? "jpg" : m[1];
    return "img";
}

export function buildFontsReadme(fonts: Font[]): string {
    const lines: string[] = ["# Fonts in this kit", ""];
    lines.push(
        "This file documents every typeface in your brand kit, where it came from, and what license applies.",
        "",
        "**Read before shipping:** Fonts marked **COMMERCIAL** require a license from their foundry. We do **not** include the original font files for those — only an open-source substitute close in feel. Buy or license the original before using it in production.",
        "",
        "---",
        "",
    );
    for (const f of fonts) {
        const role = f.role ? ` — _${f.role}_` : "";
        lines.push(`## ${f.family}${role}`, "");
        if (f.is_substitute && f.source_family) {
            lines.push(
                `> **Substitute.** The brand actually uses **${f.source_family}**, which is licensed and cannot be redistributed. **${f.family}** is a close open-source stand-in shipped in this kit.`,
                "",
            );
        }
        if (f.license) {
            const tag = f.license.toUpperCase();
            lines.push(`- License: **${tag}**`);
        }
        if (f.provider) lines.push(`- Provider: ${f.provider}`);
        if (f.weights?.length) lines.push(`- Weights: ${f.weights.join(", ")}`);
        if (f.license_note) lines.push(`- Note: ${f.license_note}`);
        if (f.provider_url) lines.push(`- Source: <${f.provider_url}>`);
        if (f.file_urls?.length) {
            const bundled = f.license === "open" ? "Bundled in `/fonts/`." : "Files NOT bundled (license restricted).";
            lines.push(`- Files: ${f.file_urls.length} detected. ${bundled}`);
        }
        lines.push("");
    }
    return lines.join("\n");
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// design.md — full implementation instructions for a designer / developer / AI
// agent. Combines tokens, palette, typography, voice, and usage rules in one file.
export function buildDesignInstructionsMarkdown(args: {
    name: string;
    colors: Color[];
    fonts: Font[];
    tokens: Token[];
    voice: Voice;
}): string {
    const { name, colors, fonts, tokens, voice } = args;
    const L: string[] = [];
    L.push(`# ${name} — Design Instructions`, "");
    L.push(
        `This file is the single source of truth for building anything in the **${name}** brand. Hand it to a designer, a developer, or an AI agent — it contains every token, rule, and sample needed to ship on-brand work.`,
        "",
    );

    L.push("## How to use this kit", "");
    L.push(
        "- Import `tokens.json` (W3C Design Tokens) into Figma via Tokens Studio, or load `<name>.css` / `<name>-tailwind.css` in code.",
        "- Treat colors and fonts below as the **only** approved values. Do not introduce new ones without updating this file.",
        "- Follow the voice guidance for any user-facing copy.",
        "",
    );

    if (colors.length) {
        L.push("## Color palette", "");
        L.push("| Role | Hex | CSS variable |", "| --- | --- | --- |");
        colors.forEach((c) => {
            const role = c.role || c.name || c.hex;
            L.push(`| ${role} | \`${c.hex}\` | \`--color-${role}\` |`);
        });
        L.push("", "**Usage rules:**", "");
        L.push(
            "- Use the `primary` color for the dominant brand surface and primary CTAs.",
            "- Use neutral colors for body text, surfaces, and borders.",
            "- Reserve accent colors for emphasis — never as the dominant color on a page.",
            "- Always check WCAG AA contrast (4.5:1 body, 3:1 large text) before pairing colors.",
            "",
        );
    }

    if (fonts.length) {
        L.push("## Typography", "");
        fonts.forEach((f) => {
            const role = f.role ? f.role.toUpperCase() : "FONT";
            L.push(`### ${role} — ${f.family}`);
            if (f.weights?.length) L.push(`- Weights: ${f.weights.join(", ")}`);
            if (f.provider) L.push(`- Provider: ${f.provider}`);
            if (f.license) L.push(`- License: **${f.license.toUpperCase()}**`);
            if (f.is_substitute && f.source_family) {
                L.push(`- ⚠ Substitute for **${f.source_family}** (license-restricted).`);
            }
            if (f.provider_url) L.push(`- Source: <${f.provider_url}>`);
            L.push(`- CSS: \`var(--font-${f.role || slug(f.family)})\``);
            L.push("");
        });
        L.push(
            "**Usage rules:**",
            "",
            "- Use the display/heading font for h1–h3 and hero copy only.",
            "- Use the body font for paragraphs, labels, and UI.",
            "- Use the mono font for code, numeric data, and technical labels.",
            "- Maintain a clear type scale — do not invent intermediate sizes.",
            "",
        );
    }

    if (tokens.length) {
        L.push("## Design tokens", "");
        const grouped: Record<string, Token[]> = {};
        tokens.forEach((t) => ((grouped[t.category] ||= []).push(t)));
        Object.entries(grouped).forEach(([cat, items]) => {
            L.push(`### ${cat}`, "", "| Name | Value |", "| --- | --- |");
            items.forEach((t) => L.push(`| \`${t.name}\` | \`${t.value}\` |`));
            L.push("");
        });
    }

    if (voice) {
        L.push("## Brand voice", "");
        if (voice.summary) L.push(voice.summary, "");
        if (voice.tone?.length) {
            L.push("**Tone:** " + voice.tone.map((t: any) => t.label).join(", "), "");
        }
        if (voice.vocabulary?.length) {
            L.push("**Vocabulary:** " + voice.vocabulary.join(", "), "");
        }
        if (voice.dos?.length) {
            L.push("### Do", "");
            voice.dos.forEach((d) => L.push(`- ${d}`));
            L.push("");
        }
        if (voice.donts?.length) {
            L.push("### Don't", "");
            voice.donts.forEach((d) => L.push(`- ${d}`));
            L.push("");
        }
        if (voice.samples) {
            L.push("### Sample copy", "");
            Object.entries(voice.samples).forEach(([k, v]) =>
                L.push(`**${k.replace(/_/g, " ")}:** ${v}`, ""),
            );
        }
    }

    L.push("## Checklist before shipping", "");
    L.push(
        "- [ ] All colors used appear in the palette above.",
        "- [ ] Only the approved typefaces are used.",
        "- [ ] Spacing, radius, and shadow values match the tokens.",
        "- [ ] Copy follows the voice guidance.",
        "- [ ] Contrast meets WCAG AA.",
        "",
    );

    return L.join("\n");
}
