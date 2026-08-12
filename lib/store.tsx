"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BankConn, MonthData, Outgoing, Profile, Settings, Store, ThemeMode } from "./types";
import { defaultStore, newId, seedMonth, DEFAULT_SETTINGS } from "./seed";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

const STORAGE_KEY = "moneyflow:v1";

/* ------------------------------------------------------------------ dates */
// Exported so v2's components / derive.ts can import them from the store.

export function monthKeyOf(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** 0 = Monday … 6 = Sunday, for the 1st of the month. */
export function firstWeekdayOf(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return (new Date(y, m - 1, 1).getDay() + 6) % 7;
}

/* ------------------------------------------------------- month derivation */

const baseId = (id: string) => id.split("@")[0];

/**
 * A month the user hasn't touched yet shows the nearest prior month's
 * recurring bills, reset to unpaid. Ids are deterministic so the derived view
 * and the materialised copy agree. Used by derive.ts's history projection.
 */
export function deriveMonth(months: Record<string, MonthData>, key: string): MonthData {
  const keys = Object.keys(months).sort();
  const prior = keys.filter((k) => k < key).pop();
  const source = prior ?? keys.find((k) => k > key);
  if (!source) return seedMonth();
  const src = months[source];
  return {
    salary: src.salary,
    // One-offs belong only to their own month, so they don't carry across.
    items: src.items
      .filter((it) => it.recurring !== false)
      .map((it) => ({ ...it, id: `${baseId(it.id)}@${key}`, paid: false })),
  };
}

/* ----------------------------------------------------------- derived math */

export interface Totals {
  total: number;
  paid: number;
  left: number;
  leftOver: number;
  paidCount: number;
  count: number;
  progress: number;
}

export function computeTotals(month: MonthData): Totals {
  let total = 0;
  let paid = 0;
  let paidCount = 0;

  for (const it of month.items) {
    const amt = it.amount || 0;
    total += amt;
    if (it.paid) {
      paid += amt;
      paidCount += 1;
    }
  }

  const count = month.items.length;
  return {
    total,
    paid,
    left: total - paid,
    leftOver: month.salary - total,
    paidCount,
    count,
    progress: count === 0 ? 0 : paidCount / count,
  };
}

function loadStore(currentKey: string): Store {
  if (typeof window === "undefined") return defaultStore(currentKey);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore(currentKey);
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || typeof parsed !== "object" || !parsed.months) {
      return defaultStore(currentKey);
    }
    // Defensive fill for older/partial data.
    parsed.profile = parsed.profile ?? { name: "", avatar: null };
    parsed.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) };
    // Backfill fields added after the currency removal so old items render.
    for (const key of Object.keys(parsed.months)) {
      const m = parsed.months[key];
      m.items = (m.items ?? []).map((it) => ({
        ...it,
        category: it.category ?? "Bills",
        recurring: it.recurring ?? true,
      }));
    }
    return parsed;
  } catch {
    return defaultStore(currentKey);
  }
}

/** Pick the most recent existing month at or before `key`. */
function nearestPriorKey(months: Record<string, unknown>, key: string): string | null {
  const keys = Object.keys(months)
    .filter((k) => k < key)
    .sort();
  return keys.length ? keys[keys.length - 1] : null;
}

interface StoreContextValue {
  store: Store;
  hydrated: boolean;
  currentKey: string;
  setCurrentKey: (key: string) => void;
  resolvedTheme: "dark" | "light";
  // month data
  salary: number;
  items: Outgoing[];
  // mutations
  setSalary: (value: number) => void;
  addItem: (item: Omit<Outgoing, "id">) => void;
  updateItem: (id: string, patch: Partial<Outgoing>) => void;
  deleteItem: (id: string) => void;
  togglePaid: (id: string) => void;
  markAll: (paid: boolean) => void;
  reorderItems: (items: Outgoing[]) => void;
  setProfile: (patch: Partial<Profile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setTheme: (theme: ThemeMode) => void;
  resetSeed: () => void;
  // --- v2 UI adapter surface ---
  ready: boolean;
  monthKey: string;
  setMonthKey: (key: string) => void;
  month: MonthData;
  stepMonth: (delta: number) => void;
  setAllPaid: (paid: boolean) => void;
  reorder: (from: number, to: number) => void;
  resetToSample: () => void;
  snapshot: () => void;
  undo: () => void;
  // --- bank connection (synced) ---
  bank: BankConn | null;
  setBank: (conn: BankConn | null) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initialKey = monthKeyOf();
  const [currentKey, setCurrentKey] = useState(initialKey);
  const [store, setStore] = useState<Store>(() => defaultStore(initialKey));
  const [hydrated, setHydrated] = useState(false);
  const [systemDark, setSystemDark] = useState(true);

  const { user } = useAuth();
  const cloudLoaded = useRef(false);
  const lastSync = useRef<string | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;
  // Snapshot of `months` taken before a destructive action, for one-level undo.
  const undoRef = useRef<Record<string, MonthData> | null>(null);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setStore(loadStore(initialKey));
    setHydrated(true);
    // Ask the browser to keep our data durable (resists automatic eviction,
    // e.g. iOS Safari clearing storage for sites unused for 7 days).
    try {
      navigator.storage?.persist?.();
    } catch {
      /* not supported — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whenever the store changes (post-hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* storage full / unavailable — ignore */
    }
  }, [store, hydrated]);

  // --- Cloud sync (Supabase) ---
  // On login, pull the user's saved state from the cloud; if they have none
  // yet, seed the cloud from whatever is on this device.
  useEffect(() => {
    if (!hydrated || !user) {
      cloudLoaded.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_state")
        .select("data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || error) return;
      const cloud = data?.data as Store | undefined;
      if (cloud && cloud.months) {
        setStore(cloud);
        lastSync.current = (data?.updated_at as string) ?? null;
      } else {
        const now = new Date().toISOString();
        await supabase
          .from("user_state")
          .upsert({ user_id: user.id, data: storeRef.current, updated_at: now });
        lastSync.current = now;
      }
      cloudLoaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [user, hydrated]);

  // Push local changes up to the cloud (debounced) once it has loaded.
  useEffect(() => {
    if (!user || !cloudLoaded.current) return;
    const t = window.setTimeout(async () => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("user_state")
        .upsert({ user_id: user.id, data: store, updated_at: now });
      if (!error) lastSync.current = now;
    }, 700);
    return () => window.clearTimeout(t);
  }, [store, user]);

  // Re-pull the latest whenever the app regains focus, so each device stays
  // accurate when you open it.
  useEffect(() => {
    if (!user) return;
    const refetch = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible")
        return;
      const { data, error } = await supabase
        .from("user_state")
        .select("data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) return;
      const cloud = data.data as Store | undefined;
      if (cloud && cloud.months && data.updated_at !== lastSync.current) {
        setStore(cloud);
        lastSync.current = data.updated_at as string;
      }
    };
    document.addEventListener("visibilitychange", refetch);
    window.addEventListener("focus", refetch);
    return () => {
      document.removeEventListener("visibilitychange", refetch);
      window.removeEventListener("focus", refetch);
    };
  }, [user]);

  // Track system colour scheme.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const resolvedTheme: "dark" | "light" =
    store.settings.theme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : store.settings.theme;

  // Reflect theme on <html>.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  // Ensure the visible month exists — carry recurring bills forward.
  useEffect(() => {
    if (!hydrated) return;
    setStore((prev) => {
      if (prev.months[currentKey]) return prev;
      const priorKey = nearestPriorKey(prev.months, currentKey);
      const carried = priorKey
        ? {
            salary: prev.months[priorKey].salary,
            items: prev.months[priorKey].items
              // One-offs stay in their own month only.
              .filter((it) => it.recurring !== false)
              .map((it) => ({
                ...it,
                id: newId(),
                paid: false,
              })),
          }
        : seedMonth();
      return { ...prev, months: { ...prev.months, [currentKey]: carried } };
    });
  }, [currentKey, hydrated]);

  const month = store.months[currentKey];
  const salary = month?.salary ?? 0;
  const items = useMemo(() => month?.items ?? [], [month]);
  // v2 components read `month` as a MonthData; keep it defined even for a
  // never-visited month (the materialize effect fills it in a frame later).
  const monthData = useMemo<MonthData>(() => ({ salary, items }), [salary, items]);

  const mutateMonth = useCallback(
    (fn: (m: { salary: number; items: Outgoing[] }) => { salary: number; items: Outgoing[] }) => {
      setStore((prev) => {
        const cur = prev.months[currentKey] ?? { salary: 0, items: [] };
        return { ...prev, months: { ...prev.months, [currentKey]: fn(cur) } };
      });
    },
    [currentKey]
  );

  const setSalary = useCallback(
    (value: number) => mutateMonth((m) => ({ ...m, salary: Math.max(0, value) })),
    [mutateMonth]
  );

  const addItem = useCallback(
    (item: Omit<Outgoing, "id">) =>
      mutateMonth((m) => ({ ...m, items: [...m.items, { ...item, id: newId() }] })),
    [mutateMonth]
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<Outgoing>) =>
      mutateMonth((m) => ({
        ...m,
        items: m.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      })),
    [mutateMonth]
  );

  const snapshot = useCallback(() => {
    undoRef.current = storeRef.current.months;
  }, []);

  const undo = useCallback(() => {
    const prev = undoRef.current;
    if (!prev) return;
    undoRef.current = null;
    setStore((s) => ({ ...s, months: prev }));
  }, []);

  const deleteItem = useCallback(
    (id: string) => {
      snapshot();
      mutateMonth((m) => ({ ...m, items: m.items.filter((it) => it.id !== id) }));
    },
    [mutateMonth, snapshot]
  );

  const togglePaid = useCallback(
    (id: string) =>
      mutateMonth((m) => ({
        ...m,
        items: m.items.map((it) => (it.id === id ? { ...it, paid: !it.paid } : it)),
      })),
    [mutateMonth]
  );

  const markAll = useCallback(
    (paid: boolean) => {
      snapshot();
      mutateMonth((m) => ({ ...m, items: m.items.map((it) => ({ ...it, paid })) }));
    },
    [mutateMonth, snapshot]
  );

  const reorderItems = useCallback(
    (items: Outgoing[]) => mutateMonth((m) => ({ ...m, items })),
    [mutateMonth]
  );

  // v2's Ledger reorders by (from, to) index rather than a full array.
  const reorder = useCallback(
    (from: number, to: number) => {
      mutateMonth((m) => {
        if (from === to || from < 0 || from >= m.items.length) return m;
        const next = m.items.slice();
        const [moved] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
        return { ...m, items: next };
      });
    },
    [mutateMonth]
  );

  const setProfile = useCallback(
    (patch: Partial<Profile>) =>
      setStore((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } })),
    []
  );

  const setSettings = useCallback(
    (patch: Partial<Settings>) =>
      setStore((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } })),
    []
  );

  const setTheme = useCallback(
    (theme: ThemeMode) => setSettings({ theme }),
    [setSettings]
  );

  const setBank = useCallback(
    (conn: BankConn | null) => setStore((prev) => ({ ...prev, bank: conn })),
    []
  );

  const resetSeed = useCallback(() => {
    const key = monthKeyOf();
    setCurrentKey(key);
    setStore(defaultStore(key));
  }, []);

  const value: StoreContextValue = {
    store,
    hydrated,
    currentKey,
    setCurrentKey,
    resolvedTheme,
    salary,
    items,
    setSalary,
    addItem,
    updateItem,
    deleteItem,
    togglePaid,
    markAll,
    reorderItems,
    setProfile,
    setSettings,
    setTheme,
    resetSeed,
    // --- v2 UI adapter surface ---
    ready: hydrated,
    monthKey: currentKey,
    setMonthKey: setCurrentKey,
    month: monthData,
    stepMonth: (delta: number) => setCurrentKey(shiftMonth(currentKey, delta)),
    setAllPaid: markAll,
    reorder,
    resetToSample: resetSeed,
    snapshot,
    undo,
    bank: store.bank ?? null,
    setBank,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
