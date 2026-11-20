import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MUARA — Dari lahan ke pabrik, asalnya jelas", template: "%s | MUARA" },
  description: "Mekanisme Uji Asal dan Registri Akuntabel: pemeriksaan pemasok, penelusuran bukti asal pasokan kayu, dan pendampingan pemasok melalui mitra lokal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior memberi tahu Next.js agar menonaktifkan smooth scroll saat pindah halaman.
    <html lang="id" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
