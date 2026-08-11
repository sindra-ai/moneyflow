'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface ToastState {
  message: string;
  action?: { label: string; run: () => void };
}

const ToastCtx = createContext<(t: ToastState) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

const LIFE = 4200;
const EXIT = 520;

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [open, setOpen] = useState(false);
  const hide = useRef<number | null>(null);
  const drop = useRef<number | null>(null);

  const clear = () => {
    if (hide.current) window.clearTimeout(hide.current);
    if (drop.current) window.clearTimeout(drop.current);
  };

  const show = useCallback((t: ToastState) => {
    clear();
    setToast(t);
    // Mount first, then flip `open` so the transform has somewhere to move from.
    window.setTimeout(() => setOpen(true), 24);
    hide.current = window.setTimeout(() => {
      setOpen(false);
      drop.current = window.setTimeout(() => setToast(null), EXIT);
    }, LIFE);
  }, []);

  useEffect(() => clear, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" data-on={open} role="status">
          <p>{toast.message}</p>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.run();
                clear();
                setOpen(false);
                drop.current = window.setTimeout(() => setToast(null), EXIT);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
