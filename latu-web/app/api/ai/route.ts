import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/supabase';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type Turn = { role: string; content: string };
type Img = { mime: string; b64: string };
type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

const BASE = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta') + '/models/';
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fail(code: string, status: number, message?: string) {
  return NextResponse.json({ code, message }, { status });
}

function mapStatus(s: number) {
  if (s === 429) return fail('rate_limited', 429);
  if (s === 400) return fail('prompt_too_large', 400);
  if (s === 401 || s === 403) return fail('not_granted', 403);
  return fail('error', 502);
}

// Gemini wants alternating user/model turns; the first app turn (the data prompt) becomes the system instruction.
function toContents(turns: Turn[]) {
  const list = turns.filter((t) => t && typeof t.content === 'string' && t.content.trim());
  const system = list.length && list[0].role === 'user' && list.length > 1 ? list.shift()!.content : '';
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const t of list) {
    const role = t.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += '\n\n' + t.content;
    else contents.push({ role, parts: [{ text: t.content.slice(0, 60000) }] });
  }
  if (contents.length && contents[0].role === 'model') contents.unshift({ role: 'user', parts: [{ text: '(algus)' }] });
  return { system, contents };
}

export async function POST(req: Request) {
  const { user } = await currentUser();
  if (!user) return fail('session_expired', 401);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail('sampling_disabled', 503);
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  let body: { mode?: string; turns?: Turn[]; prompt?: string; images?: Img[] };
  try { body = await req.json(); } catch { return fail('bad_json', 400); }
  const headers = { 'content-type': 'application/json', 'x-goog-api-key': key };

  if (body.mode === 'json') {
    const parts: Part[] = [{ text: String(body.prompt || '').slice(0, 20000) }];
    for (const im of (body.images || []).slice(0, 2)) {
      if (IMG_TYPES.includes(im.mime) && typeof im.b64 === 'string' && im.b64.length < 6_000_000) parts.push({ inline_data: { mime_type: im.mime, data: im.b64 } });
    }
    const r = await fetch(BASE + model + ':generateContent', {
      method: 'POST', headers,
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 2048 } }),
    });
    if (!r.ok) return mapStatus(r.status);
    const j = await r.json();
    const text: string = (j?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    try { return NextResponse.json({ data: JSON.parse(text) }); } catch { return fail('refused', 502, 'AI vastus polnud JSON'); }
  }

  const { system, contents } = toContents(Array.isArray(body.turns) ? body.turns.slice(-30) : []);
  if (!contents.length) return fail('bad_request', 400);
  const r = await fetch(BASE + model + ':streamGenerateContent?alt=sse', {
    method: 'POST', headers, signal: req.signal,
    body: JSON.stringify({
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system.slice(0, 120000) }] } } : {}),
      generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
    }),
  });
  if (!r.ok || !r.body) return mapStatus(r.status);

  // Re-stream Gemini's SSE as plain text chunks.
  const reader = r.body.getReader();
  const dec = new TextDecoder(), enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      let buf = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            try {
              const j = JSON.parse(line.slice(5));
              const t = (j?.candidates?.[0]?.content?.parts || []).map((p: { text?: string; thought?: boolean }) => (p.thought ? '' : p.text || '')).join('');
              if (t) ctrl.enqueue(enc.encode(t));
            } catch { /* partial line */ }
          }
        }
      } catch { /* aborted */ }
      ctrl.close();
    },
    cancel() { reader.cancel().catch(() => {}); },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
