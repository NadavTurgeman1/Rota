"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { REMEMBER_EMAIL_KEY, REMEMBER_KEY, readAuthItem, rememberOn } from "../auth/remember";
import { supabasePublic } from "./public-env";

let client: SupabaseClient | null = null;

function remembered(): boolean {
  return rememberOn(window.localStorage.getItem(REMEMBER_KEY));
}

const authStorage = {
  getItem(key: string) {
    return readAuthItem(remembered(), window.localStorage.getItem(key), window.sessionStorage.getItem(key));
  },
  setItem(key: string, value: string) {
    const keep = remembered() ? window.localStorage : window.sessionStorage;
    const drop = keep === window.localStorage ? window.sessionStorage : window.localStorage;
    drop.removeItem(key);
    keep.setItem(key, value);
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

/** Saves the choice before sign-in, so the new session lands in the right store. The password is never stored. */
export function setRememberedLogin(remember: boolean, email: string) {
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  if (remember) window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
  else window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
}

export function rememberedLoginEmail(): string {
  if (!remembered()) return "";
  return window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
}

export function browserClient(): SupabaseClient {
  if (client) return client;
  const env = supabasePublic();
  if (!env) throw new Error("Supabase is not configured");
  client = createClient(env.url, env.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authStorage,
    },
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
