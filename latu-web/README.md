# Latu – treeningplaan veebis

Next.js 16 + Supabase (konto ja andmebaas) + Gemini (AI treener, valikuline).

## 1. Supabase
1. Ava oma projekt → **SQL Editor** → New query → kleebi `supabase/schema.sql` sisu → **Run**.
2. Ülal **Connect** (või Project Settings → API): kopeeri *Project URL* ja *anon / publishable key*.
3. **Authentication → Sign In / Providers → Email**: kui tahad kohe sisse saada ilma e-posti kinnituseta, lülita *Confirm email* välja (muidu kinnita konto postkastist).

## 2. Vercel
1. Pane see kaust GitHubi (uus **privaatne** repo) ja Vercelis **Add New → Project → Import**.
   (Või kaustas terminalis: `npx vercel` ja järgi juhiseid.)
2. **Environment Variables** (vaata `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ALLOW_SIGNUP` = `1` (ainult esimeseks korraks)
   - `GEMINI_API_KEY` (kui olemas; `GEMINI_MODEL` vaikimisi `gemini-flash-latest`)
3. Deploy → ava leht → **Loo konto** → logi sisse.
4. Pärast konto loomist: kustuta Vercelis `ALLOW_SIGNUP` ja tee **Redeploy**. Supabase'is lülita ka *Allow new users to sign up* välja. Nii ei saa keegi teine kontot teha.

## 3. Vanad andmed artefaktist
Vanas artefaktis: **Plaan → Aasta → Varukoopia → Lae alla**. Uues lehel samast kohast **Taasta failist**.

## 4. Oma domeen (Zone.ee)
Vercel → Project → Settings → Domains → lisa nt `latu.sinudomeen.ee` ja pane Zone.ee DNS-i Verceli näidatud CNAME-kirje.

## Arendus
```
npm install
cp .env.example .env.local   # täida väärtused
npm run dev
```
Rakenduse kasutajaliides on `src/latu.html`. See tehakse artefakti failist käsuga
`python3 scripts/prepare.py src/latu-artifact.html src/latu.html`.

Serveri osad: `app/route.ts` (leht, ainult sisselogituna), `app/api/docs` (salvestus Supabase'i), `app/api/ai` (Gemini), `app/login` (sisselogimine), `public/shim.js` (ühendab lehe serveriga).
