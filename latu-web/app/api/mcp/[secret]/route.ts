import { timingSafeEqual } from 'node:crypto';
import { athleteId, downsample, icu, slimActivity, slimWellness } from '@/lib/intervals';

// Remote MCP server (Streamable HTTP, stateless JSON responses) that lets Claude read the athlete's
// intervals.icu data and add planned workouts. URL: /api/mcp/<MCP_SECRET>
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Json = Record<string, unknown>;
type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Json };

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const DATE = { type: 'string', description: 'Kuupäev YYYY-MM-DD' };

const TOOLS = [
  {
    name: 'get_athlete',
    description: 'Sportlase profiil ja alade seaded intervals.icu-s: maksimumpulss, LTHR, puhkepulss, pulsitsoonid, kaal.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_activities',
    description: 'Tehtud trennid ajavahemikus (vaikimisi viimased 14 päeva): aeg, ala, kestus, distants, pulss, koormus, pulsitsoonide ajad, RPE, märkmed.',
    inputSchema: { type: 'object', properties: { oldest: DATE, newest: DATE, limit: { type: 'number', description: 'Max trenne (vaikimisi 100)' } } },
  },
  {
    name: 'get_activity',
    description: 'Ühe trenni täisinfo koos automaatselt tuvastatud intervallidega (iga lõigu kestus, pulss, kiirus).',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Trenni id, nt i12345678' } }, required: ['id'] },
  },
  {
    name: 'get_activity_streams',
    description: 'Trenni ajarida (pulss, kiirus, kõrgus, kadents jne), tihendatud kuni `points` punktini.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        types: { type: 'string', description: 'Komadega, vaikimisi time,heartrate,velocity_smooth,altitude,distance,cadence' },
        points: { type: 'number', description: 'Max punkte (vaikimisi 300, max 1500)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_wellness',
    description: 'Päevased andmed: vorm (CTL), väsimus (ATL), puhkepulss, HRV, uni, kaal, enesetunne. Vaikimisi viimased 28 päeva.',
    inputSchema: { type: 'object', properties: { oldest: DATE, newest: DATE } },
  },
  {
    name: 'list_events',
    description: 'Kalendri sündmused: planeeritud trennid, võistlused, märkmed. Vaikimisi täna kuni 28 päeva ette.',
    inputSchema: { type: 'object', properties: { oldest: DATE, newest: DATE } },
  },
  {
    name: 'create_event',
    description: 'Lisab intervals.icu kalendrisse planeeritud trenni, võistluse või märkme. Kasuta ainult siis, kui sportlane palus plaani kalendrisse panna.',
    inputSchema: {
      type: 'object',
      properties: {
        date: DATE,
        category: { type: 'string', enum: ['WORKOUT', 'RACE_A', 'RACE_B', 'RACE_C', 'NOTE'], description: 'Vaikimisi WORKOUT' },
        name: { type: 'string' },
        description: { type: 'string', description: 'Trenni kirjeldus. intervals.icu struktureeritud süntaks on lubatud, nt "- 15m Z1\\n4x\\n- 6m Z4\\n- 2m Z1"' },
        type: { type: 'string', description: 'Ala: NordicSki, RollerSki, Run, Ride, WeightTraining, Walk…' },
        minutes: { type: 'number', description: 'Planeeritud kestus minutites' },
      },
      required: ['date', 'name'],
    },
  },
  {
    name: 'delete_event',
    description: 'Kustutab kalendrist sündmuse id järgi (ainult planeeritud sündmused, mitte tehtud trennid).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
];

async function callTool(name: string, a: Json) {
  const ath = athleteId();
  const s = (k: string, d = '') => (typeof a[k] === 'string' && a[k] ? String(a[k]) : d);
  switch (name) {
    case 'get_athlete': {
      const x = await icu(`/athlete/${ath}`);
      const sports = (x.sportSettings || []).map((p: Json) => ({
        types: p.types, max_hr: p.max_hr, lthr: p.lthr, hr_zones: p.hr_zones, hr_zone_names: p.hr_zone_names, threshold_pace: p.threshold_pace,
      }));
      return { id: x.id, name: x.name, sex: x.sex, dob: x.icu_date_of_birth, weight: x.icu_weight, resting_hr: x.icu_resting_hr, timezone: x.timezone, sports };
    }
    case 'list_activities': {
      const q = `oldest=${s('oldest', daysAgo(14))}&newest=${s('newest', today())}`;
      const list = (await icu(`/athlete/${ath}/activities?${q}`)) as Json[];
      const limit = Math.min(500, Number(a.limit) || 100);
      return { count: list.length, activities: list.slice(0, limit).map(slimActivity) };
    }
    case 'get_activity': {
      const x = (await icu(`/activity/${encodeURIComponent(s('id'))}?intervals=true`)) as Json;
      const intervals = ((x.icu_intervals as Json[]) || []).map((i) => ({
        type: i.type, label: i.label, start: i.start_time, secs: i.elapsed_time, moving: i.moving_time, dist: i.distance,
        avg_hr: i.average_heartrate, max_hr: i.max_heartrate, avg_speed: i.average_speed, elev_gain: i.total_elevation_gain, load: i.training_load,
      }));
      return { ...slimActivity(x), intervals };
    }
    case 'get_activity_streams': {
      const types = s('types', 'time,heartrate,velocity_smooth,altitude,distance,cadence');
      const st = (await icu(`/activity/${encodeURIComponent(s('id'))}/streams.json?types=${encodeURIComponent(types)}`)) as { type: string; data: unknown[] }[];
      return downsample(st, Math.min(1500, Math.max(20, Number(a.points) || 300)));
    }
    case 'get_wellness': {
      const q = `oldest=${s('oldest', daysAgo(28))}&newest=${s('newest', today())}`;
      const w = (await icu(`/athlete/${ath}/wellness?${q}`)) as Json[];
      return w.map(slimWellness);
    }
    case 'list_events': {
      const q = `oldest=${s('oldest', today())}&newest=${s('newest', new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10))}`;
      const ev = (await icu(`/athlete/${ath}/events?${q}`)) as Json[];
      return ev.map((e) => ({ id: e.id, date: e.start_date_local, category: e.category, type: e.type, name: e.name, description: e.description, moving_time: e.moving_time, load: e.icu_training_load }));
    }
    case 'create_event': {
      const body: Json = {
        start_date_local: s('date') + 'T00:00:00', category: s('category', 'WORKOUT'), name: s('name'),
        description: s('description'), ...(s('type') ? { type: s('type') } : {}), ...(a.minutes ? { moving_time: Math.round(Number(a.minutes) * 60) } : {}),
      };
      const e = await icu(`/athlete/${ath}/events`, { method: 'POST', body: JSON.stringify(body) });
      return { created: true, id: e.id, date: e.start_date_local, name: e.name };
    }
    case 'delete_event': {
      await icu(`/athlete/${ath}/events/${encodeURIComponent(s('id'))}`, { method: 'DELETE' });
      return { deleted: s('id') };
    }
  }
  throw new Error('Tundmatu tööriist: ' + name);
}

async function handle(m: Rpc): Promise<Json | null> {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: m.id ?? null, result });
  const error = (code: number, message: string) => ({ jsonrpc: '2.0', id: m.id ?? null, error: { code, message } });
  if (m.id === undefined || m.id === null) return null; // notification
  switch (m.method) {
    case 'initialize':
      return reply({
        protocolVersion: (m.params?.protocolVersion as string) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'latu-intervals', version: '1.0.0' },
        instructions: 'Tauro (murdmaasuusataja) intervals.icu andmed: trennid, intervallid, pulss, vorm/väsimus, wellness ja kalender. Kuupäevad on kohalikud (Europe/Tallinn).',
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call': {
      const name = String(m.params?.name || '');
      try {
        const out = await callTool(name, (m.params?.arguments as Json) || {});
        let text = JSON.stringify(out);
        if (text.length > 200_000) text = text.slice(0, 200_000) + '…(lühendatud, kitsenda ajavahemikku)';
        return reply({ content: [{ type: 'text', text }] });
      } catch (e) {
        return reply({ content: [{ type: 'text', text: String((e as Error).message || e) }], isError: true });
      }
    }
    default:
      return error(-32601, 'Method not found: ' + m.method);
  }
}

function authorized(secret: string) {
  const want = process.env.MCP_SECRET || '';
  if (want.length < 24) return false;
  const a = Buffer.from(secret), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!authorized(secret)) return new Response('Not found', { status: 404 });
  let body: Rpc | Rpc[];
  try { body = await req.json(); } catch { return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 }); }
  const list = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(list.map(handle))).filter(Boolean);
  if (!out.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? out : out[0], { headers: { 'cache-control': 'no-store' } });
}

export async function GET() {
  return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
}

export async function DELETE() {
  return new Response(null, { status: 405 });
}
