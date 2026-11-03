# Builds src/latu.html (standalone page) from the artifact file ../latu.html
import sys, io
src = open(sys.argv[1], encoding='utf-8').read()
out = sys.argv[2]
def rep(a, b, n=1):
    global src
    c = src.count(a)
    assert c == n, (a[:60], c)
    src = src.replace(a, b)
rep("Claude kasutamine on selle lehe jaoks keelatud. Luba see lehe õiguste menüüst.", "AI treener pole serveris seadistatud (GEMINI_API_KEY puudub).")
rep("Liiga palju päringuid või Claude’i kasutuse limiit on täis. Proovi hiljem.", "Tasuta AI päringute limiit on hetkel täis. Proovi mõne minuti pärast uuesti.")
rep("Logi uuesti claude.ai-sse sisse.", "Sessioon aegus. Logi uuesti sisse.")
rep("Claude pole sellel kontol saadaval.", "AI treener pole praegu saadaval.")
rep("Claude ei vastanud sellele küsimusele.", "AI ei vastanud sellele küsimusele.")
rep("Claude’i vestlus pole selles vaates saadaval. Ava leht claude.ai-s, kus oled sisse logitud.", "AI treener pole veel seadistatud. Lisa Verceli seadetes GEMINI_API_KEY ja tee uus deploy.")
rep("kasutavad sinu enda Claude’i kasutust ega asenda", "tulevad AI-lt (Gemini) ega asenda")
rep("Hinda Claude’iga", "Hinda AI-ga")
rep("Claude’i hinnang. Kontrolli", "AI hinnang. Kontrolli")
rep("Hindamine töötab claude.ai-s sisse logituna.", "Hindamine vajab AI seadistust (GEMINI_API_KEY).")
rep("'Claude kasutamine on selle lehe jaoks keelatud.'", "'AI pole seadistatud.'")
rep("}[code] || 'Vastus ebaõnnestus. Proovi uuesti.';", "}[code] || ('Vastus ebaõnnestus' + (e && e.message && e.message !== code ? ' (' + e.message + ')' : '') + '. Proovi uuesti.');")
rep("e && e.code === 'rate_limited' ? 'Limiit täis, proovi hiljem.' : 'Hindamine ebaõnnestus. Proovi uuesti.'", "e && e.code === 'rate_limited' ? 'Limiit täis, proovi hiljem.' : 'Hindamine ebaõnnestus' + (e && e.message && e.message !== e.code ? ' (' + e.message + ')' : '') + '. Proovi uuesti.'")
rep('<span class="verb">v9</span>', '<span class="verb">v10</span>')
# account card above backup card
rep("""  h += '<section class="card"><div class="card-h"><h2>Varukoopia</h2></div>""",
    """  h += '<section class="card"><div class="card-h"><h2>Konto</h2></div><p style="margin:0">Sisse logitud: <b>' + esc((window.LATU_USER || {}).email || '') + '</b>. Andmed salvestuvad serverisse ja on alles igas seadmes, kuhu sisse logid.</p><div class="btns"><button type="button" class="btn sm" data-act="logout">Logi välja</button></div></section>';
  h += '<section class="card"><div class="card-h"><h2>Varukoopia</h2></div>""")
rep("function save() { resetCache();", "window.__latuFlush = function () { if (persist.timer) { clearTimeout(persist.timer); persist.timer = null; flush(); } };\nfunction save() { resetCache();")
rep('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
lines = src.split('\n')
i = next(k for k, l in enumerate(lines) if l.startswith('<div class="app">'))
head, body = '\n'.join(lines[:i]), '\n'.join(lines[i:])
page = ('<!doctype html>\n<html lang="et">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#14202b">\n<link rel="icon" href="/icon.svg" type="image/svg+xml">\n'
        + head + '\n<!--LATU_BOOT-->\n<script src="/shim.js"></script>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n')
open(out, 'w', encoding='utf-8').write(page)
print('ok', len(page))
