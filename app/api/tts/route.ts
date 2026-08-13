import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A natural British female preset (ElevenLabs "Alice"). Override with the
// ELEVENLABS_VOICE_ID env var to use any voice from your library.
const DEFAULT_VOICE = 'Xb7hH8MSUJpSbSDYk0k2';

// POST { text } -> audio/mpeg (ElevenLabs neural TTS). 503 when no key, so the
// client falls back to the browser voice.
export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: 'not configured' }, { status: 503 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const text = String(body.text || '').slice(0, 800).trim();
  if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5', // low-latency, good quality
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.0 },
        }),
      },
    );
    if (!r.ok) {
      return NextResponse.json({ error: `tts ${r.status}` }, { status: 502 });
    }
    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
