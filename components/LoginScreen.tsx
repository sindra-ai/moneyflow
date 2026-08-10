"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import Logo from "./Logo";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 6;
  const canSubmit = emailValid && passwordValid && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError(prettyError(error));
  };

  return (
    <div className="auth">
      <div className="auth-card glass">
        <div className="auth-logo">
          <Logo size={52} />
        </div>
        <h1 className="auth-title">MoneyFlow</h1>
        <p className="auth-sub">Log in to your account to sync across every device.</p>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              placeholder="you@email.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Password</label>
            <input
              id="auth-pass"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              placeholder="Your password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            className="btn-primary"
            type="submit"
            disabled={!canSubmit}
            style={{ opacity: canSubmit ? 1 : 0.5 }}
          >
            {busy ? "Please wait…" : "Log in"}
          </button>
        </form>

        <p className="auth-note">Private app · invite-only</p>
      </div>
    </div>
  );
}

function prettyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("not confirmed")) return "Account not confirmed yet.";
  return msg;
}
