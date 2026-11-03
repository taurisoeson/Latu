import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/supabase';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type Turn = { role: string; content: string };
type Img = { mime: string; b64: string };
type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
type GenConfig = Record<string, unknown>;

const BASE = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta') + '/models/';
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fail(code: string, status: number, message?: string) {
  return NextResponse.json({ code, message }, { status });
}

async function geminiError(r: Response) {
  let detail = '';
  try { const j = await r.json(); detail = j?.error?.message || ''; } catch { /* not json */ }
  detail = ('Gemini ' + r.status + (detail ? ': ' + detail : '')).slice(0, 300);
  if (r.status === 429) return fail('rate_limited', 429, detail);
  if (r.status === 401 || r.status === 403) return fail('error', 403, 'API võti ei kehti või pole lubatud. ' + detail);
  if (r.status === 404) return fail('error', 404, 'Mudelit ei leitud, muuda GEMINI_MODEL. ' + detail);
  return fail('error', 502, detail);
}

// Thinking models (Gemini 3) are slow at their default effort; ask for low effort.
// Older models reject thinkingLevel, so retry once without it.
async function callGemini(url: string, key: string, payload: { generationConfig: GenConfig } & Record<string, unknown>, signal?: AbortSignal) {
  const headers = { 'content-type': 'application/json', 'x-goog-api-key': key };
  const withThinking = { ...payload, generationConfig: { ...payload.generationConfig, thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING || 'low' } } };
  let r = await fetch(url, { method: 'POST', headers, signal, body: JSON.stringify(withThinking) });
  if (r.status === 400) {
    const peek = await r.clone().text();
    if (/thinking/i.test(peek)) r = await fetch(url, { method: 'POST', headers, signal, body: JSON.stringify(payload) });
  }
  return r;
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

const textOf = (j: { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }) =>
  (j?.candidates?.[0]?.content?.parts || []).map((p) => (p.thought ? '' : p.text || '')).join('');

// Diagnostics: open /api/ai in the browser (signed in) to test the key and model.
export async function GET() {
  const { user } = await currentUser();
  if (!user) return fail('session_expired', 401);
  const key = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  if (!key) return NextResponse.json({ ok: false, model, error: 'GEMINI_API_KEY puudub Verceli seadetes (või pole pärast lisamist Redeploy tehtud).' });
  const t0 = Date.now();
  try {
    const r = await callGemini(BASE + model + ':generateContent', key, { contents: [{ role: 'user', parts: [{ text: 'Vasta ühe sõnaga: tere' }] }], generationConfig: { maxOutputTokens: 512 } });
    const ms = Date.now() - t0;
    if (!r.ok) { const e = await geminiError(r); return NextResponse.json({ ok: false, model, ms, error: (await e.json()).message }); }
    return NextResponse.json({ ok: true, model, ms, answer: textOf(await r.json()) });
  } catch (e) {
    return NextResponse.json({ ok: false, model, error: String(e) });
  }
}

export async function POST(req: Request) {
  const { user } = await currentUser();
  if (!user) return fail('session_expired', 401);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail('sampling_disabled', 503);
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  let body: { mode?: string; turns?: Turn[]; prompt?: string; images?: Img[] };
  try { body = await req.json(); } catch { return fail('bad_json', 400); }

  if (body.mode === 'json') {
    const parts: Part[] = [{ text: String(body.prompt || '').slice(0, 20000) }];
    for (const im of (body.images || []).slice(0, 2)) {
      if (IMG_TYPES.includes(im.mime) && typeof im.b64 === 'string' && im.b64.length < 6_000_000) parts.push({ inline_data: { mime_type: im.mime, data: im.b64 } });
    }
    let r: Response;
    try {
      r = await callGemini(BASE + model + ':generateContent', key, { contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 8192 } }, req.signal);
    } catch (e) { return fail('error', 502, 'Gemini ühendus ebaõnnestus: ' + String(e)); }
    if (!r.ok) return geminiError(r);
    const text = textOf(await r.json()).replace(/^```(?:json)?\s*|\s*```$/g, '');
    try { return NextResponse.json({ data: JSON.parse(text) }); } catch { return fail('refused', 502, 'AI vastus polnud JSON'); }
  }

  const { system, contents } = toContents(Array.isArray(body.turns) ? body.turns.slice(-30) : []);
  if (!contents.length) return fail('bad_request', 400);
  let r: Response;
  try {
    r = await callGemini(BASE + model + ':streamGenerateContent?alt=sse', key, {
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system.slice(0, 120000) }] } } : {}),
      generationConfig: { temperature: 0.6, maxOutputTokens: 8192 },
    }, req.signal);
  } catch (e) { return fail('error', 502, 'Gemini ühendus ebaõnnestus: ' + String(e)); }
  if (!r.ok || !r.body) return geminiError(r);

  // Re-stream Gemini's SSE as plain text chunks.
  const reader = r.body.getReader();
  const dec = new TextDecoder(), enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      let buf = '', sent = 0, finish = '';
      const handle = (line: string) => {
        if (!line.startsWith('data:')) return;
        try {
          const j = JSON.parse(line.slice(5));
          const t = textOf(j);
          if (t) { ctrl.enqueue(enc.encode(t)); sent += t.length; }
          finish = j?.candidates?.[0]?.finishReason || j?.promptFeedback?.blockReason || finish;
        } catch { /* partial line */ }
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i).trim()); buf = buf.slice(i + 1); }
        }
        handle(buf.trim());
      } catch { /* aborted */ }
      if (!sent) ctrl.enqueue(enc.encode('(AI ei andnud vastust' + (finish && finish !== 'STOP' ? ', põhjus: ' + finish : '') + '. Proovi uuesti.)'));
      else if (finish === 'MAX_TOKENS') ctrl.enqueue(enc.encode('\n\n(vastus jäi pikkuse piirangu tõttu pooleli)'));
      ctrl.close();
    },
    cancel() { reader.cancel().catch(() => {}); },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}
