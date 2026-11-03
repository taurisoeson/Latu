'use client';
import { useActionState, useEffect, useState } from 'react';
import { signIn, signUp, type State } from './actions';

const field = 'w-full rounded-xl border border-white/12 bg-white/[.06] px-4 py-3 text-[15px] text-snow placeholder:text-snow/35 outline-none transition focus:border-fjord focus:bg-white/[.09]';

export default function LoginForm({ allowSignup, days }: { allowSignup: boolean; days: number }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  // Signed out: drop this browser's cached copy of the training data.
  useEffect(() => { try { ['latu-v2', 'latu-v1', 'latu-owner'].forEach((k) => localStorage.removeItem(k)); } catch {} }, []);
  const [inState, inAction, inPending] = useActionState<State, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<State, FormData>(signUp, {});
  const st = mode === 'in' ? inState : upState, pending = mode === 'in' ? inPending : upPending;
  return (
    <form action={mode === 'in' ? inAction : upAction} className="space-y-3 rounded-2xl border border-white/10 bg-night/70 p-5 shadow-2xl backdrop-blur">
      <h1 className="font-display text-xl font-semibold">{mode === 'in' ? 'Logi sisse' : 'Loo konto'}</h1>
      <label className="block text-sm text-snow/70">E-post
        <input key={st.email || ''} defaultValue={st.email || ''} name="email" type="email" autoComplete="email" required className={field + ' mt-1.5'} />
      </label>
      <label className="block text-sm text-snow/70">Parool
        <input name="password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={mode === 'up' ? 8 : undefined} required className={field + ' mt-1.5'} />
      </label>
      {st.error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{st.error}</p>}
      {st.info && <p className="rounded-lg bg-fjord/15 px-3 py-2 text-sm text-snow">{st.info}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-fjord px-4 py-3 font-semibold text-night transition hover:brightness-110 disabled:opacity-60">
        {pending ? 'Oota…' : mode === 'in' ? 'Logi sisse' : 'Loo konto'}
      </button>
      <p className="text-center text-xs text-snow/45">See seade jätab sind {days} päevaks meelde.</p>
      {allowSignup && (
        <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="w-full pt-1 text-sm text-snow/60 hover:text-snow">
          {mode === 'in' ? 'Pole kontot? Loo konto' : 'Mul on konto, logi sisse'}
        </button>
      )}
    </form>
  );
}
