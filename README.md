# Canned Publishing

Statisk flerspråkig nyhetssida. Filtrering och sökning sker på taggar – inga menyer, inga konton.
Mörkt läge som standard, med tillgänglighetslägen (hög kontrast, stor text, läsvänligt typsnitt).

## Struktur
- `index.html`, `app.css`, `app.js` — statiskt skal (inget byggsteg)
- `assets/bg.svg` — bakgrundsmönster
- `data/sprak.json` — tillgängliga språk
- `data/index.<lang>.json` — artikellista per språk (för filter/sök)
- `data/tags.<lang>.json` — taggar per språk (`id → {etikett, typ, antal}`)
- `data/artikel/<id>.<lang>.json` — full artikel

## Lokalt
```
python3 -m http.server 8080
# öppna http://localhost:8080
```

## Deploy
Push till `main` → automatisk deploy på Netlify (publish directory = root, inget byggkommando).
Artiklar publiceras genom att skriva data-filer och pusha till `main`.
