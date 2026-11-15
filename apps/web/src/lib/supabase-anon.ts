import { createClient } from "@supabase/supabase-js";

/**
 * A Supabase client with the publishable (anon) key. It has no user session.
 * Use it for device-token routes, which must not use the service-role key.
 */
export function createSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public configuration is missing");
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
