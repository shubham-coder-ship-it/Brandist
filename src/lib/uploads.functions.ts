import { createServerFn } from "@tanstack/react-start";
import { getAdmin } from "@/server/supabase-admin.server";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_FILES = 10;
const ALLOWED = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
    "image/gif",
]);

function extFor(name: string, type: string): string {
    const fromName = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    if (fromName) return fromName;
    if (type === "application/pdf") return "pdf";
    if (type === "image/png") return "png";
    if (type === "image/jpeg" || type === "image/jpg") return "jpg";
    if (type === "image/webp") return "webp";
    if (type === "image/svg+xml") return "svg";
    if (type === "image/gif") return "gif";
    return "bin";
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
    try {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        const t: unknown = text;
        if (typeof t === "string") return t;
        if (Array.isArray(t)) return (t as string[]).join("\n\n");
        return "";
    } catch (e) {
        console.warn("[uploads] unpdf failed", e);
        return "";
    }
}

export type UploadResult = {
    imageUrls: string[];
    pdfTexts: string[];
};

// Server fn that accepts FormData with: kitId, ownerToken, file (repeatable)
export const uploadBrandSource = createServerFn({ method: "POST" })
    .inputValidator((data: unknown) => {
        if (!(data instanceof FormData)) throw new Error("Expected FormData");
        const kitId = String(data.get("kitId") ?? "");
        const ownerToken = String(data.get("ownerToken") ?? "");
        if (!kitId || !ownerToken) throw new Error("Missing kitId or ownerToken");
        const files = data.getAll("file").filter((f): f is File => f instanceof File);
        if (files.length === 0) throw new Error("No files attached");
        if (files.length > MAX_FILES) throw new Error(`Too many files (max ${MAX_FILES})`);
        for (const f of files) {
            if (f.size > MAX_BYTES) throw new Error(`"${f.name}" exceeds 20 MB`);
            if (!ALLOWED.has(f.type)) throw new Error(`"${f.name}" type ${f.type || "unknown"} not supported`);
        }
        return { kitId, ownerToken, files };
    })
    .handler(async ({ data }): Promise<UploadResult> => {
        const admin = getAdmin();

        // Shared workspace — confirm kit exists; do not gate on ownership.
        void data.ownerToken;
        const { data: kit, error: kitErr } = await admin
            .from("brand_kits")
            .select("id")
            .eq("id", data.kitId)
            .maybeSingle();
        if (kitErr || !kit) throw new Error("Kit not found");

        const imageUrls: string[] = [];
        const pdfTexts: string[] = [];

        for (const file of data.files) {
            const buf = new Uint8Array(await file.arrayBuffer());
            const ext = extFor(file.name, file.type);
            const path = `${data.kitId}/sources/${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await admin.storage
                .from("brand-assets")
                .upload(path, buf, { contentType: file.type, upsert: false });
            if (upErr) {
                console.error("[uploads] storage upload failed", upErr);
                continue;
            }
            const { data: pub } = admin.storage.from("brand-assets").getPublicUrl(path);
            const publicUrl = pub.publicUrl;

            if (file.type === "application/pdf") {
                const text = await extractPdfText(buf);
                if (text.trim()) {
                    pdfTexts.push(`--- PDF source: ${file.name} ---\n${text.slice(0, 30000)}`);
                }
            } else {
                imageUrls.push(publicUrl);
            }
        }

        return { imageUrls, pdfTexts };
    });
