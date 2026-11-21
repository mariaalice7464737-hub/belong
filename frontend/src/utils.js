export const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && v !== '' && v != null ? n : null
}

export const brl = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })

export const zar = (n) => 'R ' + Math.round(Number(n || 0)).toLocaleString('pt-BR')

export const mapsDir = (origin, destination, mode = 'walking') =>
  'https://www.google.com/maps/dir/?api=1' +
  `&origin=${encodeURIComponent(origin)}` +
  `&destination=${encodeURIComponent(destination)}` +
  `&travelmode=${mode}`

export const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

export const mapsEmbed = (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`

/** Resolve um link do guide.json: { url } ou { route: { from?, to?, mode } }. */
export function linkHref(link, base) {
  if (link.url) return link.url
  const r = link.route
  return mapsDir(r.from || base, r.to || base, r.mode)
}

/** Converte uma entrada de preço do guide.json no que aparece na tela. */
export function resolvePrice(p, state, fx) {
  if (p.text) return { main: p.text, sub: p.sub, muted: true }
  if (p.zar_min != null) {
    return {
      main: `${zar(p.zar_min)}–${Math.round(p.zar_max)}`,
      sub: `≈ ${brl(p.zar_min * fx)} – ${brl(p.zar_max * fx)}`,
    }
  }
  let value = (p.key && toNum(state[p.key])) || p.zar
  if (!value && p.brl_key) {
    const b = toNum(state[p.brl_key])
    if (b) return { main: brl(b), sub: `≈ ${zar(b / fx)}` }
  }
  if (!value) return { main: 'A informar', sub: p.sub, muted: true }
  const total = value * (p.factor || 1)
  return { main: zar(total), sub: p.sub ? `${p.sub} · ≈ ${brl(total * fx)}` : `≈ ${brl(total * fx)}` }
}

export const mapsDirEmbed = (origin, destination, mode = 'walking') => {
  const flag = { walking: 'w', transit: 'r', driving: 'd' }[mode] || 'd'
  return `https://maps.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&dirflg=${flag}&output=embed`
}

/** Distância em linha reta (km) entre dois pontos {lat, lon}. */
export function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}
