import { NextResponse } from 'next/server';
import { currentUser, SB_URL } from '@/lib/supabase';
import html from '@/lib/latu-html';

export const dynamic = 'force-dynamic';

// The training app itself. Served only to a signed-in user; data comes from /api/docs.
export async function GET(req: Request) {
  if (!SB_URL) return new NextResponse('Supabase pole seadistatud: lisa NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY.', { status: 500 });
  const { user } = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));
  const boot = { id: user.id, email: user.email || '', ai: !!process.env.GEMINI_API_KEY };
  const tag = '<script>window.LATU_USER=' + JSON.stringify(boot).replace(/</g, '\\u003c') + ';</script>';
  return new NextResponse(html.replace('<!--LATU_BOOT-->', tag), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
