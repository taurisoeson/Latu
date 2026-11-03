'use server';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export type State = { error?: string; info?: string; email?: string };

function msg(m: string) {
  m = m || '';
  if (/invalid login/i.test(m)) return 'Vale e-post või parool.';
  if (/email not confirmed/i.test(m)) return 'Kinnita e-post: vaata postkasti ja vajuta kinnituslinki.';
  if (/password/i.test(m)) return 'Parool peab olema vähemalt 8 märki.';
  if (/rate limit/i.test(m)) return 'Liiga palju katseid. Oota natuke.';
  return m || 'Sisselogimine ebaõnnestus. Proovi uuesti.';
}

export async function signIn(_: State, form: FormData): Promise<State> {
  const email = String(form.get('email') || '').trim(), password = String(form.get('password') || '');
  if (!email || !password) return { error: 'Sisesta e-post ja parool.', email };
  const sb = await supabase();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: msg(error.message), email };
  redirect('/');
}

export async function signUp(_: State, form: FormData): Promise<State> {
  if (process.env.ALLOW_SIGNUP !== '1') return { error: 'Uute kontode loomine on suletud.' };
  const email = String(form.get('email') || '').trim(), password = String(form.get('password') || '');
  if (!email || password.length < 8) return { error: 'Sisesta e-post ja vähemalt 8-märgiline parool.', email };
  const sb = await supabase();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return { error: msg(error.message), email };
  if (data.session) redirect('/');
  return { email, info: 'Konto loodud. Kinnita e-post postkastis olevast lingist ja logi siis sisse.' };
}
