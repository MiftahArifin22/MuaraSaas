"use client";

import Link from "next/link";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  function resetAndReload() {
    try { window.localStorage.removeItem("muara-demo-v2"); } catch { /* penyimpanan tidak tersedia */ }
    window.location.reload();
  }
  return (
    <main className="login-page">
      <section className="panel login-card" aria-labelledby="error-title" role="alert">
        <h1 id="error-title">Halaman belum bisa dimuat</h1>
        <p>Terjadi kesalahan saat menampilkan halaman ini. Coba muat ulang. Kalau berulang, kembalikan data ke kondisi awal.</p>
        <p className="mono fine-print">{error.message}{error.digest ? ` (${error.digest})` : ""}</p>
        <div className="actions">
          <button type="button" className="button button-primary" onClick={() => retry()}>Coba lagi</button>
          <button type="button" className="button button-secondary" onClick={resetAndReload}>Reset data dan muat ulang</button>
          <Link href="/" className="text-link">Ke beranda</Link>
        </div>
      </section>
    </main>
  );
}
