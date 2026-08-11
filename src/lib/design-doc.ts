// Pure parser + diff for DESIGN.md snapshots. No deps.

export type ParsedDesignDoc = {
    palette: {
        light: Record<string, string>;
        dark: Record<string, string>;
    };
    typography: Array<{ role: string; family: string; weight: string; usage: string }>;
    voice: {
        lockedLines: Record<string, string>;
        forbiddenWords: string[];
    };
    neverList: string[];
    rawSections: Record<string, string>;
};

export type DesignDocFieldDiff =
    | { kind: "unchanged"; key: string; value: string }
    | { kind: "added"; key: string; value: string }
    | { kind: "removed"; key: string; value: string }
    | { kind: "changed"; key: string; from: string; to: string };

export type DesignDocSectionDiff = {
    section: string;
    entries: DesignDocFieldDiff[];
};

export type DesignDocDiff = {
    sections: DesignDocSectionDiff[];
};

// ---------- parse ----------

function splitSections(md: string): Record<string, string> {
    const out: Record<string, string> = {};
    const lines = md.split("\n");
    let current = "__preface__";
    let buf: string[] = [];
    for (const line of lines) {
        const m = line.match(/^##\s+(.+?)\s*$/);
        if (m) {
            out[current] = buf.join("\n").trim();
            current = m[1].trim();
            buf = [];
        } else {
            buf.push(line);
        }
    }
    out[current] = buf.join("\n").trim();
    return out;
}

function parsePalette(section: string | undefined): ParsedDesignDoc["palette"] {
    const empty = { light: {}, dark: {} };
    if (!section) return empty;
    const result: ParsedDesignDoc["palette"] = { light: {}, dark: {} };
    // Find subheadings ### Light Mode / ### Dark Mode and their fenced blocks
    const subs = section.split(/^###\s+/m);
    for (const sub of subs) {
        const head = sub.split("\n")[0]?.toLowerCase() ?? "";
        let mode: "light" | "dark" | null = null;
        if (head.includes("light")) mode = "light";
        else if (head.includes("dark")) mode = "dark";
        if (!mode) continue;
        const fence = sub.match(/```[\s\S]*?```/);
        if (!fence) continue;
        const body = fence[0].replace(/```/g, "");
        for (const line of body.split("\n")) {
            const m = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*([^/]+?)\s*(?:\/\*.*\*\/)?\s*;?\s*$/i);
            if (m) result[mode][m[1]] = m[2].trim();
        }
    }
    return result;
}

function parseTypography(section: string | undefined): ParsedDesignDoc["typography"] {
    if (!section) return [];
    const rows: ParsedDesignDoc["typography"] = [];
    const lines = section.split("\n");
    let inTable = false;
    for (const line of lines) {
        if (/^\|\s*Role\s*\|/i.test(line)) {
            inTable = true;
            continue;
        }
        if (inTable && /^\|\s*-+/.test(line)) continue;
        if (inTable) {
            if (!line.trim().startsWith("|")) {
                inTable = false;
                continue;
            }
            const cells = line
                .split("|")
                .slice(1, -1)
                .map((c) => c.trim());
            if (cells.length >= 4) {
                rows.push({ role: cells[0], family: cells[1], weight: cells[2], usage: cells[3] });
            }
        }
    }
    return rows;
}

function parseVoice(section: string | undefined): ParsedDesignDoc["voice"] {
    const out: ParsedDesignDoc["voice"] = { lockedLines: {}, forbiddenWords: [] };
    if (!section) return out;
    // Locked lines: bullets like `- **Hero H1:** "Steal any brand."` or `- Hero H1: \`...\``
    for (const raw of section.split("\n")) {
        const line = raw.trim();
        if (!line.startsWith("-")) continue;
        const m = line.match(
            /^-\s*(?:\*\*)?([A-Za-z0-9 .\/+\-]+?)(?:\*\*)?\s*[:\-—]\s*[`"“'](.+?)[`"”']/
        );
        if (m) out.lockedLines[m[1].trim()] = m[2].trim();
    }
    // Forbidden words: look for a line containing "forbidden" then collect comma-separated words on same/next lines, or bullets after.
    const forbiddenIdx = section
        .split("\n")
        .findIndex((l) => /forbidden/i.test(l));
    if (forbiddenIdx >= 0) {
        const sub = section.split("\n").slice(forbiddenIdx).join("\n");
        const inline = sub.match(/forbidden[^:]*:\s*([^\n]+)/i);
        if (inline) {
            out.forbiddenWords = inline[1]
                .split(/[,;]/)
                .map((w) => w.replace(/[`*."']/g, "").trim())
                .filter(Boolean);
        }
    }
    return out;
}

function parseNeverList(section: string | undefined): string[] {
    if (!section) return [];
    return section
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("- "))
        .map((l) => l.replace(/^-\s+/, "").replace(/\*\*/g, "").trim())
        .filter(Boolean);
}

function findSection(sections: Record<string, string>, needle: string): string | undefined {
    const key = Object.keys(sections).find((k) => k.toLowerCase().includes(needle.toLowerCase()));
    return key ? sections[key] : undefined;
}

export function parseDesignDoc(markdown: string): ParsedDesignDoc {
    const sections = splitSections(markdown);
    return {
        palette: parsePalette(findSection(sections, "Palette")),
        typography: parseTypography(findSection(sections, "Typography")),
        voice: parseVoice(findSection(sections, "Voice") ?? findSection(sections, "Copy")),
        neverList: parseNeverList(findSection(sections, "Never")),
        rawSections: sections,
    };
}

// ---------- diff ----------

function diffRecord(
    a: Record<string, string>,
    b: Record<string, string>
): DesignDocFieldDiff[] {
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    const out: DesignDocFieldDiff[] = [];
    for (const k of keys) {
        const av = a[k];
        const bv = b[k];
        if (av === undefined && bv !== undefined) out.push({ kind: "added", key: k, value: bv });
        else if (av !== undefined && bv === undefined) out.push({ kind: "removed", key: k, value: av });
        else if (av === bv) out.push({ kind: "unchanged", key: k, value: av ?? "" });
        else out.push({ kind: "changed", key: k, from: av ?? "", to: bv ?? "" });
    }
    return out;
}

function diffStringList(a: string[], b: string[]): DesignDocFieldDiff[] {
    const setA = new Set(a);
    const setB = new Set(b);
    const out: DesignDocFieldDiff[] = [];
    for (const v of a) {
        if (setB.has(v)) out.push({ kind: "unchanged", key: v, value: v });
        else out.push({ kind: "removed", key: v, value: v });
    }
    for (const v of b) if (!setA.has(v)) out.push({ kind: "added", key: v, value: v });
    return out;
}

function diffTypography(
    a: ParsedDesignDoc["typography"],
    b: ParsedDesignDoc["typography"]
): DesignDocFieldDiff[] {
    const aMap = Object.fromEntries(a.map((r) => [r.role, `${r.family} · ${r.weight} · ${r.usage}`]));
    const bMap = Object.fromEntries(b.map((r) => [r.role, `${r.family} · ${r.weight} · ${r.usage}`]));
    return diffRecord(aMap, bMap);
}

export function diffDesignDocs(a: ParsedDesignDoc, b: ParsedDesignDoc): DesignDocDiff {
    return {
        sections: [
            { section: "Palette · Light", entries: diffRecord(a.palette.light, b.palette.light) },
            { section: "Palette · Dark", entries: diffRecord(a.palette.dark, b.palette.dark) },
            { section: "Typography", entries: diffTypography(a.typography, b.typography) },
            {
                section: "Voice · Locked lines",
                entries: diffRecord(a.voice.lockedLines, b.voice.lockedLines),
            },
            {
                section: "Voice · Forbidden words",
                entries: diffStringList(a.voice.forbiddenWords, b.voice.forbiddenWords),
            },
            { section: "Never list", entries: diffStringList(a.neverList, b.neverList) },
        ],
    };
}

export function summarizeDiff(diff: DesignDocDiff): { changed: number; added: number; removed: number } {
    let changed = 0;
    let added = 0;
    let removed = 0;
    for (const s of diff.sections) {
        for (const e of s.entries) {
            if (e.kind === "changed") changed++;
            else if (e.kind === "added") added++;
            else if (e.kind === "removed") removed++;
        }
    }
    return { changed, added, removed };
}
