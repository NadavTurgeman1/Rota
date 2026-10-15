import { createClient } from "@supabase/supabase-js";
import { supabasePublic } from "./public-env";

/** Confirms the bearer token with Supabase Auth. A local demo without env has no user to check. */
export async function userIdFromAuthorization(header: string | null): Promise<string | null> {
  const env = supabasePublic();
  if (!env) return null;
  const token = header?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!token) return null;
  const supabase = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
