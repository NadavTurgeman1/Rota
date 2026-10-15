"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublic } from "./public-env";

let client: SupabaseClient | null = null;

export function browserClient(): SupabaseClient {
  if (client) return client;
  const env = supabasePublic();
  if (!env) throw new Error("Supabase is not configured");
  client = createClient(env.url, env.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export async function jsonAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!supabasePublic()) return headers;
  const { data } = await browserClient().auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}
