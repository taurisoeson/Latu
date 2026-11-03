import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/supabase';

const ID = /^(latu|log-\d{4}-\d{2}|nut-\d{4}-\d{2})$/;
const MAX = 2_000_000;

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return NextResponse.json({ code: 'bad_id' }, { status: 400 });
  const { sb, user } = await currentUser();
  if (!user) return NextResponse.json({ code: 'session_expired' }, { status: 401 });
  const text = await req.text();
  if (text.length > MAX) return NextResponse.json({ code: 'too_large' }, { status: 413 });
  let data: unknown;
  try { data = JSON.parse(text); } catch { return NextResponse.json({ code: 'bad_json' }, { status: 400 }); }
  const { error } = await sb.from('docs').upsert({ user_id: user.id, id, data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ code: 'db', message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
