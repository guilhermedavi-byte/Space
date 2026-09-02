import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnvironment } from "@/lib/env/server";

/** Server-only database client. Never import this module from a client component. */
export function createServerDatabaseClient(): SupabaseClient {
  const environment = getServerEnvironment();
  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
