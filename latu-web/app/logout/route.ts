import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { AUTH_AT } from '@/lib/session';

export async function POST(req: Request) {
  const sb = await supabase();
  await sb.auth.signOut({ scope: 'local' });
  const res = NextResponse.redirect(new URL('/login', req.url), { status: 303 });
  res.cookies.delete(AUTH_AT);
  return res;
}
