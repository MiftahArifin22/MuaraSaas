"use client";

import { Factory, Fingerprint, FlaskConical, LayoutDashboard, MapPinned, Menu, RotateCcw, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { resetDemo, useDemo } from "@/lib/demo-store";
import { screenSupplier, validateLot } from "@/lib/screening";
import { GlobalSearch } from "./global-search";
import { PageLoading } from "./page-loading";
import { ConfirmDialog, SuccessNotice } from "./ui";

export type WorkspaceAccess = { mode: "local" } | { mode: "supabase"; email: string };

const pages = [
  { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pemeriksaan pemasok", href: "/dashboard/due-diligence", icon: MapPinned },
  { label: "Penelusuran pasokan", href: "/dashboard/traceability", icon: Fingerprint },
  { label: "Portal mitra koperasi", href: "/dashboard/cooperatives", icon: UsersRound },
] as const;

export function Workspace({ access, children }: { access: WorkspaceAccess; children: ReactNode }) {
  const pathname = usePathname();
  const { data, storageAvailable, ready } = useDemo();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const [resetMessage, setResetMessage] = useState(false);
  const activePage = pages.find((page) => page.href === pathname) ?? pages[0];

  const counts: Record<string, number> = {
    "/dashboard/due-diligence": data.suppliers.filter((supplier) => screenSupplier(data.plots.filter((plot) => plot.supplierId === supplier.id)) !== "green").length,
    "/dashboard/traceability": data.lots.filter((lot) => validateLot(lot, data).risk !== "green").length,
    "/dashboard/cooperatives": data.tasks.filter((task) => task.status === "submitted_review").length,
  };
  const countLabels: Record<string, string> = {
    "/dashboard/due-diligence": "pemasok perlu ditinjau",
    "/dashboard/traceability": "lot belum lolos",
    "/dashboard/cooperatives": "hasil menunggu tinjauan",
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  function confirmReset() {
    resetDemo();
    setResetCount((previous) => previous + 1);
    setShowReset(false);
    setResetMessage(true);
  }

  return (
    <div className="workspace">
      <a className="skip-link" href="#konten">Langsung ke konten</a>
      <aside className={`sidebar no-print${menuOpen ? " sidebar-open" : ""}`} id="workspace-nav" aria-label="Navigasi workspace">
        <div className="sidebar-top">
          <Link href="/" className="sidebar-brand" aria-label="Beranda MUARA"><Brand /></Link>
          <button type="button" className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Tutup navigasi"><X size={21} /></button>
        </div>
        <div className="sidebar-org">
          <span className="sidebar-label">Organisasi</span>
          <div className="sidebar-mill"><Factory size={18} aria-hidden="true" /><div><strong>{data.mill.name}</strong><small>{data.mill.region} · <span className="mono">{data.mill.reference}</span></small></div></div>
        </div>
        <nav className="sidebar-nav">
          <span className="sidebar-label">Workspace</span>
          {pages.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => { setMenuOpen(false); setResetMessage(false); }} aria-current={activePage.href === href ? "page" : undefined}>
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" /><span>{label}</span>
              {ready && counts[href] > 0 && <span className="nav-count" aria-label={`${counts[href]} ${countLabels[href]}`}>{counts[href]}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-mode">
            <FlaskConical size={16} aria-hidden="true" />
            <div><strong>{access.mode === "supabase" ? "Mode demo · akun terautentikasi" : "Mode demo lokal"}</strong><small>Data contoh di browser ini</small></div>
          </div>
          <button type="button" className="sidebar-reset" onClick={() => setShowReset(true)}><RotateCcw size={15} aria-hidden="true" />Reset data demo</button>
        </div>
      </aside>
      {menuOpen && <button type="button" className="sidebar-backdrop no-print" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />}

      <div className="workspace-body">
        <header className="workspace-topbar no-print">
          <button type="button" className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-controls="workspace-nav" aria-expanded={menuOpen} aria-label="Buka navigasi"><Menu size={22} /></button>
          <span className="topbar-title">{activePage.label}</span>
          <GlobalSearch />
          <div className="topbar-account">
            <span className="demo-badge" title="Seluruh data adalah data contoh"><FlaskConical size={14} aria-hidden="true" />Data demo</span>
            {access.mode === "supabase" ? <><span className="account-email">{access.email}</span><LogoutButton /></> : <span className="account-email">Tanpa login</span>}
          </div>
        </header>
        <main className="workspace-content" id="konten">
          {!storageAvailable && <p className="inline-notice notice-error no-print" role="status">Browser tidak bisa menyimpan data. Perubahan hilang saat halaman ditutup.</p>}
          {resetMessage && <SuccessNotice onDismiss={() => setResetMessage(false)}>Data demo dikembalikan ke kondisi awal.</SuccessNotice>}
          {ready ? <Fragment key={resetCount}>{children}</Fragment> : <PageLoading label="Memuat data demo…" />}
        </main>
      </div>

      {showReset && (
        <ConfirmDialog title="Reset data demo?" confirmLabel="Ya, reset data demo" danger onConfirm={confirmReset} onDismiss={() => setShowReset(false)}>
          <p>Semua perubahan demo di browser ini dihapus dan data contoh dimuat ulang. Data Supabase tidak terpengaruh.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
