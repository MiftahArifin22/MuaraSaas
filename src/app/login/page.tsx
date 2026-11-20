import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="login-page">
      <section className="panel login-card" aria-labelledby="login-title">
        <Link href="/" aria-label="Beranda MUARA" className="login-brand"><Brand /></Link>
        <div>
          <p className="eyebrow">Workspace BNI Ventures</p>
          <h1 id="login-title">Masuk ke MUARA</h1>
          <p>Masuk dengan akun BNI Ventures.</p>
        </div>
        {configured ? <LoginForm /> : (
          <div className="form-stack login-form">
            <Link className="button button-primary" href="/dashboard">Buka workspace</Link>
          </div>
        )}
        <Link href="/" className="text-link">Kembali ke beranda</Link>
      </section>
    </main>
  );
}
