// Deterministic logo / icon discovery: probe well-known icon paths and parse meta tags.
// Returns absolute URLs that pass a HEAD check.

type Probe = { kind: string; url: string };

function abs(href: string, base: string): string | null {
    try { return new URL(href, base).toString(); } catch { return null; }
}

async function head(url: string, timeoutMs = 4000): Promise<boolean> {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) return true;
        // Some hosts reject HEAD; try a tiny ranged GET.
        if (res.status === 405 || res.status === 501) {
            const ctrl2 = new AbortController();
            const t2 = setTimeout(() => ctrl2.abort(), timeoutMs);
            const r2 = await fetch(url, {
                method: "GET",
                headers: { Range: "bytes=0-256" },
                redirect: "follow",
                signal: ctrl2.signal,
            });
            clearTimeout(t2);
            return r2.ok || r2.status === 206;
        }
        return false;
    } catch {
        return false;
    }
}

function metaContent(html: string, attr: "property" | "name", key: string): string | null {
    const re = new RegExp(
        `<meta[^>]+${attr}\\s*=\\s*["']${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}["'][^>]*>`,
        "i",
    );
    const tag = re.exec(html)?.[0];
    if (!tag) return null;
    return /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? null;
}

/**
 * Probe a site for logo / icon assets via deterministic paths and meta tags.
 * Cheap, parallel, fails open.
 */
export async function probeLogos(args: {
    baseUrl: string;
    rawHtml?: string;
}): Promise<Probe[]> {
    const { baseUrl, rawHtml } = args;
    const out: Probe[] = [];
    const seen = new Set<string>();
    const push = (kind: string, u: string | null) => {
        if (!u || seen.has(u)) return;
        seen.add(u);
        out.push({ kind, url: u });
    };

    // 1. Meta tag candidates
    if (rawHtml) {
        const og = metaContent(rawHtml, "property", "og:image") ?? metaContent(rawHtml, "name", "og:image");
        if (og) push("og-image", abs(og, baseUrl));
        const tw = metaContent(rawHtml, "name", "twitter:image");
        if (tw) push("og-image", abs(tw, baseUrl));
        const tile = metaContent(rawHtml, "name", "msapplication-TileImage");
        if (tile) push("logo-mark", abs(tile, baseUrl));
    }

    // 2. Well-known icon paths
    const candidates: Probe[] = [
        { kind: "favicon", url: "/favicon.ico" },
        { kind: "favicon", url: "/favicon.svg" },
        { kind: "favicon", url: "/favicon.png" },
        { kind: "logo-mark", url: "/apple-touch-icon.png" },
        { kind: "logo-mark", url: "/apple-touch-icon-precomposed.png" },
        { kind: "logo-mark", url: "/icon.png" },
        { kind: "logo-mark", url: "/icon.svg" },
        { kind: "logo", url: "/logo.svg" },
        { kind: "logo", url: "/logo.png" },
    ];
    const checks = await Promise.all(
        candidates.map(async (c) => {
            const u = abs(c.url, baseUrl);
            if (!u || seen.has(u)) return null;
            const ok = await head(u);
            return ok ? { kind: c.kind, url: u } : null;
        }),
    );
    for (const c of checks) if (c) push(c.kind, c.url);

    return out;
}