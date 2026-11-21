import { geoMercator, geoPath } from 'd3-geo'
import { useMemo, useState } from 'react'
import { useApp } from '../AppContext'
import provinces from '../data/za-provinces.json'
import region from '../data/southern-africa.json'
import { distanceKm, mapsSearch } from '../utils'
import { ExtLink } from './ui'

const W = 400
const H = 340
// Recorte só da África do Sul.
const EXTENT = { type: 'MultiPoint', coordinates: [[16.3, -34.9], [33.0, -22.1]] }
const SA_ID = '710'
const ENCLAVES = { '426': 'Lesoto', '748': 'Essuatíni' }

// Posição do nome em relação ao ponto (definida em guide.json → "label").
function labelProps(pos = 'right', r = 8) {
  const gap = r + 5
  switch (pos) {
    case 'left': return { x: -gap, y: 4, textAnchor: 'end' }
    case 'top': return { x: 0, y: -gap, textAnchor: 'middle' }
    case 'bottom': return { x: 0, y: gap + 9, textAnchor: 'middle' }
    default: return { x: gap, y: 4, textAnchor: 'start' }
  }
}

/** Converte pontos numa curva suave (Catmull-Rom → Bézier). */
function smoothPath(points) {
  if (points.length < 2) return ''
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

/** Mapa da África do Sul com as 9 províncias e o roteiro. */
export default function AfricaMap() {
  const { guide } = useApp()
  const { home, route } = guide.destinations
  const info = useMemo(() => Object.fromEntries(guide.provinces.map((p) => [p.id, p])), [guide.provinces])
  const [selected, setSelected] = useState({ type: 'stop', ...route[0] })

  const { projection, path } = useMemo(() => {
    const projection = geoMercator().fitExtent([[14, 14], [W - 14, H - 14]], EXTENT)
    return { projection, path: geoPath(projection) }
  }, [])

  const p = (place) => projection([place.lon, place.lat])
  const routeD = smoothPath(route.map(p))
  const selProvince = selected.type === 'province' ? selected.id : selected.province
  const pickProvince = (id) => setSelected({ type: 'province', ...info[id] })
  const pickStop = (s) => setSelected({ type: 'stop', ...s })

  const card = selected.type === 'province'
    ? { kicker: `Província · capital ${selected.capital}`, title: selected.name, note: selected.note, query: `${selected.name.replace('Cabo', 'Cape')} South Africa` }
    : { kicker: info[selected.province]?.name || 'África do Sul', title: selected.name, note: selected.note, query: `${selected.name} South Africa` }

  return (
    <div className="africa">
      <svg className="africa-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mapa da África do Sul com as províncias e o roteiro">
        <defs>
          <clipPath id="frame"><rect width={W} height={H} rx="22" /></clipPath>
        </defs>
        <g clipPath="url(#frame)">
          {/* Vizinhos só como contorno, sem destaque */}
          {region.features.filter((f) => f.id !== SA_ID && !ENCLAVES[f.id]).map((f) => (
            <path key={f.id} d={path(f)} className="country is-faint" />
          ))}

          {provinces.features.map((f, i) => (
            <path key={f.id} d={path(f)}
              className={`province tone-${i % 3} ${selProvince === f.id ? 'is-selected' : ''}`}
              onClick={() => pickProvince(f.id)} role="button" tabIndex={0} aria-label={info[f.id]?.name}
              onKeyDown={(e) => e.key === 'Enter' && pickProvince(f.id)} />
          ))}

          {region.features.filter((f) => ENCLAVES[f.id]).map((f) => {
            const [x, y] = path.centroid(f)
            return (
              <g key={f.id}>
                <path d={path(f)} className="country is-enclave" />
                <text x={x} y={y + 3} textAnchor="middle" className="enclave-label">{ENCLAVES[f.id]}</text>
              </g>
            )
          })}

          {guide.provinces.map((pr) => {
            const [x, y] = projection(pr.label_at)
            return (
              <text key={pr.id} x={x} y={y} textAnchor={pr.anchor || 'middle'}
                className={`province-label ${pr.small ? 'is-small' : ''} ${selProvince === pr.id ? 'is-selected' : ''}`}>
                {pr.name.toUpperCase()}
              </text>
            )
          })}

          <path d={routeD} className="route-line" />

          {route.map((s, i) => {
            const [x, y] = p(s)
            const isSel = selected.type === 'stop' && selected.name === s.name
            return (
              <g key={s.name} className={`stop ${i === 0 ? 'is-home' : ''} ${isSel ? 'is-selected' : ''}`} transform={`translate(${x},${y})`}
                onClick={() => pickStop(s)} role="button" tabIndex={0} aria-label={s.name}
                onKeyDown={(e) => e.key === 'Enter' && pickStop(s)}>
                <circle r="13" className="hit" />
                <circle r={i === 0 ? 7 : 5} className="dot" />
                <text {...labelProps(s.label, i === 0 ? 7 : 5)} className="stop-label">{s.name}</text>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="africa-legend">
        <span><i className="lg-route" /> Roteiro</span>
        <span><i className="lg-province" /> Toque numa província</span>
      </div>

      <div className="africa-card" aria-live="polite">
        <span className="mono-label">{card.kicker}</span>
        <h3>{card.title}</h3>
        {card.note && <p>{card.note}</p>}
        <div className="africa-card-foot">
          {selected.type === 'stop'
            ? (selected.name !== home.name
              ? <span className="mono">≈ {distanceKm(home, selected).toLocaleString('pt-BR')} km de Cape Town <small>(em linha reta)</small></span>
              : <span className="mono">Você está aqui</span>)
            : <span className="mono">{selected.id === 'ZA-WC' ? 'Você mora aqui' : ''}</span>}
          <ExtLink href={mapsSearch(card.query)} className="pill pill-light">Google Maps</ExtLink>
        </div>
      </div>
    </div>
  )
}
