"use client";

import { LogOut } from "lucide-react";
import { useActionState } from "react";
import { signOut } from "@/app/login/actions";

export function LogoutButton() {
  const [state, action, pending] = useActionState(signOut, { error: "" });
  return <form action={action} className="logout-form"><button type="submit" className="button button-secondary button-small" disabled={pending}><LogOut size={16} />{pending ? "Keluar…" : "Keluar"}</button>{state.error && <p role="alert" className="inline-notice notice-error">{state.error}</p>}</form>;
}
