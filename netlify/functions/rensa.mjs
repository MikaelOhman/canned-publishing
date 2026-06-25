// Schemalagd rensning: raderar konton som inte loggat in på 30 dagar.
import { getStore } from '@netlify/blobs'

export default async () => {
  const s = getStore('konton')
  const cutoff = Date.now() - 30 * 86400000
  let rensade = 0, kvar = 0
  const { blobs } = await s.list()
  for (const blob of blobs) {
    const u = await s.get(blob.key, { type: 'json' })
    if (u && (u.lastSeen || 0) < cutoff) { await s.delete(blob.key); rensade++ }
    else kvar++
  }
  return new Response(`rensade ${rensade}, kvar ${kvar}`)
}

export const config = { schedule: '@daily' }
