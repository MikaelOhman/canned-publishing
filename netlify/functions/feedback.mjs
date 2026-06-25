// Feedback: inloggade konton i allowlisten (data/feedback_konton.json) kan skicka
// feedback → lagras i Blobs-store 'feedback'. 'lista' (samma allowlist) hämtar allt.
import { getStore } from '@netlify/blobs'
import { randomBytes } from 'node:crypto'

const konton = () => getStore({ name: 'konton', consistency: 'strong' })
const fb = () => getStore({ name: 'feedback', consistency: 'strong' })
const svar = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } })

async function allowlist(req) {
  try {
    const r = await fetch(new URL('/data/feedback_konton.json', req.url))
    const j = await r.json()
    return new Set((j || []).map(s => String(s).toLowerCase()))
  } catch { return new Set() }
}

export default async (req) => {
  if (req.method !== 'POST') return svar({ error: 'method' }, 405)
  let b
  try { b = await req.json() } catch { return svar({ error: 'body' }, 400) }
  const k = (b.namn || '').trim().toLowerCase()
  const u = await konton().get(k, { type: 'json' })
  if (!u || !b.token || u.token !== b.token) return svar({ error: 'auth' }, 401)
  const lista = await allowlist(req)
  if (!lista.has(k)) return svar({ error: 'ej_behorig' }, 403)

  if (b.action === 'skicka') {
    const text = String(b.text || '').trim().slice(0, 4000)
    if (!text) return svar({ error: 'tom' })
    const key = Date.now() + '-' + randomBytes(4).toString('hex')
    await fb().setJSON(key, { namn: u.namn, text, datum: new Date().toISOString(), lang: b.lang || '', url: b.url || '', klar: false })
    return svar({ ok: true })
  }

  if (b.action === 'lista') {
    const { blobs } = await fb().list()
    const ut = []
    for (const x of blobs) { const v = await fb().get(x.key, { type: 'json' }); if (v) ut.push({ key: x.key, ...v }) }
    ut.sort((a, b) => (a.datum < b.datum ? 1 : -1))
    return svar({ ok: true, antal: ut.length, feedback: ut })
  }

  return svar({ error: 'okänd' }, 400)
}
