import { ArrowRight, Fingerprint, Layers3, MapPinned, ShieldCheck, UsersRound, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";

const solutions = [
  { number: "01", icon: MapPinned, title: "Periksa pemasok", href: "/dashboard/due-diligence", text: "Lihat dokumen dan peta lahan setiap pemasok, lalu ketahui mana yang perlu dicek." },
  { number: "02", icon: Fingerprint, title: "Telusuri pasokan", href: "/dashboard/traceability", text: "Lihat dari lahan mana kayu di setiap kiriman berasal, lengkap dengan tonasenya." },
  { number: "03", icon: UsersRound, title: "Dampingi pemasok", href: "/dashboard/cooperatives", text: "Koperasi setempat membantu pemasok melengkapi data, lalu hasilnya ditinjau." },
] as const;

const flow = [
  { title: "Kumpulkan", text: "Masukkan data pemasok dan lahan." },
  { title: "Periksa", text: "Lihat data yang kurang dan temuannya." },
  { title: "Lengkapi", text: "Koperasi membantu melengkapi data." },
  { title: "Telusuri", text: "Hubungkan setiap lot ke lahannya." },
];

export default function Home() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-width landing-nav">
          <Link href="/" aria-label="Beranda MUARA"><Brand /></Link>
          <nav aria-label="Navigasi utama">
            <a href="#solusi" className="landing-nav-link">Solusi</a>
            <a href="#alur" className="landing-nav-link">Alur kerja</a>
            <Link className="button button-primary" href="/dashboard">Buka workspace</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="hero-title">
          <Image className="hero-bg" src="/kanopi-akasia.webp" alt="" fill preload sizes="100vw" />
          <div className="landing-width hero-inner">
            <div className="hero-copy">
              <h1 id="hero-title">Dari lahan ke pabrik, <em>asalnya jelas.</em></h1>
              <p>MUARA membantu pabrik pulp, kertas, dan serpih kayu memastikan asal setiap kiriman kayu.</p>
              <div className="actions hero-actions">
                <Link className="button button-lime" href="/dashboard">Buka workspace <ArrowRight size={17} aria-hidden="true" /></Link>
                <a className="button button-secondary" href="#solusi">Lihat cara kerja</a>
              </div>
              <div className="hero-foot"><span>#AsalJelasBersamaMUARA</span></div>
            </div>
            <div className="hero-caption"><span className="icon-box"><Layers3 size={20} aria-hidden="true" /></span><div><strong>Lahan, pemasok, dan pasokan</strong><small>Terhubung di satu tempat</small></div></div>
          </div>
        </section>

        <section id="solusi" className="landing-modules" aria-labelledby="solusi-title">
          <div className="landing-width">
            <div className="landing-section-heading"><div><p className="eyebrow">Tiga solusi</p><h2 id="solusi-title">Yang dikerjakan MUARA</h2></div></div>
            <div className="landing-grid">
              {solutions.map(({ number, icon: Icon, title, href, text }) => (
                <article className="module-card" key={title}>
                  <div className="module-top"><span className="icon-box"><Icon size={21} aria-hidden="true" /></span><span className="module-number mono">{number}</span></div>
                  <h3>{title}</h3>
                  <p className="module-problem">{text}</p>
                  <Link className="text-link module-link" href={href}>Coba <ArrowRight size={15} aria-hidden="true" /></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="alur" className="landing-flow landing-width" aria-labelledby="alur-title">
          <div className="landing-section-heading"><div><p className="eyebrow">Alur kerja</p><h2 id="alur-title">Cara kerjanya</h2></div></div>
          <ol className="flow-steps">
            {flow.map((step, index) => <li key={step.title}><span className="flow-index mono">{index + 1}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></li>)}
          </ol>
          <div className="scope-note">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>MUARA memberi rekomendasi. <strong>Keputusan pembelian tetap di tangan perusahaan.</strong></p>
          </div>
        </section>

        <section className="landing-finance" aria-labelledby="finance-title">
          <div className="landing-width finance-inner">
            <span className="icon-box"><Wallet size={22} aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">Konsep · simulasi</p>
              <h2 id="finance-title">Data untuk pembiayaan</h2>
              <p>Data lot yang lolos pemeriksaan bisa membantu bank seperti BNI atau hibank menilai pembiayaan pemasok. <strong>Masih konsep, belum ada kerja sama.</strong></p>
            </div>
          </div>
        </section>

        <section className="landing-cta landing-width" aria-labelledby="cta-title">
          <h2 id="cta-title">Mulai telusuri asal kayu</h2>
          <Link className="button button-primary" href="/dashboard">Buka workspace <ArrowRight size={17} aria-hidden="true" /></Link>
        </section>
      </main>

      <footer className="landing-footer landing-width"><Brand /><p>MUARA · Mekanisme Uji Asal dan Registri Akuntabel</p></footer>
    </div>
  );
}
