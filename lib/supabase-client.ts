import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabase-types";

type AppSupabaseClient = SupabaseClient<Database>;

let client: AppSupabaseClient | null = null;

export function getSupabaseClient(): AppSupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const nextClient = createClient<Database>(url, anonKey);
  client = nextClient;
  return nextClient;
}
