import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isBlockedSourceUrl } from "@/server/url-guard.server";

const InputSchema = z.object({
    urls: z.array(z.string().url()).max(60),
});

export type AssetFileResult = {
    url: string;
    ok: boolean;
    contentType?: string;
    base64?: string;
    size?: number;
};

// Proxy fetch arbitrary remote assets server-side (bypasses CORS) and
// return base64 so the client can stuff them into the kit zip.
export const fetchAssetFiles = createServerFn({ method: "POST" })
    .inputValidator((d) => InputSchema.parse(d))
    .handler(async ({ data }): Promise<{ files: AssetFileResult[] }> => {
        const files = await Promise.all(
            data.urls.map(async (url): Promise<AssetFileResult> => {
                try {
                    if (isBlockedSourceUrl(url)) return { url, ok: false };
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), 10000);
                    const res = await fetch(url, {
                        signal: ctrl.signal,
                        redirect: "follow",
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                            Accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.9,*/*;q=0.8",
                        },
                    });
                    clearTimeout(t);
                    if (!res.ok) return { url, ok: false };
                    const buf = new Uint8Array(await res.arrayBuffer());
                    // 8 MB ceiling per asset to keep the bundle sane.
                    if (buf.byteLength > 8 * 1024 * 1024) return { url, ok: false };
                    let bin = "";
                    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
                    return {
                        url,
                        ok: true,
                        contentType: res.headers.get("content-type") ?? "application/octet-stream",
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