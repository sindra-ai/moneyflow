'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Logo } from './Logo';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="boot">
      <form
        onSubmit={submit}
        style={{
          width: 'min(360px, 88vw)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 22 }}>
          <Logo size={52} />
          <h1
            style={{
              font: 'var(--t-title)',
              letterSpacing: '-0.02em',
              marginTop: 14,
            }}
          >
            MoneyFlow
          </h1>
          <p
            style={{
              font: 'var(--t-meta)',
              color: 'var(--ink-3)',
              textAlign: 'center',
              marginTop: 6,
            }}
          >
            Log in to sync across every device.
          </p>
        </div>

        <div className="f">
          <label className="f-k" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            className="in"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            placeholder="you@email.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="f">
          <label className="f-k" htmlFor="auth-pass">
            Password
          </label>
          <input
            id="auth-pass"
            className="in"
            type="password"
            autoComplete="current-password"
            value={password}
            placeholder="Your password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div
            style={{
              font: 'var(--t-meta)',
              color: 'var(--bad)',
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <button
          className="btn btn-key"
          type="submit"
          disabled={!canSubmit}
          // `.btn` uses flex:1 for the sheet's button row; in this column it
          // would collapse to text height, so pin an explicit height here.
          style={{ opacity: canSubmit ? 1 : 0.5, width: '100%', flex: 'none', height: 54 }}
        >
          {busy ? 'Please wait…' : 'Log in'}
        </button>

        <p
          style={{
            font: 'var(--t-meta)',
            color: 'var(--ink-3)',
            textAlign: 'center',
            marginTop: 18,
          }}
        >
          Private app · invite-only
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
