import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SB_COOKIE_OPTS } from './session';

export const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export async function supabase() {
  const store = await cookies();
  return createServerClient(SB_URL, SB_KEY, {
    cookieOptions: SB_COOKIE_OPTS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a server component */ }
      },
    },
  });
}

export async function currentUser() {
  const sb = await supabase();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}
