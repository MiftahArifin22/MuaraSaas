"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isWorkspaceAccount, workspaceEmail } from "@/lib/auth";
import { isSupabaseConfigured, millOrganizationId } from "@/lib/supabase/config";

export type AuthState = { error: string };

export async function signIn(_previous: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!isSupabaseConfigured()) return { error: "Supabase belum dikonfigurasi di server ini. Gunakan tombol Buka workspace demo." };
  if (!isWorkspaceAccount(email)) return { error: "Gunakan akun BNI Ventures yang tercantum pada formulir." };
  if (!password || password.length > 1024) return { error: "Masukkan password akun Anda." };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: workspaceEmail, password });
    if (error) {
      if (!error.status || error.name === "AuthRetryableFetchError" || error.status >= 500) {
        return { error: "Server belum dapat terhubung ke Supabase. Periksa koneksi server lalu coba kembali." };
      }
      if (error.code === "invalid_credentials") return { error: "Email atau password ditolak Supabase. Gunakan password akun bniventures@gmail.com yang dibuat di Authentication → Users." };
      if (error.code === "email_not_confirmed") return { error: "Email belum dikonfirmasi. Periksa akun di Supabase Authentication." };
      if (error.status === 429) return { error: "Terlalu banyak percobaan. Tunggu sebentar lalu coba kembali." };
      return { error: "Supabase menolak login. Periksa pengaturan Email/Password pada Authentication." };
    }
    if (!data.user.email_confirmed_at || !isWorkspaceAccount(data.user.email)) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: "Akun ini belum memiliki akses workspace." };
    }
    const membership = await supabase.from("organization_members").select("organization_id")
      .eq("user_id", data.user.id).eq("organization_id", millOrganizationId).maybeSingle();
    if (membership.error || !membership.data) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: "Keanggotaan pabrik belum tersedia. Periksa hasil bootstrap_workspace.sql di Supabase." };
    }
  } catch {
    return { error: "Supabase belum dapat dihubungi. Periksa koneksi dan konfigurasi, lalu coba kembali." };
  }
  redirect("/dashboard");
}

export async function signOut(): Promise<AuthState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "Gagal keluar. Coba kembali." };
  } catch {
    return { error: "Belum dapat keluar. Periksa koneksi lalu coba kembali." };
  }
  redirect("/login");
}
