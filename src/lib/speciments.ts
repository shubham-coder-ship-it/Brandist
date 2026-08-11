// Specimen shape used by the SpecimenRail on the landing page,
// and a defensive mapper from a brand_kits row (with embedded relations)
// to that shape. All fallbacks are intentional so a partial kit still renders.

export type Specimen = {
    name: string;
    tld: string;
    id: string;
    hex: string[];
    typeMeta: string;
    typeName: string;
    voice: string[];
    time: string;
};

export const demoSpecimens: Specimen[] = [
    {
        name: "Aesop", tld: ".com", id: "#00.418",
        hex: ["1A1A18", "2C2924", "84766B", "C8BFA8", "ECE7DC"],
        typeMeta: "Sg / 1 weight",
        typeName: "Suisse BP Int'l · Times Now",
        voice: ["Considered", "Botanical", "Quiet", "Formal"],
        time: "Extracted 4.18s",
    },
    {
        name: "Hermès", tld: ".com", id: "#00.419",
        hex: ["F37021", "C0501C", "3E2718", "F5EBDA", "FFFFFF"],
        typeMeta: "Serif / 3 weights",
        typeName: "HermesSerif · Diane",
        voice: ["Heritage", "Crafted", "Equestrian", "Confident"],
        time: "Extracted 3.91s",
    },
    {
        name: "Stripe", tld: ".com", id: "#00.420",
        hex: ["635BFF", "0A2540", "425466", "ADBDCC", "F6F9FC"],
        typeMeta: "Sans / 4 weights",
        typeName: "Sohne · Camera Mono",
        voice: ["Technical", "Direct", "Optimistic", "Calm"],
        time: "Extracted 4.42s",
    },
    {
        name: "Loewe", tld: ".com", id: "#00.421",
        hex: ["8B4513", "D4A574", "3A2E1F", "EAE0CD", "FAFAFA"],
        typeMeta: "Display / 2 styles",
        typeName: "Loewe Bespoke · Aktiv",
        voice: ["Tactile", "Surreal", "Spanish", "Witty"],
        time: "Extracted 4.07s",
    },
    {
        name: "A24", tld: ".com", id: "#00.422",
        hex: ["000000", "FF0033", "FFFFFF", "C0C0C0", "1A1A1A"],
        typeMeta: "Mono + Serif",
        typeName: "GT Pressura · Cardinal",
        voice: ["Cinematic", "Cult", "Defiant", "Curated"],
        time: "Extracted 3.74s",
    },
    {
        name: "Dior", tld: ".com", id: "#00.423",
        hex: ["111111", "464343", "9A9492", "D2C9BD", "F5F1EA"],
        typeMeta: "Serif / 2 weights",
        typeName: "Nizzoli · Dior Display",
        voice: ["Couture", "Parisian", "Floral", "Eternal"],
        time: "Extracted 4.31s",
    },
];

const HEX_PAD = ["1A1A18", "2C2924", "84766B", "C8BFA8", "ECE7DC"];

function parseHostname(url: string | null | undefined): { name: string; tld: string } | null {
    if (!url) return null;
    try {
        const u = new URL(url.startsWith("http") ? url : `https://${url}`);
        const host = u.hostname.replace(/^www\./, "");
        const parts = host.split(".");
        if (parts.length < 2) return { name: titleCase(host), tld: "" };
        const tld = "." + parts.slice(-1)[0];
        const name = titleCase(parts.slice(0, -1).join("."));
        return { name, tld };
    } catch {
        return null;
    }
}

function titleCase(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortId(uuid: string | undefined, idx: number): string {
    if (!uuid) return `#00.${String(idx + 1).padStart(3, "0")}`;
    const head = uuid.replace(/-/g, "").slice(0, 6).toUpperCase();
    return `#${head.slice(0, 2)}.${head.slice(2)}`;
}

function normalizeHex(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const h = raw.replace(/^#/, "").trim();
    return /^[0-9a-fA-F]{6}$/.test(h) ? h.toUpperCase() : null;
}

function takeFiveHex(colors: Array<{ hex?: string | null; position?: number | null }> | null | undefined): string[] {
    const sorted = [...(colors ?? [])].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    const out: string[] = [];
    for (const c of sorted) {
        const h = normalizeHex(c.hex);
        if (h) out.push(h);
        if (out.length === 5) break;
    }
    while (out.length < 5) out.push(HEX_PAD[out.length]);
    return out;
}

type FontRow = {
    family?: string | null;
    weights?: string[] | null;
    role?: string | null;
    position?: number | null;
};

function buildTypeMeta(fonts: FontRow[]): string {
    if (!fonts.length) return "Custom";
    const totalWeights = fonts.reduce((n, f) => n + (f.weights?.length ?? 0), 0);
    const family = fonts.length === 1 ? "Family" : `${fonts.length} families`;
    if (totalWeights === 0) return family;
    const weightLabel = totalWeights === 1 ? "1 weight" : `${totalWeights} weights`;
    return `${family} / ${weightLabel}`;
}

function buildTypeName(fonts: FontRow[]): string {
    if (!fonts.length) return "—";
    return fonts
        .slice(0, 2)
        .map((f) => f.family ?? "Custom")
        .join(" · ");
}

function extractVoice(tone: unknown): string[] {
    if (!tone) return ["Distinct"];
    const arr = Array.isArray(tone) ? tone : [];
    const tokens: string[] = [];
    for (const item of arr) {
        if (typeof item === "string") tokens.push(item);
        else if (item && typeof item === "object" && "label" in item && typeof (item as any).label === "string") {
            tokens.push((item as any).label);
        }
        if (tokens.length === 4) break;
    }
    return tokens.length ? tokens : ["Distinct"];
}

function formatExtractTime(createdAt: string | null | undefined): string {
    if (!createdAt) return "Extracted —";
    const ts = Date.parse(createdAt);
    if (Number.isNaN(ts)) return "Extracted —";
    const seconds = Math.max(0, (Date.now() - ts) / 1000);
    if (seconds < 60) return `Extracted ${seconds.toFixed(1)}s ago`;
    if (seconds < 3600) return `Extracted ${Math.round(seconds / 60)}m ago`;
    if (seconds < 86400) return `Extracted ${Math.round(seconds / 3600)}h ago`;
    return `Extracted ${Math.round(seconds / 86400)}d ago`;
}

export type KitRowForSpecimen = {
    id: string;
    name?: string | null;
    source_url?: string | null;
    created_at?: string | null;
    kit_colors?: Array<{ hex?: string | null; position?: number | null }> | null;
    kit_fonts?: FontRow[] | null;
    kit_voice?: { tone?: unknown } | Array<{ tone?: unknown }> | null;
};

export function mapKitToSpecimen(row: KitRowForSpecimen, idx: number): Specimen {
    const parsed = parseHostname(row.source_url);
    const fallbackName = row.name?.trim() || "Untitled";
    const name = parsed?.name ?? fallbackName;
    const tld = parsed?.tld ?? "";

    const voiceRow = Array.isArray(row.kit_voice) ? row.kit_voice[0] : row.kit_voice;
    const fonts = (row.kit_fonts ?? []).slice().sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );

    return {
        name,
        tld,
        id: shortId(row.id, idx),
        hex: takeFiveHex(row.kit_colors),
        typeMeta: buildTypeMeta(fonts),
        typeName: buildTypeName(fonts),
        voice: extractVoice(voiceRow?.tone),
        time: formatExtractTime(row.created_at),
    };
}
