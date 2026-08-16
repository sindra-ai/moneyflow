'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { isOwner } from '@/lib/owner';
import { HAPTIC } from '@/lib/haptics';

interface Req {
  id: string;
  created_at: string;
  name: string;
  email: string;
  reason: string | null;
}

/** Owner-only: approve the people who asked for an account, from the phone. */
export function AccessRequests() {
  const { user, session } = useAuth();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const token = session?.access_token;
  const owner = isOwner(user?.email);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/access-requests', {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return setRows([]);
      const json = (await res.json()) as { requests: Req[] };
      setRows(json.requests ?? []);
    } catch {
      setRows([]);
    }
  }, [token]);

  useEffect(() => {
    if (owner) void load();
  }, [owner, load]);

  if (!owner) return null;

  const act = async (id: string, action: 'approve' | 'decline') => {
    setBusy(id);
    setError(null);
    HAPTIC.light();
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        email?: string;
        password?: string;
        existed?: boolean;
      };
      if (!res.ok || !json.ok) setError(json.error || 'That did not work.');
      else {
        HAPTIC.success();
        if (json.password && json.email) setMade({ email: json.email, password: json.password });
        setRows((r) => (r ?? []).filter((x) => x.id !== id));
      }
    } catch {
      setError('No connection.');
    }
    setBusy(null);
  };

  // Nothing waiting: stay out of the way rather than showing an empty section.
  if (rows !== null && rows.length === 0 && !made) return null;

  return (
    <>
      <div className="sec">
        <h3>Access requests</h3>
      </div>

      {made && (
        <div className="ar-made">
          <div className="ar-made-k">Account created</div>
          <div className="ar-made-e">{made.email}</div>
          <div className="ar-made-p n">{made.password}</div>
          <p>Send them this password. It is shown once and not stored anywhere.</p>
          <div className="ar-made-row">
            <button
              className="ar-btn key"
              onClick={() => {
                void navigator.clipboard?.writeText(made.password);
                setCopied(true);
                HAPTIC.success();
              }}
            >
              {copied ? 'Copied' : 'Copy password'}
            </button>
            <button
              className="ar-btn"
              onClick={() => {
                setMade(null);
                setCopied(false);
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {error && <div className="ar-err">{error}</div>}

      {rows === null ? (
        <div className="list">
          <div className="li">
            <div className="li-s">Loading…</div>
          </div>
        </div>
      ) : (
        rows.map((r) => (
          <div className="ar-card" key={r.id}>
            <div className="ar-top">
              <div>
                <div className="ar-name">{r.name}</div>
                <div className="ar-email">{r.email}</div>
              </div>
              <span className="ar-when">{when(r.created_at)}</span>
            </div>
            {r.reason ? <p className="ar-why">{r.reason}</p> : null}
            <div className="ar-row">
              <button className="ar-btn key" disabled={busy === r.id} onClick={() => void act(r.id, 'approve')}>
                {busy === r.id ? 'Working…' : 'Approve'}
              </button>
              <button className="ar-btn" disabled={busy === r.id} onClick={() => void act(r.id, 'decline')}>
                Decline
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function when(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
