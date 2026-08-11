'use client';

/** Device-local store for the biometric credential id (never synced — a
 *  passkey is bound to this device, so it can't travel with the account). */
const CRED_KEY = 'moneyflow:biometric';

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(s: string): ArrayBuffer {
  const bin = atob(s);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/** rp.id must be a registrable suffix of the origin; strip www so a passkey
 *  made on www.* still verifies on the apex domain (and vice-versa). */
function rpId(): string {
  const h = typeof location !== 'undefined' ? location.hostname : 'localhost';
  return h === 'localhost' ? 'localhost' : h.replace(/^www\./, '');
}

export function getBiometricCredId(): string | null {
  try {
    return localStorage.getItem(CRED_KEY);
  } catch {
    return null;
  }
}

export function clearBiometric() {
  try {
    localStorage.removeItem(CRED_KEY);
  } catch {
    /* ignore */
  }
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Register a platform passkey and remember its id locally. Returns success. */
export async function registerBiometric(userName: string): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'MoneyFlow', id: rpId() },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: userName || 'MoneyFlow',
          displayName: userName || 'MoneyFlow',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_KEY, b64(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

/** Prompt Face ID / Touch ID for the stored credential. Success = unlocked. */
export async function verifyBiometric(): Promise<boolean> {
  try {
    const id = getBiometricCredId();
    if (!id) return false;
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(id) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
