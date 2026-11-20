"use client";

import { AlertCircle, Check, CheckCircle2, CircleAlert, CircleHelp, Inbox, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Risk, TaskStatus } from "@/lib/mock-data";
import { riskLabels } from "@/lib/screening";

const riskIcons = { green: Check, yellow: CircleHelp, red: CircleAlert };

/**
 * Nilai pilihan yang berawal dari parameter URL (mis. ?lot=...) dan dapat diganti pengguna.
 * Bila URL berubah (navigasi dari pencarian atau ringkasan), nilai kembali mengikuti URL.
 */
export function useParamSelection<T extends string>(param: T | null) {
  const [selection, setSelection] = useState<{ param: T | null; value: T | null }>({ param, value: param });
  const value = selection.param === param ? selection.value : param;
  return [value, (next: T | null) => setSelection({ param, value: next })] as const;
}

/** Stempel waktu untuk aksi penyimpanan. Panggil hanya di event handler, bukan saat render. */
export function timestamp() {
  return new Date().toISOString();
}

export function RiskBadge({ risk, label }: { risk: Risk; label?: string }) {
  const Icon = riskIcons[risk];
  return <span className={`risk-badge risk-${risk}`}><Icon size={14} aria-hidden="true" />{label ?? riskLabels[risk]}</span>;
}

export const taskLabels: Record<TaskStatus, string> = {
  assigned: "Ditugaskan",
  in_progress: "Dikerjakan",
  submitted_review: "Dikirim untuk ditinjau",
  revision_requested: "Perlu perbaikan",
  verified_completed: "Hasil diterima",
};

const taskTones: Record<TaskStatus, string> = {
  assigned: "neutral",
  in_progress: "info",
  submitted_review: "yellow",
  revision_requested: "red",
  verified_completed: "green",
};

export function TaskBadge({ status }: { status: TaskStatus }) {
  return <span className={`risk-badge risk-${taskTones[status]}`}>{taskLabels[status]}</span>;
}

export function PageHeading({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-heading">
      <div><h1>{title}</h1><p>{children}</p></div>
      {actions && <div className="actions no-print">{actions}</div>}
    </div>
  );
}

function useModal(onDismiss: () => void) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; });
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);
  return {
    ref: dialog,
    onCancel: (event: React.SyntheticEvent) => { event.preventDefault(); dismiss.current(); },
    // Tutup hanya bila klik jatuh pada backdrop, yaitu di luar kotak dialog.
    onClick: (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target !== event.currentTarget || event.detail === 0) return;
      const box = event.currentTarget.getBoundingClientRect();
      const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
      if (outside) dismiss.current();
    },
  };
}

export function Dialog({ title, children, onDismiss, wide = false, description }: { title: string; children: ReactNode; onDismiss: () => void; wide?: boolean; description?: ReactNode }) {
  const titleId = useId();
  const modal = useModal(onDismiss);
  return (
    <dialog {...modal} className={`dialog${wide ? " dialog-wide" : ""}`} aria-labelledby={titleId}>
      <div className="dialog-header"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Tutup" onClick={onDismiss}><X size={20} /></button></div>
      {description && <p className="dialog-description">{description}</p>}
      {children}
    </dialog>
  );
}

export function Drawer({ title, eyebrow, children, onDismiss, footer }: { title: string; eyebrow?: ReactNode; children: ReactNode; onDismiss: () => void; footer?: ReactNode }) {
  const titleId = useId();
  const modal = useModal(onDismiss);
  return (
    <dialog {...modal} className="drawer" aria-labelledby={titleId}>
      <div className="drawer-header">
        <div>{eyebrow && <span className="record-id mono">{eyebrow}</span>}<h2 id={titleId}>{title}</h2></div>
        <button type="button" className="icon-button" aria-label="Tutup panel detail" onClick={onDismiss}><X size={20} /></button>
      </div>
      <div className="drawer-body">{children}</div>
      {footer && <div className="drawer-footer">{footer}</div>}
    </dialog>
  );
}

export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onDismiss, danger = false }: { title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onDismiss: () => void; danger?: boolean }) {
  return (
    <Dialog title={title} onDismiss={onDismiss}>
      <div className="dialog-description">{children}</div>
      <div className="actions dialog-actions">
        <button type="button" className="button button-secondary" onClick={onDismiss} autoFocus>Batal</button>
        <button type="button" className={`button ${danger ? "button-danger" : "button-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Dialog>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return message ? <p className="inline-notice notice-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{message}</span></p> : null;
}

export function SuccessNotice({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className="inline-notice notice-success" role="status">
      <CheckCircle2 size={18} aria-hidden="true" /><span>{children}</span>
      {onDismiss && <button type="button" className="icon-button" aria-label="Tutup pemberitahuan" onClick={onDismiss}><X size={16} /></button>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="icon-box" aria-hidden="true"><Inbox size={20} /></span>
      <div><strong>{title}</strong>{children && <p>{children}</p>}{action && <div className="actions">{action}</div>}</div>
    </div>
  );
}

export function SimulationTag({ children = "Simulasi" }: { children?: ReactNode }) {
  return <span className="simulation-tag">{children}</span>;
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(name: string, data: unknown) {
  downloadFile(`${name}.json`, JSON.stringify(data, null, 2), "application/json");
}
