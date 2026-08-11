import { useEffect } from "react";

type FontRecord = {
    family?: string | null;
    source_family?: string | null;
    google_font?: boolean | null;
    weights?: string[] | null;
    file_urls?: Array<{
        url: string;
        weight?: string;
        style?: string;
        format?: string;
    }> | null;
};

function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatFromUrl(url: string, fallback?: string): string {
    const m = /\.(woff2|woff|ttf|otf|eot)(?:\?|#|$)/i.exec(url);
    const ext = (m?.[1] || fallback || "").toLowerCase();
    switch (ext) {
        case "woff2": return "woff2";
        case "woff": return "woff";
        case "ttf": return "truetype";
        case "otf": return "opentype";
        case "eot": return "embedded-opentype";
        default: return "woff2";
    }
}

/**
 * Auto-import the actual fonts a brand uses.
 *  - Google Fonts → inject <link> to fonts.googleapis.com.
 *  - Self-hosted / Fontshare / Bunny / foundry CDN with discovered file_urls
 *    → inject @font-face rules so the original family renders for real.
 *
 * Falls back silently (no font face) when CORS or the host blocks the fetch;
 * the text then renders in whatever fallback the consumer specifies.
 */
export function useAutoImportFonts(fonts: FontRecord[] | undefined | null) {
    useEffect(() => {
        if (typeof document === "undefined" || !fonts?.length) return;

        // 1. Google Fonts
        fonts.forEach((f) => {
            if (!f?.google_font || !f?.family) return;
            const id = `branddna-gf-${slugify(String(f.family))}`;
            if (document.getElementById(id)) return;
            const weights = (Array.isArray(f.weights) && f.weights.length
                ? f.weights
                : ["300", "400", "500", "600", "700"])
                .map((w) => String(w).replace(/[^0-9]/g, ""))
                .filter(Boolean);
            const familyParam = encodeURIComponent(String(f.family)).replace(/%20/g, "+");
            const link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weights.join(";")}&display=swap`;
            document.head.appendChild(link);
        });

        // 2. Self-hosted / discovered file_urls — one @font-face per file.
        const faceRules: string[] = [];
        fonts.forEach((f) => {
            if (!Array.isArray(f?.file_urls) || f!.file_urls!.length === 0) return;
            // Use source_family when present so we render the *original* identity.
            const family = (f.source_family || f.family || "").trim();
            if (!family) return;
            f.file_urls!.slice(0, 24).forEach((file) => {
                if (!file?.url) return;
                const fmt = formatFromUrl(file.url, file.format);
                const weight = (file.weight && /\d/.test(String(file.weight))) ? file.weight : "400";
                const style = file.style && /italic|oblique/i.test(file.style) ? "italic" : "normal";
                faceRules.push(
                    `@font-face{font-family:"${family}";src:url("${file.url}") format("${fmt}");font-weight:${weight};font-style:${style};font-display:swap;}`,
                );
            });
        });

        if (faceRules.length) {
            const id = "branddna-autoimport-faces";
            let style = document.getElementById(id) as HTMLStyleElement | null;
            if (!style) {
                style = document.createElement("style");
                style.id = id;
                document.head.appendChild(style);
            }
            // Append rules instead of replacing so we don't drop earlier kits' faces.
            const existing = style.textContent || "";
            const next = faceRules.filter((r) => !existing.includes(r)).join("");
            if (next) style.textContent = existing + next;
        }
    }, [fonts]);
}

/**
 * The font-family value to actually render with for a kit font record.
 * Prefers the original family when we successfully imported its files,
 * otherwise the (possibly substituted) loadable family.
 */
export function renderFamilyFor(f: FontRecord | null | undefined): string | null {
    if (!f) return null;
    const hasFiles = Array.isArray(f.file_urls) && f.file_urls.length > 0;
    if (hasFiles && f.source_family) return f.source_family;
    return f.family ?? f.source_family ?? null;
}
