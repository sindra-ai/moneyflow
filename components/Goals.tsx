'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { moneyCompact } from '@/lib/format';
import { HAPTIC } from '@/lib/haptics';
import { ACCENTS } from '@/lib/types';
import { Check, Plus, Target, Trash } from './icons';

/** Savings goals with a progress bar and quick top-ups. */
export function Goals() {
  const { goals, addGoal, updateGoal, deleteGoal } = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [contribFor, setContribFor] = useState<string | null>(null);
  const [amt, setAmt] = useState('');

  const create = () => {
    const t = parseFloat(target.replace(/[^0-9.]/g, ''));
    if (!name.trim() || !Number.isFinite(t) || t <= 0) {
      setAdding(false);
      return;
    }
    addGoal({
      name: name.trim().slice(0, 40),
      target: Math.round(t),
      saved: 0,
      accent: ACCENTS[goals.length % ACCENTS.length],
    });
    HAPTIC.success();
    setName('');
    setTarget('');
    setAdding(false);
  };

  const contribute = (id: string, saved: number) => {
    const v = parseFloat(amt.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(v) && v !== 0) {
      updateGoal(id, { saved: Math.max(0, Math.round((saved + v) * 100) / 100) });
      HAPTIC.success();
    }
    setAmt('');
    setContribFor(null);
  };

  return (
    <>
      {goals.length > 0 && (
        <div className="goals">
          {goals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
            const done = g.target > 0 && g.saved >= g.target;
            return (
              <div className="goal" key={g.id}>
                <div className="goal-top">
                  <span className="goal-name">
                    {g.name}
                    {done && <Check size={13} />}
                  </span>
                  <span className="goal-fig n">
                    {moneyCompact(g.saved)}
                    <span className="goal-of"> / {moneyCompact(g.target)}</span>
                  </span>
                </div>
                <div className="goal-bar">
                  <i style={{ width: `${pct}%`, background: done ? 'var(--good)' : g.accent }} />
                </div>
                <div className="goal-acts">
                  {contribFor === g.id ? (
                    <input
                      className="goal-in n"
                      autoFocus
                      inputMode="decimal"
                      placeholder="+ amount  (− to take out)"
                      value={amt}
                      onChange={(e) => setAmt(e.target.value)}
                      onBlur={() => contribute(g.id, g.saved)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') {
                          setAmt('');
                          setContribFor(null);
                        }
                      }}
                    />
                  ) : (
                    <>
                      <button
                        className="goal-add"
                        onClick={() => {
                          HAPTIC.light();
                          setContribFor(g.id);
                          setAmt('');
                        }}
                      >
                        <Plus size={13} /> Add money
                      </button>
                      <button
                        className="goal-del"
                        onClick={() => {
                          HAPTIC.light();
                          deleteGoal(g.id);
                        }}
                        aria-label={`Delete ${g.name}`}
                      >
                        <Trash size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <div className="goal-new">
          <input
            className="in"
            placeholder="Goal name (e.g. Holiday)"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="in n"
            inputMode="decimal"
            placeholder="Target £"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create();
            }}
          />
          <div className="goal-new-acts">
            <button
              className="goal-cancel"
              onClick={() => {
                setAdding(false);
                setName('');
                setTarget('');
              }}
            >
              Cancel
            </button>
            <button className="goal-save" onClick={create}>
              Add goal
            </button>
          </div>
        </div>
      ) : (
        <button
          className="goal-cta"
          onClick={() => {
            HAPTIC.light();
            setAdding(true);
          }}
        >
          <Target size={15} /> New savings goal
        </button>
      )}
    </>
  );
}
