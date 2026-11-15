import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for the signed-in Clerk user. It sends the Clerk session
 * token, so row level security sees the user's `sub`. It never uses the
 * service role key.
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase client configuration is missing");
  }

  return createClient(url, anonKey, {
    accessToken: async () => (await auth()).getToken(),
  });
}
