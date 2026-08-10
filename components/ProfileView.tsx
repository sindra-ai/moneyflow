"use client";

import React, { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { ThemeMode } from "@/lib/types";
import { money, toGbp } from "@/lib/format";
import { Camera, Moon, Refresh, Sun, User, Wallet } from "./icons";

/** Downscale an image file to a small square data URL for localStorage. */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

export default function ProfileView() {
  const { store, items, setProfile, setSettings, setTheme, resetSeed } = useStore();
  const { profile, settings } = store;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const summary = useMemo(() => {
    const total = items.reduce((s, it) => s + toGbp(it, settings), 0);
    const monthCount = Object.keys(store.months).length;
    return { total, monthCount, itemCount: items.length };
  }, [items, settings, store.months]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToAvatar(file);
      setProfile({ avatar: url });
    } catch {
      /* ignore bad image */
    }
    e.target.value = "";
  };

  const initials =
    profile.name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "";

  return (
    <div className="view-scroll">
      <header className="topbar">
        <h1>Profile</h1>
      </header>

      <section className="glass profile-head">
        <div className="avatar" onClick={() => fileRef.current?.click()}>
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt="Avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : initials ? (
            <span>{initials}</span>
          ) : (
            <User size={38} />
          )}
          <span className="avatar-edit">
            <Camera size={16} />
          </span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onPick}
        />

        <input
          className="profile-name"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            textAlign: "center",
          }}
          value={profile.name}
          placeholder="Your name"
          onChange={(e) => setProfile({ name: e.target.value })}
          aria-label="Your name"
        />
        <div className="muted">Tap the avatar to change your photo</div>
      </section>

      <div className="section-head" style={{ marginTop: 20 }}>
        <h2>This month</h2>
      </div>
      <div className="hero-row" style={{ marginTop: 0 }}>
        <div className="stat glass-soft">
          <div className="k">Outgoings</div>
          <div className="v tnum">{summary.itemCount}</div>
        </div>
        <div className="stat glass-soft">
          <div className="k">Total out</div>
          <div className="v tnum">{money(summary.total)}</div>
        </div>
        <div className="stat glass-soft">
          <div className="k">Months</div>
          <div className="v tnum">{summary.monthCount}</div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 22 }}>
        <h2>Appearance</h2>
      </div>
      <div className="glass list-card">
        <div className="list-item">
          <div className="li-left">
            <div className="li-ic">
              {settings.theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
            </div>
            <div>
              <div className="li-title">Theme</div>
              <div className="li-sub">Choose your mode</div>
            </div>
          </div>
          <div className="theme-seg">
            {THEMES.map((t) => (
              <button
                key={t.key}
                className={settings.theme === t.key ? "on" : ""}
                onClick={() => setTheme(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 22 }}>
        <h2>Preferences</h2>
      </div>
      <div className="glass list-card">
        <div className="list-item">
          <div className="li-left">
            <div className="li-ic">
              <Wallet size={18} />
            </div>
            <div>
              <div className="li-title">USD → GBP rate</div>
              <div className="li-sub">Used for $ items in totals</div>
            </div>
          </div>
          <input
            className="input tnum"
            style={{ width: 90, textAlign: "right", padding: "10px 12px" }}
            inputMode="decimal"
            defaultValue={settings.usdToGbp}
            onBlur={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n) && n > 0) setSettings({ usdToGbp: n });
              else e.target.value = String(settings.usdToGbp);
            }}
            aria-label="USD to GBP rate"
          />
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 22 }}>
        <h2>Data</h2>
      </div>
      <div className="glass list-card">
        <button
          className="list-item"
          style={{ width: "100%", textAlign: "left" }}
          onClick={() => {
            if (confirmReset) {
              resetSeed();
              setConfirmReset(false);
            } else {
              setConfirmReset(true);
              window.setTimeout(() => setConfirmReset(false), 4000);
            }
          }}
        >
          <div className="li-left">
            <div className="li-ic">
              <Refresh size={18} />
            </div>
            <div>
              <div className="li-title" style={{ color: confirmReset ? "var(--danger)" : undefined }}>
                {confirmReset ? "Tap again to confirm" : "Reset to sample data"}
              </div>
              <div className="li-sub">Restores the starter outgoings list</div>
            </div>
          </div>
        </button>
      </div>

      <p className="muted" style={{ textAlign: "center", marginTop: 24 }}>
        MoneyFlow · saved on this device
      </p>
    </div>
  );
}
