/** Konfigurasi publik Supabase. Hanya URL dan publishable/anon key yang boleh dipakai di sini, bukan service role key. */
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** Tanpa kredensial Supabase, workspace berjalan sebagai demo lokal tanpa login. */
export function isSupabaseConfigured() {
  return supabaseConfig() !== null;
}

export const millOrganizationId = "10000000-0000-4000-8000-000000000001";
