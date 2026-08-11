import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdmin } from "@/server/supabase-admin.server";

// Toggle public sharing for a kit. Owner-only.
export const setKitShare = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            kitId: z.string().uuid(),
            ownerToken: z.string().min(1).max(200),
            isPublic: z.boolean(),
        }).parse,
    )
    .handler(async ({ data }) => {
        const admin = getAdmin();
        const { data: kit } = await admin
            .from("brand_kits")
            .select("id, user_id, anon_token, share_token")
            .eq("id", data.kitId)
            .maybeSingle();
        if (!kit) throw new Error("Kit not found");
        const k = kit as any;
        // Ownership gate: only the kit owner (auth user_id OR anon_token holder) may toggle sharing.
        const isOwner =
            (k.user_id && k.user_id === data.ownerToken) ||
            (k.anon_token && k.anon_token === data.ownerToken);
        if (!isOwner) throw new Error("Forbidden: only the kit owner can change sharing");

        const update: Record<string, any> = { is_public: data.isPublic };
        if (data.isPublic && !k.share_token) {
            update.share_token = crypto.randomUUID().replace(/-/g, "");
        }
        const { data: updated, error } = await admin
            .from("brand_kits")
            .update(update)
            .eq("id", data.kitId)
            .select("share_token, is_public")
            .single();
        if (error) throw new Error(error.message);
        return updated as { share_token: string | null; is_public: boolean };
    });

// Claim an anonymous kit when a user signs in.
export const claimKit = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            kitId: z.string().uuid(),
            anonToken: z.string().min(1).max(200),
            userId: z.string().uuid(),
        }).parse,
    )
    .handler(async ({ data }) => {
        const admin = getAdmin();
        const { error } = await admin
            .from("brand_kits")
            .update({ user_id: data.userId, anon_token: null })
            .eq("id", data.kitId)
            .eq("anon_token", data.anonToken);
        if (error) throw new Error(error.message);
        return { ok: true };
    });
