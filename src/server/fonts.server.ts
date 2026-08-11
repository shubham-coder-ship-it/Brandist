// Server-only: detect real fonts from a website's CSS, classify license,
// and locate downloadable font files.

export type DetectedFontFile = {
    url: string;
    weight?: string;
    style?: string;
    format?: string;
};

export type DetectedFont = {
    source_family: string;
    provider:
    | "google"
    | "fontshare"
    | "bunny"
    | "adobe-typekit"
    | "adobe-fonts"
    | "monotype"
    | "self-hosted"
    | "system"
    | "unknown";
    provider_url?: string;
    license: "open" | "commercial" | "unknown";
    license_note?: string;
    file_urls: DetectedFontFile[];
    role?: "heading" | "body" | "mono" | "display";
    weights: string[];
};

const SYSTEM_FONTS = new Set([
    "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded",
    "sans-serif", "serif", "monospace", "cursive", "fantasy",
    "-apple-system", "blinkmacsystemfont", "segoe ui", "helvetica neue",
    "helvetica", "arial", "apple color emoji", "segoe ui emoji", "noto color emoji",
    "inherit", "initial", "unset", "revert",
].map((s) => s.toLowerCase()));

const KNOWN_OPEN_FAMILIES = new Set([
    "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
    "Source Sans 3", "Source Sans Pro", "Source Serif 4", "Source Code Pro",
    "Nunito", "Nunito Sans", "Raleway", "Work Sans", "Manrope", "DM Sans",
    "DM Serif Display", "DM Mono", "Plus Jakarta Sans", "Space Grotesk", "Space Mono",
    "JetBrains Mono", "IBM Plex Sans", "IBM Plex Serif", "IBM Plex Mono",
    "Fira Sans", "Fira Code", "Fira Mono", "Cormorant Garamond", "Libre Baskerville",
    "Libre Franklin", "Courier Prime", "Playfair Display", "Merriweather", "Lora",
    "Crimson Pro", "EB Garamond", "Karla", "Mulish", "Outfit", "Public Sans",
    "Archivo", "Bricolage Grotesque", "Geist", "Geist Mono", "Onest", "Figtree",
    "Hanken Grotesk", "Albert Sans", "Instrument Serif", "Instrument Sans",
    "Fraunces", "Syne", "Bitter", "Cabin", "Inconsolata", "PT Sans", "PT Serif",
    "Quicksand", "Ubuntu", "Ubuntu Mono", "Roboto Mono", "Roboto Slab", "Roboto Condensed",
].map((s) => s.toLowerCase()));

const FONTSHARE_FAMILIES = new Set([
    "Satoshi", "Cabinet Grotesk", "General Sans", "Switzer", "Clash Display",
    "Clash Grotesk", "Erode", "Excon", "Sentient", "Author", "Tanker", "Boska",
    "Synonym", "Ranade", "Supreme",
].map((s) => s.toLowerCase()));

const COMMERCIAL_FAMILIES: Record<string, { foundry: string; url: string }> = {
    "söhne": { foundry: "Klim Type Foundry", url: "https://klim.co.nz/retail-fonts/soehne/" },
    "sohne": { foundry: "Klim Type Foundry", url: "https://klim.co.nz/retail-fonts/soehne/" },
    "söhne mono": { foundry: "Klim Type Foundry", url: "https://klim.co.nz/retail-fonts/soehne-mono/" },
    "national 2": { foundry: "Klim Type Foundry", url: "https://klim.co.nz/retail-fonts/national-2/" },
    "tiempos": { foundry: "Klim Type Foundry", url: "https://klim.co.nz/retail-fonts/tiempos/" },
    "founders grotesk": { foundry: "Klim Type Foundry", url: "https://klim.co.nz/retail-fonts/founders-grotesk/" },
    "calibre": { foundry: "Klim Type Foundry", url: "https://klim.co.nz/retail-fonts/calibre/" },
    "gt america": { foundry: "Grilli Type", url: "https://www.grillitype.com/typeface/gt-america" },
    "gt walsheim": { foundry: "Grilli Type", url: "https://www.grillitype.com/typeface/gt-walsheim" },
    "gt sectra": { foundry: "Grilli Type", url: "https://www.grillitype.com/typeface/gt-sectra" },
    "gt super": { foundry: "Grilli Type", url: "https://www.grillitype.com/typeface/gt-super" },
    "graphik": { foundry: "Commercial Type", url: "https://commercialtype.com/catalog/graphik" },
    "publico": { foundry: "Commercial Type", url: "https://commercialtype.com/catalog/publico" },
    "neue haas grotesk": { foundry: "Linotype", url: "https://www.linotype.com/" },
    "neue haas unica": { foundry: "Monotype", url: "https://www.monotype.com/fonts/neue-haas-unica" },
    "helvetica": { foundry: "Monotype", url: "https://www.monotype.com/fonts/helvetica" },
    "helvetica now": { foundry: "Monotype", url: "https://www.monotype.com/fonts/helvetica-now" },
    "futura": { foundry: "Monotype", url: "https://www.monotype.com/fonts/futura" },
    "avenir": { foundry: "Monotype", url: "https://www.monotype.com/fonts/avenir" },
    "avenir next": { foundry: "Monotype", url: "https://www.monotype.com/fonts/avenir-next" },
    "proxima nova": { foundry: "Mark Simonson Studio", url: "https://www.marksimonson.com/fonts/view/proxima-nova" },
    "proxima": { foundry: "Mark Simonson Studio", url: "https://www.marksimonson.com/fonts/view/proxima-nova" },
    "circular": { foundry: "Lineto", url: "https://lineto.com/typefaces/circular" },
    "circular std": { foundry: "Lineto", url: "https://lineto.com/typefaces/circular" },
    "brown": { foundry: "Lineto", url: "https://lineto.com/typefaces/brown" },
    "akzidenz-grotesk": { foundry: "Berthold", url: "https://www.bertholdtypes.com/" },
    "fk grotesk": { foundry: "Florian Karsten Typefaces", url: "https://floriankarsten.com/fk-grotesk" },
    "fk display": { foundry: "Florian Karsten Typefaces", url: "https://floriankarsten.com/" },
    "larsseit": { foundry: "Type Dynamic", url: "https://www.myfonts.com/" },
    "neue montreal": { foundry: "Pangram Pangram", url: "https://pangrampangram.com/products/neue-montreal" },
    "pp neue montreal": { foundry: "Pangram Pangram", url: "https://pangrampangram.com/products/neue-montreal" },
    "pp editorial new": { foundry: "Pangram Pangram", url: "https://pangrampangram.com/products/editorial-new" },
    "pp mori": { foundry: "Pangram Pangram", url: "https://pangrampangram.com/products/mori" },
};

export const COMMERCIAL_SUBSTITUTES: Record<string, string> = {
    "söhne": "Inter",
    "sohne": "Inter",
    "söhne mono": "JetBrains Mono",
    "national 2": "Inter",
    "tiempos": "Source Serif 4",
    "founders grotesk": "Space Grotesk",
    "calibre": "Public Sans",
    "gt america": "Inter",
    "gt walsheim": "DM Sans",
    "gt sectra": "Fraunces",
    "gt super": "Fraunces",
    "graphik": "Inter",
    "publico": "Source Serif 4",
    "helvetica": "Inter",
    "helvetica now": "Inter",
    "futura": "Outfit",
    "avenir": "Nunito Sans",
    "avenir next": "Nunito Sans",
    "proxima nova": "Mulish",
    "proxima": "Mulish",
    "circular": "DM Sans",
    "circular std": "DM Sans",
    "brown": "Hanken Grotesk",
    "akzidenz-grotesk": "Inter",
    "fk grotesk": "Inter",
    "fk display": "Bricolage Grotesque",
    "larsseit": "Plus Jakarta Sans",
    "neue montreal": "Geist",
    "pp neue montreal": "Geist",
    "pp editorial new": "Fraunces",
    "pp mori": "Manrope",
};

function classify(family: string, fileHostHints: string[] = []): {
    provider: DetectedFont["provider"];
    license: DetectedFont["license"];
    provider_url?: string;
    license_note?: string;
} {
    const f = family.toLowerCase().replace(/^["']|["']$/g, "").trim();

    for (const host of fileHostHints) {
        const h = host.toLowerCase();
        if (h.includes("fonts.gstatic") || h.includes("fonts.googleapis"))
            return {
                provider: "google",
                license: "open",
                provider_url: `https://fonts.google.com/specimen/${encodeURIComponent(family.replace(/\s+/g, "+"))}`,
                license_note: "SIL Open Font License — free for commercial use.",
            };
        if (h.includes("fontshare"))
            return {
                provider: "fontshare",
                license: "open",
                provider_url: `https://www.fontshare.com/fonts/${family.toLowerCase().replace(/\s+/g, "-")}`,
                license_note: "Fontshare license — free for commercial use.",
            };
        if (h.includes("fonts.bunny.net"))
            return {
                provider: "bunny",
                license: "open",
                provider_url: `https://fonts.bunny.net/family/${family.toLowerCase().replace(/\s+/g, "-")}`,
                license_note: "Bunny Fonts (open source).",
            };
        if (h.includes("typekit") || h.includes("use.typekit") || h.includes("adobe"))
            return {
                provider: "adobe-typekit",
                license: "commercial",
                provider_url: "https://fonts.adobe.com/",
                license_note: "Adobe Fonts — requires Creative Cloud subscription.",
            };
    }

    if (COMMERCIAL_FAMILIES[f]) {
        return {
            provider: "monotype",
            license: "commercial",
            provider_url: COMMERCIAL_FAMILIES[f].url,
            license_note: `Licensed font from ${COMMERCIAL_FAMILIES[f].foundry}. Original files require purchase.`,
        };
    }
    if (KNOWN_OPEN_FAMILIES.has(f))
        return {
            provider: "google",
            license: "open",
            provider_url: `https://fonts.google.com/specimen/${encodeURIComponent(family.replace(/\s+/g, "+"))}`,
            license_note: "Open license (SIL OFL or similar).",
        };
    if (FONTSHARE_FAMILIES.has(f))
        return {
            provider: "fontshare",
            license: "open",
            provider_url: `https://www.fontshare.com/fonts/${family.toLowerCase().replace(/\s+/g, "-")}`,
            license_note: "Fontshare license — free for commercial use.",
        };
    if (SYSTEM_FONTS.has(f)) return { provider: "system", license: "open" };
    return { provider: "unknown", license: "unknown" };
}

function unquote(s: string) {
    return s.trim().replace(/^["']|["']$/g, "").trim();
}

function extractFamiliesFromCSS(css: string): string[] {
    const out: string[] = [];
    const re = /font-family\s*:\s*([^;}]+)[;}]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css))) {
        const list = m[1].split(",").map((s) => unquote(s.trim()));
        if (list[0]) out.push(list[0]);
    }
    return out;
}

type FontFaceEntry = {
    family: string;
    files: DetectedFontFile[];
    weights: Set<string>;
};

function parseFontFace(css: string): FontFaceEntry[] {
    const map = new Map<string, FontFaceEntry>();
    const blockRe = /@font-face\s*{([^}]+)}/gi;
    let b: RegExpExecArray | null;
    while ((b = blockRe.exec(css))) {
        const block = b[1];
        const fam = /font-family\s*:\s*([^;]+);/i.exec(block)?.[1];
        const wt = /font-weight\s*:\s*([^;]+);/i.exec(block)?.[1]?.trim() ?? "400";
        const st = /font-style\s*:\s*([^;]+);/i.exec(block)?.[1]?.trim() ?? "normal";
        const srcLine = /src\s*:\s*([^;]+);/i.exec(block)?.[1] ?? "";
        if (!fam) continue;
        const family = unquote(fam);
        const key = family.toLowerCase();
        if (!map.has(key)) map.set(key, { family, files: [], weights: new Set() });
        const entry = map.get(key)!;
        entry.weights.add(wt);
        const urlRe = /url\(\s*["']?([^"')]+)["']?\s*\)\s*(?:format\(\s*["']?([^"')]+)["']?\s*\))?/gi;
        let u: RegExpExecArray | null;
        while ((u = urlRe.exec(srcLine))) {
            entry.files.push({ url: u[1], weight: wt, style: st, format: u[2] });
        }
    }
    return Array.from(map.values());
}

function absolutize(url: string, base: string): string {
    try { return new URL(url, base).toString(); } catch { return url; }
}

async function fetchText(url: string, timeoutMs = 6000): Promise<string | null> {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(url, {
            signal: ctrl.signal,
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 (compatible; BrandDNAFontDetector/1.0)" },
        });
        clearTimeout(t);
        if (!res.ok) return null;
        return await res.text();
    } catch { return null; }
}

export async function detectFontsFromSite(args: {
    url?: string;
    rawHtml?: string;
}): Promise<DetectedFont[]> {
    const baseUrl = args.url ?? "";
    let html = args.rawHtml ?? null;
    if (!html && args.url) html = await fetchText(args.url, 8000);
    if (!html) return [];

    const cssLinks: string[] = [];
    const linkRe = /<link[^>]+>/gi;
    let lk: RegExpExecArray | null;
    while ((lk = linkRe.exec(html))) {
        const tag = lk[0];
        const rel = /rel\s*=\s*["']?([^"'>\s]+)/i.exec(tag)?.[1]?.toLowerCase();
        const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
        if (!href) continue;
        if (rel === "stylesheet" || /fonts?\.|typekit|fontshare|bunny\.net/i.test(href)) {
            cssLinks.push(absolutize(href, baseUrl || href));
        }
    }

    const inlineCss: string[] = [];
    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let st: RegExpExecArray | null;
    while ((st = styleRe.exec(html))) inlineCss.push(st[1]);

    const externalCss = await Promise.all(
        cssLinks.slice(0, 8).map(async (u) => ({ url: u, css: await fetchText(u, 5000) })),
    );

    const cssBlocks: Array<{ css: string; sourceUrl?: string }> = [
        ...inlineCss.map((c) => ({ css: c })),
        ...externalCss.filter((c) => !!c.css).map((c) => ({ css: c.css!, sourceUrl: c.url })),
    ];

    const allFaces = new Map<string, FontFaceEntry>();
    for (const block of cssBlocks) {
        const faces = parseFontFace(block.css);
        for (const f of faces) {
            const key = f.family.toLowerCase();
            if (!allFaces.has(key)) allFaces.set(key, { family: f.family, files: [], weights: new Set() });
            const target = allFaces.get(key)!;
            f.weights.forEach((w) => target.weights.add(w));
            for (const file of f.files) {
                target.files.push({ ...file, url: absolutize(file.url, block.sourceUrl ?? baseUrl) });
            }
        }
    }

    const usedFamilies = new Set<string>();
    for (const block of cssBlocks) {
        for (const fam of extractFamiliesFromCSS(block.css)) {
            const norm = unquote(fam);
            if (!norm) continue;
            const lc = norm.toLowerCase();
            if (SYSTEM_FONTS.has(lc)) continue;
            usedFamilies.add(norm);
        }
    }

    const linkHostHints: string[] = [];
    for (const link of cssLinks) {
        try { linkHostHints.push(new URL(link).host); } catch { /* ignore */ }
    }

    const result = new Map<string, DetectedFont>();

    for (const fam of usedFamilies) {
        const key = fam.toLowerCase();
        const face = allFaces.get(key);
        const fileHints = [
            ...(face?.files.map((f) => { try { return new URL(f.url).host; } catch { return ""; } }) ?? []),
            ...linkHostHints,
        ];
        const cls = classify(fam, fileHints);
        result.set(key, {
            source_family: fam,
            provider: cls.provider,
            provider_url: cls.provider_url,
            license: cls.license,
            license_note: cls.license_note,
            file_urls: face?.files ?? [],
            weights: face ? Array.from(face.weights) : [],
        });
    }

    for (const [key, face] of allFaces) {
        if (result.has(key)) continue;
        const fileHints = face.files.map((f) => { try { return new URL(f.url).host; } catch { return ""; } });
        const cls = classify(face.family, fileHints);
        result.set(key, {
            source_family: face.family,
            provider: cls.provider,
            provider_url: cls.provider_url,
            license: cls.license,
            license_note: cls.license_note,
            file_urls: face.files,
            weights: Array.from(face.weights),
        });
    }

    const detected = Array.from(result.values()).filter((f) => f.provider !== "system");
    detected.sort((a, b) => (b.file_urls.length > 0 ? 1 : 0) - (a.file_urls.length > 0 ? 1 : 0));
    return detected.slice(0, 8);
}

export function substituteFor(family: string): string | null {
    const lc = family.toLowerCase();
    return COMMERCIAL_SUBSTITUTES[lc] ?? null;
}
