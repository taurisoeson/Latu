import { redirect } from 'next/navigation';
import { currentUser, SB_URL } from '@/lib/supabase';
import LoginForm from './form';
import { LOGIN_DAYS } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (SB_URL) {
    const { user } = await currentUser();
    if (user) redirect('/');
  }
  return (
    <main className="relative min-h-dvh overflow-hidden bg-night text-snow">
      <Mountains />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-16">
        <div className="mb-8">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" className="h-9 w-9" />
            <span className="font-display text-3xl font-bold tracking-tight">latu</span>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-snow/70">Treeningplaan, päevik ja analüüs ühes kohas. Logi sisse, et jätkata.</p>
        </div>
        {SB_URL ? <LoginForm allowSignup={process.env.ALLOW_SIGNUP === '1'} days={LOGIN_DAYS} /> : (
          <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">Supabase pole veel seadistatud. Lisa keskkonnamuutujad NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
        )}
      </div>
    </main>
  );
}

function Mountains() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[55vh] w-full" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6fa8c9" stopOpacity="0" /><stop offset="1" stopColor="#6fa8c9" stopOpacity=".18" /></linearGradient>
      </defs>
      <rect width="1200" height="500" fill="url(#sky)" />
      <path d="M0 300 L140 190 L230 250 L360 120 L470 230 L560 170 L700 260 L820 140 L940 230 L1060 160 L1200 240 V500 H0 Z" fill="#20384b" />
      <path d="M360 120 L330 150 L362 140 L392 152 Z M820 140 L792 168 L822 158 L848 168 Z" fill="#cfe0ea" opacity=".85" />
      <path d="M0 380 L120 300 L260 360 L400 280 L540 350 L680 290 L820 360 L960 300 L1100 350 L1200 320 V500 H0 Z" fill="#172a39" />
      <path d="M0 440 Q300 400 600 430 T1200 420 V500 H0 Z" fill="#0f1a24" />
    </svg>
  );
}
