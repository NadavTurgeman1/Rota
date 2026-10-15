/** Values that are safe to ship to the browser. The database URL is never one of them. */
export function supabasePublic(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim() ?? "";
  if (!url || !key) return null;
  return { url, key };
}

export function remoteConfigured(): boolean {
  return supabasePublic() !== null;
}
