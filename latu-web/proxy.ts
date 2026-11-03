import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_AT, AUTH_AT_OPTS, LOGIN_MS, SB_COOKIE_OPTS } from '@/lib/session';

// Refreshes the Supabase session on every request and ends a sign-in older than LOGIN_DAYS on this device.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const sb = createServerClient(url, key, {
    cookieOptions: SB_COOKIE_OPTS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  if (!data.user) return response;

  const at = Number(request.cookies.get(AUTH_AT)?.value);
  if (!at) {
    // Session from before this check existed: start its window now.
    response.cookies.set(AUTH_AT, String(Date.now()), AUTH_AT_OPTS);
    return response;
  }
  if (Date.now() - at < LOGIN_MS) return response;

  // Expired on this device: sign out locally (other devices keep their own sign-in).
  await sb.auth.signOut({ scope: 'local' });
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  const out = isApi ? NextResponse.json({ code: 'session_expired' }, { status: 401 }) : NextResponse.redirect(new URL('/login', request.url));
  response.cookies.getAll().forEach((c) => out.cookies.set(c));
  out.cookies.delete(AUTH_AT);
  return out;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|shim.js|icon.svg|favicon.ico).*)'],
};
