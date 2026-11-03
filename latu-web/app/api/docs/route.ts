import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// All of the signed-in user's documents (core state + monthly logs).
export async function GET() {
  const { sb, user } = await currentUser();
  if (!user) return NextResponse.json({ code: 'session_expired' }, { status: 401 });
  const { data, error } = await sb.from('docs').select('id,data').eq('user_id', user.id);
  if (error) return NextResponse.json({ code: 'db', message: error.message }, { status: 500 });
  return NextResponse.json({ docs: data || [] }, { headers: { 'cache-control': 'no-store' } });
}
