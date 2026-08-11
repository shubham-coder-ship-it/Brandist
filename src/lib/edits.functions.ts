import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdmin } from "@/server/supabase-admin.server";

async function assertOwner(kitId: string, _ownerToken: string) {
    // Shared workspace — confirm kit exists; do not gate on ownership.
    const admin = getAdmin();
    const { data: kit, error } = await admin
        .from("brand_kits")
        .select("id")
        .eq("id", kitId)
        .maybeSingle();
    if (error || !kit) throw new Error("Kit not found");
    return admin;
}

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const DeleteAssetSchema = z.object({
    kitId: z.string().uuid(),
    assetId: z.string().uuid(),
    ownerToken: z.string().min(1).max(200),
});

export const deleteKitAsset = createServerFn({ method: "POST" })
    .inputValidator((d) => DeleteAssetSchema.parse(d))
    .handler(async ({ data }) => {
        const admin = await assertOwner(data.kitId, data.ownerToken);
        const { data: asset } = await admin
            .from("kit_assets")
            .select("storage_path")
            .eq("id", data.assetId)
            .eq("kit_id", data.kitId)
            .maybeSingle();
        if (asset?.storage_path) {
            await admin.storage.from("brand-assets").remove([asset.storage_path]).catch(() => null);
        }
        const { error } = await admin
            .from("kit_assets")
            .delete()
            .eq("id", data.assetId)
            .eq("kit_id", data.kitId);
        if (error) throw new Error(error.message);
        return { ok: true };
    });

const DeleteColorSchema = z.object({
    kitId: z.string().uuid(),
    colorId: z.string().uuid(),
    ownerToken: z.string().min(1).max(200),
});

export const deleteKitColor = createServerFn({ method: "POST" })
    .inputValidator((d) => DeleteColorSchema.parse(d))
    .handler(async ({ data }) => {
        const admin = await assertOwner(data.kitId, data.ownerToken);
        const { error } = await admin
            .from("kit_colors")
            .delete()
            .eq("id", data.colorId)
            .eq("kit_id", data.kitId);
        if (error) throw new Error(error.message);
        return { ok: true };
    });

const UpdateColorSchema = z.object({
    kitId: z.string().uuid(),
    colorId: z.string().uuid(),
    ownerToken: z.string().min(1).max(200),
    hex: z.string().regex(HEX).optional(),
    role: z.string().min(1).max(40).optional(),
    name: z.string().min(1).max(80).nullable().optional(),
});

export const updateKitColor = createServerFn({ method: "POST" })
    .inputValidator((d) => UpdateColorSchema.parse(d))
    .handler(async ({ data }) => {
        const admin = await assertOwner(data.kitId, data.ownerToken);
        const patch: Record<string, any> = {};
        if (data.hex) patch.hex = data.hex.toUpperCase();
        if (data.role) patch.role = data.role;
        if (data.name !== undefined) patch.name = data.name;
        if (!Object.keys(patch).length) return { ok: true };
        const { error } = await admin
            .from("kit_colors")
            .update(patch)
            .eq("id", data.colorId)
            .eq("kit_id", data.kitId);
        if (error) throw new Error(error.message);
        return { ok: true };
    });