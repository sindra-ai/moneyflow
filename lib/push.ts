'use client';

/** Client-side Web Push: subscribe this device and store the subscription in
 *  Supabase so the daily cron can send reminders even when the app is closed. */

import { supabase } from './supabase';

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushResult = 'ok' | 'denied' | 'unsupported' | 'unconfigured' | 'error';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Is this device already subscribed to push? */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!(reg && (await reg.pushManager.getSubscription()));
  } catch {
    return false;
  }
}

/** Subscribe this device and persist the subscription for the given user. */
export async function enablePush(userId: string): Promise<PushResult> {
  if (!PUB) return 'unconfigured';
  if (!pushSupported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUB) as unknown as BufferSource,
      });
    }
    const json = sub.toJSON();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ endpoint: json.endpoint, user_id: userId, sub: json }, { onConflict: 'endpoint' });
    return error ? 'error' : 'ok';
  } catch {
    return 'error';
  }
}

/** Ask the server to send a one-off test push to this device. */
export async function sendTestPush(): Promise<'ok' | 'nosub' | 'unconfigured' | 'error'> {
  if (!pushSupported()) return 'error';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (!sub) return 'nosub';
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (res.status === 503) return 'unconfigured';
    const d = (await res.json()) as { ok?: boolean };
    return d.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

/** Unsubscribe this device and remove its stored subscription. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      try {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}
