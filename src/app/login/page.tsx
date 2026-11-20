import { FlaskConical } from "lucide-react";
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
          <p>Masuk dengan akun BNI Ventures. Semua data di dalamnya adalah data contoh.</p>
        </div>
        {configured ? <LoginForm /> : (
          <div className="form-stack login-form">
            <p className="inline-notice notice-info"><FlaskConical size={18} aria-hidden="true" /><span><strong>Mode demo.</strong> Login tidak diperlukan. Perubahan tersimpan di browser ini.</span></p>
            <Link className="button button-primary" href="/dashboard">Buka workspace demo</Link>
          </div>
        )}
        <Link href="/" className="text-link">Kembali ke beranda</Link>
      </section>
    </main>
  );
}
