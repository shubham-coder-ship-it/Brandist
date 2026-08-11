import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isBlockedSourceUrl } from "@/server/url-guard.server";

const InputSchema = z.object({
    urls: z.array(z.string().url()).max(40),
});

export type FontFileResult = {
    url: string;
    ok: boolean;
    contentType?: string;
    base64?: string;
    size?: number;
};

// Proxy fetch font files server-side (bypasses CORS) and return base64.
export const fetchFontFiles = createServerFn({ method: "POST" })
    .inputValidator((d) => InputSchema.parse(d))
    .handler(async ({ data }): Promise<{ files: FontFileResult[] }> => {
        const files = await Promise.all(
            data.urls.map(async (url): Promise<FontFileResult> => {
                try {
                    if (isBlockedSourceUrl(url)) return { url, ok: false };
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), 8000);
                    const res = await fetch(url, {
                        signal: ctrl.signal,
                        redirect: "follow",
                        headers: {
                            // Some font CDNs (Google Fonts) return woff2 only when UA suggests modern browser
                            "User-Agent":
                                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                        },
                    });
                    clearTimeout(t);
                    if (!res.ok) return { url, ok: false };
                    const buf = new Uint8Array(await res.arrayBuffer());
                    if (buf.byteLength > 4 * 1024 * 1024) return { url, ok: false };
                    let bin = "";
                    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
                    return {
                        url,
                        ok: true,
                        contentType: res.headers.get("content-type") ?? "font/woff2",
                        base64: btoa(bin),
                        size: buf.byteLength,
                    };
                } catch {
                    return { url, ok: false };
                }
            }),
        );
        return { files };
    });

const GoogleInputSchema = z.object({
    family: z.string().min(1).max(120),
    weights: z.array(z.string().max(8)).max(20).optional(),
});

// Resolve actual woff2 file URLs for a Google Font family by fetching its
// css2 stylesheet (with a modern UA so Google returns woff2 instead of ttf).
export const resolveGoogleFontFiles = createServerFn({ method: "POST" })
    .inputValidator((d) => GoogleInputSchema.parse(d))
    .handler(async ({ data }): Promise<{ urls: string[] }> => {
        try {
            const weights = (data.weights && data.weights.length
                ? data.weights
                : ["300", "400", "500", "600", "700"])
                .map((w) => String(w).replace(/[^0-9]/g, ""))
                .filter(Boolean);
            const familyParam = encodeURIComponent(data.family).replace(/%20/g, "+");
            const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weights.join(";")}&display=swap`;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 6000);
            const res = await fetch(cssUrl, {
                signal: ctrl.signal,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                },
            });
            clearTimeout(t);
            if (!res.ok) return { urls: [] };
            const css = await res.text();
            const urls = new Set<string>();
            const re = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(css))) urls.add(m[1]);
            return { urls: Array.from(urls).slice(0, 40) };
        } catch {
            return { urls: [] };
        }
    });
