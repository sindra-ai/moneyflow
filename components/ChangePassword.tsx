'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { HAPTIC } from '@/lib/haptics';

/** Anyone signed in can replace the password they were given with their own. */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const longEnough = pw.length >= 8;
  const matches = pw.length > 0 && pw === again;
  const canSave = longEnough && matches && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    HAPTIC.success();
    setDone(true);
    setPw('');
    setAgain('');
    setTimeout(() => {
      setDone(false);
      setOpen(false);
    }, 2200);
  };

  if (!open) {
    return (
      <button
        className="li"
        onClick={() => {
          HAPTIC.light();
          setOpen(true);
        }}
      >
        <div>
          <div className="li-k">Change password</div>
          <div className="li-s">Set your own instead of the one you were given</div>
        </div>
        <div className="li-v">›</div>
      </button>
    );
  }

  return (
    <div className="li stack">
      <div style={{ width: '100%' }}>
        <div className="li-k">Change password</div>
        <div className="li-s">At least 8 characters.</div>
      </div>

      <div className="cp-fields">
        <input
          className="cp-in"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="New password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <input
          className="cp-in"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Repeat it"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />

        <label className="cp-show">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Show password
        </label>

        {pw && !longEnough && <div className="cp-note">A bit longer: 8 characters or more.</div>}
        {again && !matches && <div className="cp-note">Those two do not match.</div>}
        {error && <div className="cp-note bad">{error}</div>}
        {done && <div className="cp-note ok">Password changed.</div>}

        <div className="cp-row">
          <button className="ar-btn key" disabled={!canSave} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            className="ar-btn"
            onClick={() => {
              setOpen(false);
              setPw('');
              setAgain('');
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
