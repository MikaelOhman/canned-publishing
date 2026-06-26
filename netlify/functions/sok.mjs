// Serverside-sök/filter över indexet → klienten laddar INTE hela index.<lang>.json.
// Speglar app.js matches()/facett-logik. Hämtar index+tags från sajtens egna statiska
// filer (CDN-cachat) och cachar i funktionsminnet. Skalar till tiotusentals artiklar:
// klientens payload blir en sida (default 30) i stället för hela korpusen.
const cache = {}
const TTL = 5 * 60 * 1000

async function load(lang) {
  const c = cache[lang]
  if (c && Date.now() - c.t < TTL) return c
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || ''
  const [idx, tags] = await Promise.all([
    fetch(`${base}/data/index.${lang}.json`).then(r => r.json()).catch(() => []),
    fetch(`${base}/data/tags.${lang}.json`).then(r => r.json()).catch(() => ({})),
  ])
  cache[lang] = { idx, tags, t: Date.now() }
  return cache[lang]
}

const artKommun = (a, tags) => {
  for (const t of (a.taggar || [])) if ((tags[t] || {}).typ === 'plats') return t
  return null
}
const relScore = (a, akt) => {
  if (!a.relevans || !akt.length) return 0
  let m = 0
  for (const id of akt) { const v = a.relevans[id] || 0; if (v > m) m = v }
  return m
}

// Ren, testbar kärna: filtrerar + paginerar + räknar facetter (speglar app.js).
export function sokIndex(idx, tags, { typer, akt, ort, qw, page, ps }) {
  const txt = a => (a.titel + ' ' + (a.ingress || '') + ' ' +
    (a.taggar || []).map(id => (tags[id] || {}).etikett || id).join(' ')).toLowerCase()
  const bas = idx.filter(a => {                       // typ + fritext (grund för facett-antal)
    if (typer.size && !typer.has(a.typ || 'nyhet')) return false
    if (qw.length) { const h = txt(a); for (const w of qw) if (!h.includes(w)) return false }
    return true
  })
  let res = bas.filter(a => {                          // + ort + situation
    if (a.typ === 'kommunbeslut' && ort.size) { const k = artKommun(a, tags); if (!k || !ort.has(k)) return false }
    if (akt.length && a.typ !== 'historia' && relScore(a, akt) < 1) return false
    return true
  })
  if (akt.length) res = [...res].sort((A, B) => relScore(B, akt) - relScore(A, akt))
  const typc = {}
  for (const a of idx) { const t = a.typ || 'nyhet'; typc[t] = (typc[t] || 0) + 1 }
  const axc = {}
  for (const a of bas) if (a.relevans) for (const id in a.relevans) if (a.relevans[id] >= 1) axc[id] = (axc[id] || 0) + 1
  return { total: res.length, page, ps, results: res.slice(page * ps, page * ps + ps), facets: { typ: typc, ax: axc } }
}

export default async (req) => {
  const p = new URL(req.url).searchParams
  const lang = (p.get('lang') || 'sv').replace(/[^a-z]/g, '')
  const q = (p.get('q') || '').toLowerCase().trim()
  const opts = {
    typer: new Set((p.get('typer') || '').split(',').filter(Boolean)),
    akt: (p.get('akt') || '').split(',').filter(Boolean),
    ort: new Set((p.get('ort') || '').split(',').filter(Boolean)),
    qw: q ? q.split(/\s+/) : [],
    page: Math.max(0, parseInt(p.get('page') || '0')),
    ps: Math.min(60, Math.max(1, parseInt(p.get('ps') || '30'))),
  }
  const { idx, tags } = await load(lang)
  return new Response(JSON.stringify(sokIndex(idx, tags, opts)),
    { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } })
}
