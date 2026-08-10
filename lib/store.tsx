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
import type { Outgoing, Profile, Settings, Store, ThemeMode } from "./types";
import { defaultStore, newId, seedMonth } from "./seed";
import { monthKey } from "./format";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

const STORAGE_KEY = "moneyflow:v1";

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
    parsed.settings = {
      theme: parsed.settings?.theme ?? "system",
      usdToGbp: parsed.settings?.usdToGbp ?? 0.79,
    };
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
  setProfile: (patch: Partial<Profile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setTheme: (theme: ThemeMode) => void;
  resetSeed: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initialKey = monthKey(new Date());
  const [currentKey, setCurrentKey] = useState(initialKey);
  const [store, setStore] = useState<Store>(() => defaultStore(initialKey));
  const [hydrated, setHydrated] = useState(false);
  const [systemDark, setSystemDark] = useState(true);

  const { user } = useAuth();
  const cloudLoaded = useRef(false);
  const lastSync = useRef<string | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

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
            items: prev.months[priorKey].items.map((it) => ({
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

  const deleteItem = useCallback(
    (id: string) => mutateMonth((m) => ({ ...m, items: m.items.filter((it) => it.id !== id) })),
    [mutateMonth]
  );

  const togglePaid = useCallback(
    (id: string) =>
      mutateMonth((m) => ({
        ...m,
        items: m.items.map((it) => (it.id === id ? { ...it, paid: !it.paid } : it)),
      })),
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

  const resetSeed = useCallback(() => {
    const key = monthKey(new Date());
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
    setProfile,
    setSettings,
    setTheme,
    resetSeed,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
