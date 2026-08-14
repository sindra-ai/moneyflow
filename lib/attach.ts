'use client';

/** Turn a picked file into an attachment the chat API can send to Claude.
 *  Images are downscaled client-side so uploads stay small; PDFs and small
 *  text files are passed through. Returns null for unsupported files. */

export interface ChatAttachment {
  kind: 'image' | 'pdf' | 'text';
  mediaType?: string;
  data: string; // base64 (image/pdf) or raw text
  name: string;
  preview?: string; // data URL for a thumbnail (images only)
}

const MAX_IMG = 1568; // Anthropic's recommended max edge
const MAX_PDF = 3.5 * 1024 * 1024;
const MAX_TEXT = 20000;

function readDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

async function resizeImage(file: File): Promise<{ data: string; preview: string }> {
  const dataUrl = await readDataUrl(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('decode failed'));
    i.src = dataUrl;
  });
  const scale = Math.min(1, MAX_IMG / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL('image/jpeg', 0.82);
  return { data: out.split(',')[1] || '', preview: out };
}

export async function fileToAttachment(file: File): Promise<ChatAttachment | null> {
  try {
    if (file.type.startsWith('image/')) {
      const { data, preview } = await resizeImage(file);
      return { kind: 'image', mediaType: 'image/jpeg', data, name: file.name || 'photo', preview };
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      if (file.size > MAX_PDF) return null; // too big to upload
      const data = (await readDataUrl(file)).split(',')[1] || '';
      return { kind: 'pdf', mediaType: 'application/pdf', data, name: file.name || 'document.pdf' };
    }
    if (file.type.startsWith('text/') || /\.(txt|csv|md|json)$/i.test(file.name)) {
      const text = (await file.text()).slice(0, MAX_TEXT);
      return { kind: 'text', data: text, name: file.name || 'file.txt' };
    }
    return null;
  } catch {
    return null;
  }
}
