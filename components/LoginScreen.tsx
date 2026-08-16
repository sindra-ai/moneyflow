'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Logo } from './Logo';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
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
    <div className="login">
      {/* Ambient wash — the same periwinkle/violet the marketing site opens on. */}
      <div className="login-bg" aria-hidden="true">
        <i className="lb-a" />
        <i className="lb-b" />
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <Logo size={44} />
          <span>MoneyFlow</span>
        </div>

        <h1 className="login-h">Welcome back</h1>
        <p className="login-sub">Pick up exactly where you left off, on any device.</p>

        <label className="lf">
          <span className="lf-k">Email</span>
          <span className="lf-in">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              placeholder="you@email.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </span>
        </label>

        <label className="lf">
          <span className="lf-k">Password</span>
          <span className="lf-in">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="3" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="auth-pass"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              placeholder="Your password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="lf-eye"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.4 5.2A9.7 9.7 0 0 1 12 5c5 0 9 4.5 9 7a12 12 0 0 1-2.4 3.3M6.2 6.7A12.6 12.6 0 0 0 3 12c0 2.5 4 7 9 7a9.9 9.9 0 0 0 3.3-.6" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
                  <circle cx="12" cy="12" r="2.6" />
                </svg>
              )}
            </button>
          </span>
        </label>

        {error && (
          <div className="login-err" role="alert">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5M12 16h.01" />
            </svg>
            {error}
          </div>
        )}

        <button className="login-go" type="submit" disabled={!canSubmit} data-busy={busy}>
          {busy ? <span className="login-spin" aria-hidden="true" /> : null}
          {busy ? 'Signing you in…' : 'Log in'}
        </button>

        <p className="login-foot">
          <span className="login-dot" />
          Private app &middot; invite-only
        </p>
      </form>
    </div>
  );
}

function prettyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('not confirmed')) return 'Account not confirmed yet.';
  return msg;
}
