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
  const [asking, setAsking] = useState(false);

  if (asking) return <RequestAccess onBack={() => setAsking(false)} />;

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
        <a className="login-brand" href="/" aria-label="Back to moneyflow.co">
          <Logo size={44} />
          <span>MoneyFlow</span>
        </a>

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
          Private app &middot;
          <button type="button" className="login-ask" onClick={() => setAsking(true)}>
            request access
          </button>
        </p>
      </form>
    </div>
  );
}

function RequestAccess({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = name.trim().length >= 2 && emailValid && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/access-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, reason, company, source: 'login' }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) setError(json.error || 'Could not send that. Try again.');
      else setSent(true);
    } catch {
      setError('No connection. Try again.');
    }
    setBusy(false);
  };

  return (
    <div className="login">
      <div className="login-bg" aria-hidden="true">
        <i className="lb-a" />
        <i className="lb-b" />
      </div>

      <form className="login-card" onSubmit={submit}>
        <a className="login-brand" href="/" aria-label="Back to moneyflow.co">
          <Logo size={44} />
          <span>MoneyFlow</span>
        </a>

        {sent ? (
          <>
            <h1 className="login-h">Request sent</h1>
            <div className="ask-done">
              <span className="tick">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <p>Thanks. You&apos;ll hear back by email if an account is set up for you.</p>
            </div>
            <button className="login-go" type="button" onClick={onBack}>
              Back to log in
            </button>
          </>
        ) : (
          <>
            <h1 className="login-h">Request access</h1>
            <p className="login-sub">MoneyFlow is invite-only. Tell us who you are.</p>

            <label className="lf">
              <span className="lf-k">Name</span>
              <span className="lf-in">
                <input value={name} placeholder="Your name" autoComplete="name"
                  onChange={(e) => setName(e.target.value)} />
              </span>
            </label>

            <label className="lf">
              <span className="lf-k">Email</span>
              <span className="lf-in">
                <input type="email" inputMode="email" autoComplete="email" value={email}
                  placeholder="you@email.com" onChange={(e) => setEmail(e.target.value)} />
              </span>
            </label>

            <label className="lf">
              <span className="lf-k">Why</span>
              <span className="lf-in">
                <input value={reason} placeholder="Optional"
                  onChange={(e) => setReason(e.target.value)} />
              </span>
            </label>

            {/* Left empty by people, filled by bots. */}
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
              value={company} onChange={(e) => setCompany(e.target.value)} />

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
              {busy ? 'Sending…' : 'Send request'}
            </button>

            <p className="login-foot">
              <button type="button" className="login-ask" onClick={onBack}>
                Back to log in
              </button>
            </p>
          </>
        )}
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
