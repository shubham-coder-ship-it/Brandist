import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdmin } from "@/server/supabase-admin.server";
import { decode as decodePng, encode as encodePng } from "fast-png";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

let resvgInit: Promise<void> | null = null;
async function ensureResvg() {
    if (!resvgInit) {
        resvgInit = (async () => {
            const { initWasm } = await import("@resvg/resvg-wasm");
            const wasmRes = await fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
            if (!wasmRes.ok) throw new Error("Failed to load SVG renderer");
            try {
                await initWasm(await wasmRes.arrayBuffer());
            } catch (e: any) {
                // Wasm singleton persists across HMR / module reloads — treat
                // "Already initialized" as success instead of failing the request.
                if (!String(e?.message || e).includes("Already initialized")) throw e;
            }
        })().catch((e) => {
            resvgInit = null;
            throw e;
        });
    }
    return resvgInit;
}

async function rasterizeSvg(svg: string): Promise<{ buf: Uint8Array; contentType: string }> {
    await ensureResvg();
    const { Resvg } = await import("@resvg/resvg-wasm");
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1024 }, background: "rgba(0,0,0,0)" });
    const png = resvg.render().asPng();
    return { buf: png, contentType: "image/png" };
}

// ---------- Deterministic pixel recoloring ----------
// Decode source PNG, key out a solid background if present, then recolor or
// invert the remaining opaque pixels. Layout, kerning and shapes are preserved
// exactly because we never round-trip through a generative model.

type RGBA = { r: number; g: number; b: number; a: number };

function toRgba8(img: ReturnType<typeof decodePng>): { width: number; height: number; data: Uint8Array } {
    const { width, height, channels, depth } = img;
    const src = img.data as Uint8Array | Uint16Array;
    const out = new Uint8Array(width * height * 4);
    const scale = depth === 16 ? 1 / 257 : 1;
    for (let i = 0, j = 0; i < width * height; i++) {
        const o = i * channels;
        let r = 0, g = 0, b = 0, a = 255;
        if (channels === 1) { r = g = b = src[o] * scale; }
        else if (channels === 2) { r = g = b = src[o] * scale; a = src[o + 1] * scale; }
        else if (channels === 3) { r = src[o] * scale; g = src[o + 1] * scale; b = src[o + 2] * scale; }
        else { r = src[o] * scale; g = src[o + 1] * scale; b = src[o + 2] * scale; a = src[o + 3] * scale; }
        out[j++] = r; out[j++] = g; out[j++] = b; out[j++] = a;
    }
    return { width, height, data: out };
}

function sampleBg(width: number, height: number, data: Uint8Array): RGBA | null {
    // Sample the four corners. If they agree (and are opaque), treat as background.
    const at = (x: number, y: number): RGBA => {
        const o = (y * width + x) * 4;
        return { r: data[o], g: data[o + 1], b: data[o + 2], a: data[o + 3] };
    };
    const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
    if (corners.some((c) => c.a < 250)) return null; // already transparent
    const ref = corners[0];
    for (const c of corners) {
        if (Math.abs(c.r - ref.r) > 12 || Math.abs(c.g - ref.g) > 12 || Math.abs(c.b - ref.b) > 12) return null;
    }
    return ref;
}

function recolorPng(
    pngBytes: Uint8Array,
    mode: "to-color" | "invert",
    target?: { r: number; g: number; b: number },
): { buf: Uint8Array; contentType: string } {
    const decoded = decodePng(pngBytes);
    const { width, height, data } = toRgba8(decoded);
    const bg = sampleBg(width, height, data);
    const tol = 18;
    for (let i = 0; i < width * height; i++) {
        const o = i * 4;
        const r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
        // Key out background → fully transparent
        if (bg && a >= 250 && Math.abs(r - bg.r) <= tol && Math.abs(g - bg.g) <= tol && Math.abs(b - bg.b) <= tol) {
            data[o + 3] = 0;
            continue;
        }
        if (a === 0) continue;
        if (mode === "to-color" && target) {
            // Use the source luminance as alpha to preserve antialiased edges,
            // recoloring every visible pixel to the target colour.
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            // For dark logos on light keying: ink = how dark the source pixel is.
            // Combine with original alpha so semi-transparent pixels stay soft.
            const ink = 1 - lum / 255;
            const finalA = Math.round(Math.min(255, ink * 255) * (a / 255));
            data[o] = target.r; data[o + 1] = target.g; data[o + 2] = target.b; data[o + 3] = finalA;
        } else if (mode === "invert") {
            data[o] = 255 - r; data[o + 1] = 255 - g; data[o + 2] = 255 - b;
        }
    }
    const encoded = encodePng({ width, height, data, channels: 4, depth: 8 });
    return { buf: new Uint8Array(encoded), contentType: "image/png" };
}

function pngBytesFromDataUrl(dataUrl: string): Uint8Array | null {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    if (!m[1].includes("png")) return null;
    return new Uint8Array(Buffer.from(m[2], "base64"));
}

export const VARIANT_PRESETS = {
    "logo-mark": {
        label: "Mark only",
        prompt:
            "Isolate ONLY the logo symbol / icon mark from this image — remove all wordmark text, taglines, and surrounding chrome. Keep the original colors of the mark intact. Output the mark centered on a fully transparent background. Preserve sharp edges and original proportions. Do not add new elements or invent missing geometry.",
    },
    "logo-on-light": {
        label: "On light",
        prompt:
            "Recolor every visible element of this logo (icon AND wordmark text) to solid #0A0A0A as a single flat color. STRICT REQUIREMENTS: (1) Output MUST have a fully transparent alpha background — no white, cream, gray, or colored fill behind anything. (2) Preserve the ENTIRE original composition, full width and height, every letter and symbol — do NOT crop, zoom, or cut off any part of the wordmark. (3) Keep exact shapes, proportions, spacing, and negative space. (4) No shadows, gradients, glows, frames, boxes, or backgrounds of any kind. The output is a flat monochrome black version on transparency.",
    },
    "logo-on-dark": {
        label: "On dark",
        prompt:
            "Recolor every visible element of this logo (icon AND wordmark text) to solid #F4EFE6 as a single flat color. STRICT REQUIREMENTS: (1) Output MUST have a fully transparent alpha background — NO black, dark, gray, or colored fill behind anything. Do not place the logo on a dark rectangle. (2) Preserve the ENTIRE original composition, full width and height, every letter and symbol — do NOT crop, zoom, or cut off any part of the wordmark. (3) Keep exact shapes, proportions, spacing, and negative space. (4) No shadows, gradients, glows, frames, boxes, or backgrounds of any kind. The output is a flat monochrome off-white version on transparency.",
    },
    "logo-inverted": {
        label: "Color inverted",
        prompt:
            "Invert the tonal values of this logo: dark elements become light, light elements become dark; preserve hue relationships of any accent colors. STRICT REQUIREMENTS: (1) Output MUST have a fully transparent alpha background — no rectangle, no fill, no frame behind the logo. (2) Preserve the ENTIRE original composition, full width and height, every letter and symbol — do NOT crop, zoom, or cut off any part of the wordmark. (3) Keep exact shapes, proportions, spacing, and negative space. No shadows, gradients, or extra elements.",
    },
} as const;

export type VariantKey = keyof typeof VARIANT_PRESETS;

const InputSchema = z.object({
    kitId: z.string().uuid(),
    assetId: z.string().uuid(),
    ownerToken: z.string().min(1).max(200),
    variants: z.array(z.enum(["logo-mark", "logo-on-light", "logo-on-dark", "logo-inverted"])).min(1).max(8),
});

async function fetchAsDataUrl(url: string): Promise<string> {
    const { isBlockedSourceUrl } = await import("@/server/url-guard.server");
    if (isBlockedSourceUrl(url)) throw new Error("Source asset URL is not allowed");
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`Source asset fetch failed (${res.status})`);
    let ct = res.headers.get("content-type") ?? "image/png";
    let bytes: Uint8Array = new Uint8Array(await res.arrayBuffer());
    // The AI gateway rejects image/svg+xml. Rasterize SVG → PNG before sending.
    const isSvg =
        ct.includes("svg") ||
        url.toLowerCase().endsWith(".svg") ||
        (bytes.length > 0 && new TextDecoder().decode(bytes.slice(0, 512)).trimStart().toLowerCase().startsWith("<svg")) ||
        (bytes.length > 0 && new TextDecoder().decode(bytes.slice(0, 512)).includes("<svg"));
    if (isSvg) {
        const svgText = new TextDecoder().decode(bytes);
        const png = await rasterizeSvg(svgText);
        bytes = new Uint8Array(png.buf);
        ct = png.contentType;
    }
    const buf = Buffer.from(bytes);
    return `data:${ct};base64,${buf.toString("base64")}`;
}

async function editImage(prompt: string, imageUrl: string): Promise<{ buf: Uint8Array; contentType: string }> {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            modalities: ["image", "text"],
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: imageUrl } },
                    ],
                },
            ],
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        if (res.status === 429) throw new Error("AI rate limit reached. Retry in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted.");
        throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const dataUrl: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.startsWith("data:")) throw new Error("Model returned no image");
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image payload");
    return {
        contentType: match[1],
        buf: new Uint8Array(Buffer.from(match[2], "base64")),
    };
}

export const generateLogoVariants = createServerFn({ method: "POST" })
    .inputValidator((d) => InputSchema.parse(d))
    .handler(async ({ data }) => {
        const admin = getAdmin();

        // Shared workspace: any visitor can act on any kit. Just confirm the kit exists.
        const { data: kit, error: kitErr } = await admin
            .from("brand_kits")
            .select("id")
            .eq("id", data.kitId)
            .maybeSingle();
        if (kitErr || !kit) throw new Error("Kit not found");

        // Source asset (with fallbacks across other logo-ish assets in the kit)
        const { data: source } = await admin
            .from("kit_assets")
            .select("*")
            .eq("id", data.assetId)
            .eq("kit_id", data.kitId)
            .maybeSingle();
        if (!source) throw new Error("Source logo not found");

        // Server-side dedup: skip any variant kind that already exists for this kit.
        // The UI also disables these buttons, but two clients (or a race) could
        // bypass it. The server is the source of truth.
        const { data: existingAssetsForDedup } = await admin
            .from("kit_assets")
            .select("kind")
            .eq("kit_id", data.kitId);
        const existingKinds = new Set<string>(
            (existingAssetsForDedup ?? []).map((a: { kind: string }) => a.kind),
        );
        const requestedVariants = Array.from(new Set(data.variants)) as typeof data.variants;
        const variantsToRun = requestedVariants.filter((k) => !existingKinds.has(k));
        const skippedResults: Array<{ kind: string; ok: boolean; skipped: boolean; error?: string }> = requestedVariants
            .filter((k) => existingKinds.has(k))
            .map((k) => ({ kind: k as string, ok: true, skipped: true }));
        if (!variantsToRun.length) {
            return { ok: true, results: skippedResults };
        }

        const supabaseUrl = process.env.SUPABASE_URL!;
        const urlFor = (a: { storage_path: string | null; url: string | null }) =>
            a.storage_path
                ? `${supabaseUrl}/storage/v1/object/public/brand-assets/${a.storage_path}`
                : a.url;

        // Build candidate list: requested source first, then siblings preferring
        // assets cached in our own storage (remote URLs like vendor CDNs often 404).
        const { data: siblings } = await admin
            .from("kit_assets")
            .select("id, kind, url, storage_path")
            .eq("kit_id", data.kitId);
        const logoSiblings = (siblings ?? [])
            .filter((a: any) => a.id !== source.id && /logo|favicon/i.test(a.kind ?? ""))
            .sort((a: any, b: any) => Number(!!b.storage_path) - Number(!!a.storage_path));
        const candidates = [source, ...logoSiblings];

        let sourceDataUrl: string | null = null;
        let lastErr = "no source URL";
        for (const c of candidates) {
            const u = urlFor(c);
            if (!u) continue;
            try {
                sourceDataUrl = await fetchAsDataUrl(u);
                break;
            } catch (e: any) {
                lastErr = e?.message ?? "fetch failed";
            }
        }
        if (!sourceDataUrl) throw new Error(`Could not load source logo: ${lastErr}`);

        // Find current max position
        const { data: existing } = await admin
            .from("kit_assets")
            .select("position, kind")
            .eq("kit_id", data.kitId)
            .order("position", { ascending: false })
            .limit(1);
        let pos = (existing?.[0]?.position ?? 0) + 1;

        const results: Array<{ kind: string; ok: boolean; error?: string; skipped?: boolean }> = [
            ...skippedResults,
        ];

        // Generate sequentially (image edit is heavy; keep it gentle)
        for (const key of variantsToRun) {
            const preset = VARIANT_PRESETS[key];
            try {
                let buf: Uint8Array;
                let contentType: string;
                // For pure recolor / inversion, edit the actual source pixels so that
                // layout, kerning and shapes are preserved exactly. Only the mark
                // extraction needs the generative model.
                const pngBytes = pngBytesFromDataUrl(sourceDataUrl);
                if (key === "logo-on-light" && pngBytes) {
                    ({ buf, contentType } = recolorPng(pngBytes, "to-color", { r: 0x0a, g: 0x0a, b: 0x0a }));
                } else if (key === "logo-on-dark" && pngBytes) {
                    ({ buf, contentType } = recolorPng(pngBytes, "to-color", { r: 0xf4, g: 0xef, b: 0xe6 }));
                } else if (key === "logo-inverted" && pngBytes) {
                    ({ buf, contentType } = recolorPng(pngBytes, "invert"));
                } else {
                    ({ buf, contentType } = await editImage(preset.prompt, sourceDataUrl));
                }
                const ext = contentType.includes("png")
                    ? "png"
                    : contentType.includes("webp")
                        ? "webp"
                        : contentType.includes("jpeg") || contentType.includes("jpg")
                            ? "jpg"
                            : "png";
                const path = `${data.kitId}/assets/${key}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
                const { error: upErr } = await admin.storage
                    .from("brand-assets")
                    .upload(path, buf, { contentType, upsert: false });
                if (upErr) throw new Error(upErr.message);
                const publicUrl = `${supabaseUrl}/storage/v1/object/public/brand-assets/${path}`;
                const { error: insErr } = await admin.from("kit_assets").insert({
                    kit_id: data.kitId,
                    kind: key,
                    url: publicUrl,
                    storage_path: path,
                    position: pos++,
                });
                if (insErr) throw new Error(insErr.message);
                results.push({ kind: key, ok: true });
            } catch (e: any) {
                results.push({ kind: key, ok: false, error: String(e?.message ?? "failed").slice(0, 200) });
            }
        }

        return { ok: true, results };
    });
