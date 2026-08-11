import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdmin } from "@/server/supabase-admin.server";

export const getSharedKit = createServerFn({ method: "POST" })
    .inputValidator(z.object({ shareToken: z.string().min(8).max(64) }).parse)
    .handler(async ({ data }) => {
        const admin = getAdmin();
        const { data: kit } = await admin
            .from("brand_kits")
            .select("*")
            .eq("share_token", data.shareToken)
            .eq("is_public", true)
            .maybeSingle();
        if (!kit) throw new Error("Shared kit not found or no longer public");
        const k = kit as any;
        const [colors, fonts, tokens, assets, voice] = await Promise.all([
            admin.from("kit_colors").select("*").eq("kit_id", k.id).order("position"),
            admin.from("kit_fonts").select("*").eq("kit_id", k.id).order("position"),
            admin.from("kit_tokens").select("*").eq("kit_id", k.id).order("position"),
            admin.from("kit_assets").select("*").eq("kit_id", k.id).order("position"),
            admin.from("kit_voice").select("*").eq("kit_id", k.id).maybeSingle(),
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