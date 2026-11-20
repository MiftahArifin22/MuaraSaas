"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useActionState, useState } from "react";
import { workspaceEmail } from "@/lib/auth";
import { signIn } from "@/app/login/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  const [visible, setVisible] = useState(false);
  return (
    <form action={action} className="form-stack login-form">
      <label>Email<input type="email" name="email" value={workspaceEmail} readOnly autoComplete="username" /></label>
      <label htmlFor="login-password">Password</label>
      <div className="password-input"><input id="login-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required maxLength={1024} placeholder="Masukkan password akun Anda" /><button type="button" className="icon-button" aria-label={visible ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
      {state.error && <p className="inline-notice notice-error" role="alert">{state.error}</p>}
      <button className="button button-primary" type="submit" disabled={pending}><LockKeyhole size={17} />{pending ? "Sedang masuk…" : "Masuk ke workspace"}</button>
    </form>
  );
}
