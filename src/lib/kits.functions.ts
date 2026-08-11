import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdmin } from "@/server/supabase-admin.server";

const STALE_PROCESSING_MS = 90 * 1000;

// Tiny no-op used to warm the Cloudflare Worker on page load so that the
// first real `createKit` / `extractKit` call doesn't pay cold-start cost.
export const warmServer = createServerFn({ method: "GET" }).handler(async () => {
    return { ok: true, t: Date.now() };
});

// Create a kit row (anonymous or owned). Returns kit id + anon token if anon.
export const createKit = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            ownerToken: z.string().min(1).max(200), // anon token from client OR auth user id
            isAuthed: z.boolean(),
            sourceType: z.enum(["url", "upload", "manual", "mixed"]),
            sourceUrl: z.string().url().optional(),
            name: z.string().max(120).optional(),
        }).parse,
    )
    .handler(async ({ data }) => {
        const admin = getAdmin();
        const row: Record<string, any> = {
            name: data.name ?? "Untitled brand kit",
            source_type: data.sourceType,
            source_url: data.sourceUrl ?? null,
            status: "pending",
        };
        if (data.isAuthed) row.user_id = data.ownerToken;
        else row.anon_token = data.ownerToken;

        const { data: created, error } = await admin
            .from("brand_kits")
            .insert(row)
            .select("id")
            .single();
        if (error || !created) throw new Error(error?.message ?? "Failed to create kit");
        return { id: (created as any).id as string };
    });

// Fetch a kit + all related data, gated by owner token or share token.
export const getKit = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            kitId: z.string().uuid(),
            ownerToken: z.string().min(1).max(200).optional(),
            shareToken: z.string().min(1).max(200).optional(),
        }).parse,
    )
    .handler(async ({ data }) => {
        const admin = getAdmin();
        const { data: kit } = await admin
            .from("brand_kits")
            .select("*")
            .eq("id", data.kitId)
            .maybeSingle();
        if (!kit) throw new Error("Kit not found");
        let k = kit as any;
        // Personal app — no auth gate. Anyone with the link can view/edit.

        const updatedAt = k.updated_at ? Date.parse(k.updated_at) : Date.now();
        if (
            (k.status === "pending" || k.status === "processing") &&
            Date.now() - updatedAt > STALE_PROCESSING_MS
        ) {
            const message = "Extraction timed out before completion. Retry will restart it.";
            await admin
                .from("brand_kits")
                .update({ status: "error", error_code: "timeout", error_message: message })
                .eq("id", data.kitId);
            k = { ...k, status: "error", error_code: "timeout", error_message: message };
        }

        const [colors, fonts, tokens, assets, voice] = await Promise.all([
            admin.from("kit_colors").select("*").eq("kit_id", data.kitId).order("position"),
            admin.from("kit_fonts").select("*").eq("kit_id", data.kitId).order("position"),
            admin.from("kit_tokens").select("*").eq("kit_id", data.kitId).order("position"),
            admin.from("kit_assets").select("*").eq("kit_id", data.kitId).order("position"),
            admin.from("kit_voice").select("*").eq("kit_id", data.kitId).maybeSingle(),
        ]);

        return {
            kit: k,
            colors: colors.data ?? [],
            fonts: fonts.data ?? [],
            tokens: tokens.data ?? [],
            assets: assets.data ?? [],
            voice: voice.data ?? null,
        };
    });

// Helper: verify ownership of a kit
async function loadOwnedKit(kitId: string, ownerToken: string) {
    const admin = getAdmin();
    const { data: kit } = await admin
        .from("brand_kits")
        .select("*")
        .eq("id", kitId)
        .maybeSingle();
    if (!kit) throw new Error("Kit not found");
    // Personal app — no ownership gate.
    return kit as any;
}

export const renameKit = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            kitId: z.string().uuid(),
            ownerToken: z.string().min(1).max(200),
            name: z.string().min(1).max(120),
        }).parse,
    )
    .handler(async ({ data }) => {
        const admin = getAdmin();
        await loadOwnedKit(data.kitId, data.ownerToken);
        const { error } = await admin
            .from("brand_kits")
            .update({ name: data.name })
            .eq("id", data.kitId);
        if (error) throw new Error(error.message);
        return { ok: true };
    });

export const deleteKit = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            kitId: z.string().uuid(),
            ownerToken: z.string().min(1).max(200),
        }).parse,
    )
    .handler(async ({ data }) => {
        const admin = getAdmin();
        await loadOwnedKit(data.kitId, data.ownerToken);
        // Explicit child cleanup (no FK cascade defined)
        await Promise.all([
            admin.from("kit_colors").delete().eq("kit_id", data.kitId),
            admin.from("kit_fonts").delete().eq("kit_id", data.kitId),
            admin.from("kit_tokens").delete().eq("kit_id", data.kitId),
            admin.from("kit_assets").delete().eq("kit_id", data.kitId),
            admin.from("kit_voice").delete().eq("kit_id", data.kitId),
        ]);
        const { error } = await admin.from("brand_kits").delete().eq("id", data.kitId);
        if (error) throw new Error(error.message);
        return { ok: true };
    });

export const duplicateKit = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            kitId: z.string().uuid(),
            ownerToken: z.string().min(1).max(200),
        }).parse,
    )
    .handler(async ({ data }) => {
        const admin = getAdmin();
        const src = await loadOwnedKit(data.kitId, data.ownerToken);
        const { id: _omitId, created_at: _ca, updated_at: _ua, share_token: _st, ...rest } = src as any;
        const insertRow = {
            ...rest,
            name: `${src.name ?? "Untitled"} (copy)`,
            share_token: null,
            is_public: false,
        };
        const { data: created, error } = await admin
            .from("brand_kits")
            .insert(insertRow)
            .select("*")
            .single();
        if (error || !created) throw new Error(error?.message ?? "Failed to duplicate kit");
        const newId = (created as any).id as string;

        async function copyChildren(table: string) {
            const { data: rows } = await admin.from(table).select("*").eq("kit_id", data.kitId);
            if (!rows || rows.length === 0) return;
            const cleaned = rows.map((r: any) => {
                const { id, created_at, updated_at, ...rest } = r;
                return { ...rest, kit_id: newId };
            });
            await admin.from(table).insert(cleaned);
        }
        await Promise.all([
            copyChildren("kit_colors"),
            copyChildren("kit_fonts"),
            copyChildren("kit_tokens"),
            copyChildren("kit_assets"),
            copyChildren("kit_voice"),
        ]);

        return { kit: created };
    });

// List all kits owned by the given token (anon or user id).
export const listKitsByOwner = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            ownerToken: z.string().min(1).max(200),
            // Optional: include older anon tokens this browser has used so kits
            // created before a token rotation are still surfaced.
            ownerTokens: z.array(z.string().min(1).max(200)).max(20).optional(),
            // Optional cap — used by the landing page recent-kits widget to keep
            // the round-trip lean (3 rows + their colors/fonts/logo only).
            limit: z.number().int().min(1).max(200).optional(),
        }).parse,
    )
    .handler(async ({ data }) => {
        const admin = getAdmin();
        // Shared workspace: every visitor sees every kit. The ownerToken /
        // ownerTokens inputs are accepted for backward compatibility but ignored.
        void data.ownerToken;
        void data.ownerTokens;
        let query = admin
            .from("brand_kits")
            .select("id, name, source_url, status, created_at")
            .order("created_at", { ascending: false });
        if (data.limit) query = query.limit(data.limit);
        const { data: kitRows, error } = await query;
        if (error) throw new Error(error.message);
        const rows = kitRows ?? [];
        if (rows.length === 0) return { kits: [] };

        const ids = rows.map((r: any) => r.id);
        const [colorsRes, fontsRes, assetsRes] = await Promise.all([
            admin
                .from("kit_colors")
                .select("kit_id, hex, role, position")
                .in("kit_id", ids)
                .order("position"),
            admin
                .from("kit_fonts")
                .select("kit_id, family, source_family, role, google_font, weights, file_urls, position")
                .in("kit_id", ids)
                .order("position"),
            admin
                .from("kit_assets")
                .select("kit_id, kind, url, position")
                .in("kit_id", ids)
                .order("position"),
        ]);

        const palette: Record<string, { hex: string; role: string | null }[]> = {};
        (colorsRes.data ?? []).forEach((c: any) => {
            (palette[c.kit_id] ||= []).push({ hex: c.hex, role: c.role ?? null });
        });

        type DisplayFont = {
            family: string;
            google: boolean;
            source_family?: string | null;
            weights?: string[] | null;
            file_urls?: Array<{ url: string; weight?: string; style?: string; format?: string }> | null;
        };
        const displayFont: Record<string, DisplayFont | null> = {};
        const displayRank: Record<string, number> = {};
        const rolePriority = ["display", "heading", "h1", "h2", "title", "body"];
        // Reject CSS-variable strings, generic stacks, and obviously broken
        // families that won't render anywhere.
        const isUsableFamily = (raw: string) => {
            const f = raw.trim().replace(/^["']|["']$/g, "");
            if (!f) return false;
            if (/^var\(/i.test(f)) return false;
            if (/^(inherit|initial|unset|revert|currentcolor)$/i.test(f)) return false;
            const generics = new Set([
                "serif",
                "sans-serif",
                "monospace",
                "system-ui",
                "ui-sans-serif",
                "ui-serif",
                "ui-monospace",
                "ui-rounded",
                "-apple-system",
                "blinkmacsystemfont",
            ]);
            if (generics.has(f.toLowerCase())) return false;
            return true;
        };
        (fontsRes.data ?? []).forEach((f: any) => {
            if (!f.family) return;
            if (!isUsableFamily(f.family)) return;
            const roleIdx = rolePriority.indexOf((f.role ?? "").toLowerCase());
            let rank = roleIdx === -1 ? 99 : roleIdx;
            // Loadable = google-hosted OR has discovered file_urls we can @font-face.
            const hasFiles = Array.isArray(f.file_urls) && f.file_urls.length > 0;
            if (!f.google_font && !hasFiles) rank += 100;
            const cur = displayRank[f.kit_id];
            if (cur === undefined || rank < cur) {
                displayRank[f.kit_id] = rank;
                displayFont[f.kit_id] = {
                    family: f.family,
                    google: !!f.google_font,
                    source_family: f.source_family ?? null,
                    weights: Array.isArray(f.weights) ? f.weights : null,
                    file_urls: hasFiles ? f.file_urls : null,
                };
            }
        });

        const logoPriority = ["logo", "logo-mark", "logomark", "wordmark", "icon", "favicon"];
        const bestRank: Record<string, number> = {};
        const logo: Record<string, string | null> = {};
        (assetsRes.data ?? []).forEach((a: any) => {
            const rank = logoPriority.indexOf(a.kind);
            if (rank === -1) return;
            const cur = bestRank[a.kit_id];
            if (cur === undefined || rank < cur) {
                bestRank[a.kit_id] = rank;
                logo[a.kit_id] = a.url;
            }
        });

        return {
            kits: rows.map((r: any) => {
                const colors = palette[r.id] ?? [];
                const primary =
                    colors.find((c) => c.role === "primary")?.hex ?? colors[0]?.hex ?? null;
                return {
                    ...r,
                    primaryHex: primary,
                    palette: colors.slice(0, 5).map((c) => c.hex),
                    displayFont: displayFont[r.id] ?? null,
                    logoUrl: logo[r.id] ?? null,
                };
            }),
        };
    });

// Delete many kits at once. Skips kits not owned by the token.
export const bulkDeleteKits = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            kitIds: z.array(z.string().uuid()).min(1).max(200),
            ownerToken: z.string().min(1).max(200),
        }).parse,
    )
    .handler(async ({ data }) => {
        const admin = getAdmin();
        // Shared workspace — anyone can delete any kit.
        void data.ownerToken;
        const { data: rows } = await admin
            .from("brand_kits")
            .select("id")
            .in("id", data.kitIds);
        const ownedIds = (rows ?? []).map((r: any) => r.id as string);
        if (ownedIds.length === 0) return { deleted: 0 };
        await Promise.all([
            admin.from("kit_colors").delete().in("kit_id", ownedIds),
            admin.from("kit_fonts").delete().in("kit_id", ownedIds),
            admin.from("kit_tokens").delete().in("kit_id", ownedIds),
            admin.from("kit_assets").delete().in("kit_id", ownedIds),
            admin.from("kit_voice").delete().in("kit_id", ownedIds),
        ]);
        const { error } = await admin.from("brand_kits").delete().in("id", ownedIds);
        if (error) throw new Error(error.message);
        return { deleted: ownedIds.length };
    });
