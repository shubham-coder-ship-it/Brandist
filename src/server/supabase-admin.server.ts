// Admin Supabase client (service role) — server-only.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient<any, any, any> | null = null;

export function getAdmin(): SupabaseClient<any, any, any> {
    if (cached) return cached;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server env missing");
    cached = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return cached;
}
