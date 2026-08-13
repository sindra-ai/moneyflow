import webpush from 'web-push';

/** Server-only Web Push sender (VAPID). */

export function havePush(): boolean {
  return !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:info@sindra.ai',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send one push. `gone` is true when the subscription is dead (404/410) and
 *  should be deleted. */
export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  configure();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true, gone: false };
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return { ok: false, gone: code === 404 || code === 410 };
  }
}
