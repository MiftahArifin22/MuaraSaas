import "leaflet/dist/leaflet.css";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { Workspace, type WorkspaceAccess } from "@/components/workspace/workspace";
import { isWorkspaceAccount } from "@/lib/auth";
import { isSupabaseConfigured, millOrganizationId } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type AccessResult = { status: "login" } | { status: "error"; message: string } | { status: "ok"; access: WorkspaceAccess };

async function checkAccess(): Promise<AccessResult> {
  if (!isSupabaseConfigured()) return { status: "ok", access: { mode: "local" } };

  // Sesi dibaca per request. Supabase membandingkan masa berlaku token dengan jam saat ini
  // (Date.now()), sehingga pemeriksaan ini tidak boleh ikut prerender maupun prefetch.
  await connection();
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || !user.email_confirmed_at || !isWorkspaceAccount(user.email)) return { status: "login" };
    const { data, error: membershipError } = await supabase.from("organization_members")
      .select("organization_id").eq("user_id", user.id)
      .eq("organization_id", millOrganizationId).maybeSingle();
    if (membershipError) return { status: "error", message: "Keanggotaan belum dapat diperiksa. Muat ulang halaman. Jika berulang, periksa tabel organization_members di Supabase." };
    if (!data) return { status: "error", message: "Akun belum terdaftar sebagai anggota pabrik. Jalankan supabase/bootstrap_workspace.sql untuk akun ini." };
    return { status: "ok", access: { mode: "supabase", email: user.email ?? "" } };
  } catch {
    return { status: "error", message: "Supabase belum dapat dihubungi. Periksa koneksi internet dan konfigurasi .env.local, lalu muat ulang halaman." };
  }
}

async function AuthorizedWorkspace({ children }: { children: React.ReactNode }) {
  const result = await checkAccess();
  if (result.status === "login") redirect("/login");
  if (result.status === "error") {
    return (
      <main className="login-page">
        <section className="panel login-card" aria-labelledby="access-title">
          <h1 id="access-title">Workspace belum dapat dibuka</h1>
          <p role="alert">{result.message}</p>
          <LogoutButton />
        </section>
      </main>
    );
  }
  return <Workspace access={result.access}>{children}</Workspace>;
}

function AccessFallback() {
  return <main className="login-page"><p className="loading-line" role="status"><span className="spinner" aria-hidden="true" />Memeriksa akses workspace…</p></main>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<AccessFallback />}><AuthorizedWorkspace>{children}</AuthorizedWorkspace></Suspense>;
}
