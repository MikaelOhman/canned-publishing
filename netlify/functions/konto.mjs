// Konton (overifierade) för att spara inställningar. Inget mail, ingen återställning.
// Lagrar BARA UI-inställningar + hashat lösenord i Netlify Blobs. Glömt lösen → nytt konto.
import { getStore } from '@netlify/blobs'
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

const store = () => getStore('konton')
const nyckel = n => n.trim().toLowerCase()
const hasha = (pw, salt) => scryptSync(String(pw), salt, 64).toString('hex')
const token = () => randomBytes(24).toString('hex')
const svar = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return svar({ error: 'method' }, 405)
  let b
  try { b = await req.json() } catch { return svar({ error: 'body' }, 400) }
  const s = store()
  const namn = (b.namn || '').trim()
  const k = nyckel(namn)

  if (b.action === 'register') {
    if (namn.length < 2 || String(b.losen || '').length < 4) return svar({ error: 'kort' })
    if (await s.get(k, { type: 'json' })) return svar({ error: 'finns' })
    const salt = randomBytes(16).toString('hex')
    const t = token()
    const u = { namn, salt, hash: hasha(b.losen, salt), token: t, settings: b.settings || {}, lastSeen: Date.now(), created: Date.now() }
    await s.setJSON(k, u)
    return svar({ ok: true, namn, token: t, settings: u.settings })
  }

  if (b.action === 'login') {
    const u = await s.get(k, { type: 'json' })
    if (!u) return svar({ error: 'fel' })
    const h = hasha(b.losen || '', u.salt)
    const a = Buffer.from(h), c = Buffer.from(u.hash)
    if (a.length !== c.length || !timingSafeEqual(a, c)) return svar({ error: 'fel' })
    u.token = token(); u.lastSeen = Date.now()
    await s.setJSON(k, u)
    return svar({ ok: true, namn: u.namn, token: u.token, settings: u.settings || {} })
  }

  if (b.action === 'spara' || b.action === 'load') {
    const u = await s.get(k, { type: 'json' })
    if (!u || !b.token || u.token !== b.token) return svar({ error: 'auth' }, 401)
    if (b.action === 'spara' && b.settings) u.settings = b.settings
    u.lastSeen = Date.now()
    await s.setJSON(k, u)
    return svar({ ok: true, settings: u.settings || {} })
  }

  return svar({ error: 'okänd action' }, 400)
}
