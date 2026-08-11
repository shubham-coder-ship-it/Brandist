// Extract colors from raw HTML + CSS with frequency counts.
// Server-only. Pure regex; works in Worker runtime.

const HEX_RE = /#([0-9a-f]{3,8})\b/gi;
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/gi;
const HSL_RE = /hsla?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)%\s*[,\s]\s*(\d+(?:\.\d+)?)%/gi;

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function rgbToHex(r: number, g: number, b: number): string {
    const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function expandHex(raw: string): string | null {
    const h = raw.toLowerCase();
    if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`; // ignore alpha for grouping
    if (h.length === 6) return `#${h}`;
    if (h.length === 8) return `#${h.slice(0, 6)}`; // strip alpha
    return null;
}

// Property-aware weights — surfaces and CTAs matter more than borders.
const PROP_WEIGHTS: Array<[RegExp, number]> = [
    [/\bbackground(?:-color)?\s*:/i, 4],
    [/\bcolor\s*:/i, 3],
    [/\bfill\s*=/i, 2.5],
    [/\bstroke\s*=/i, 1.2],
    [/\bborder(?:-[a-z]+)?-color\s*:/i, 1],
    [/--[a-z0-9-]+\s*:/i, 2.5], // CSS custom properties — usually brand tokens
];

function weightForContext(snippet: string): number {
    for (const [re, w] of PROP_WEIGHTS) if (re.test(snippet)) return w;
    return 0.6;
}

// Reject near-grayscale and near-black/white as "neutral", they dominate every site.
function isNeutral(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    return chroma < 12;
}

export type ColorObservation = {
    hex: string;
    weight: number;
    isNeutral: boolean;
};

/**
 * Scan HTML + CSS text for colors. Returns colors ranked by weighted frequency.
 * Includes neutrals but flags them so the consumer can choose to include/exclude.
 */
export function extractColorsFromText(text: string, limit = 24): ColorObservation[] {
    if (!text) return [];
    const counts = new Map<string, number>();

    const tally = (hex: string, ctx: string) => {
        const w = weightForContext(ctx);
        counts.set(hex, (counts.get(hex) ?? 0) + w);
    };

    // Walk tokens with ~80 chars of leading context for property weighting.
    const scan = (re: RegExp, toHex: (m: RegExpExecArray) => string | null) => {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
            const hex = toHex(m);
            if (!hex) continue;
            const start = Math.max(0, m.index - 80);
            const ctx = text.slice(start, m.index + m[0].length);
            tally(hex, ctx);
        }
    };

    scan(HEX_RE, (m) => expandHex(m[1]));
    scan(RGB_RE, (m) => rgbToHex(+m[1], +m[2], +m[3]));
    scan(HSL_RE, (m) => hslToHex(+m[1], +m[2], +m[3]));

    return [...counts.entries()]
        .map(([hex, weight]) => ({ hex, weight, isNeutral: isNeutral(hex) }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, limit);
}