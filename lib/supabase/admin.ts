import { createClient } from "@supabase/supabase-js";

function getAdminConfig() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();

  if (!url || !key) {
    throw new Error(
      "Missing server-only Supabase configuration. Set SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  return { url, key };
}

export function createSupabaseAdminClient() {
  const { url, key } = getAdminConfig();

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
