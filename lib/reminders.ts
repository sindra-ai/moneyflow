'use client';

import type { Store } from './types';
import { ordinal } from './format';

export type Perm = NotificationPermission | 'unsupported';

export function reminderPermission(): Perm {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** Ask the OS for notification permission (must be from a user gesture). */
export async function requestReminderPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

/** Register the notification service worker (idempotent). */
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

/** How many days out counts as "due soon". */
const WINDOW = 2;

/**
 * Surface unpaid bills due within the next couple of days as a real system
 * notification. Fires at most once per day (deduped in localStorage), so
 * opening the app repeatedly doesn't nag. Works with no backend — the trade
 * is it only runs while the app is opened; true closed-app push needs a
 * server cron.
 */
export async function runDueCheck(store: Store): Promise<void> {
  if (!store.settings.reminders) return;
  if (reminderPermission() !== 'granted') return;

  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = store.months[key];
  if (!month) return;

  const today = now.getDate();
  const soon = month.items.filter(
    (it) => !it.paid && it.dueDay != null && it.dueDay >= today && it.dueDay <= today + WINDOW,
  );
  if (soon.length === 0) return;

  // One reminder per calendar day.
  const stamp = `moneyflow:reminded:${key}-${today}`;
  try {
    if (localStorage.getItem(stamp)) return;
    localStorage.setItem(stamp, '1');
  } catch {
    /* storage blocked — still show it */
  }

  const title = soon.length === 1 ? `${soon[0].name} due soon` : `${soon.length} bills due soon`;
  const body =
    soon.length === 1
      ? `£${soon[0].amount} · due the ${ordinal(soon[0].dueDay as number)}`
      : soon.map((i) => i.name).join(', ');

  const opts: NotificationOptions = {
    body,
    icon: '/icons/app-icon-v4-192.png',
    badge: '/icons/app-icon-v4-192.png',
    tag: 'due-soon',
  };

  try {
    const reg =
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null;
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch {
    /* notification failed — ignore */
  }
}
