import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../AppContext'
import AfricaMap from '../components/AfricaMap'
import Icon from '../components/Icon'
import { ExtLink, Kicker, SectionTitle } from '../components/ui'
import { mapsDir, mapsDirEmbed, mapsEmbed, mapsSearch } from '../utils'

const MODES = [
  { id: 'walking', label: 'A pé', icon: 'walk' },
  { id: 'driving', label: 'Carro / Uber', icon: 'car' },
  { id: 'transit', label: 'Transporte', icon: 'bus' },
]
const modeLabel = (m) => MODES.find((x) => x.id === m)?.label || ''
const short = (s) => s.split(',')[0]

/* ---------- Favoritos (salvos no backend em "fav.places") ---------- */
function useFavorites() {
  const { state, set } = useApp()
  const list = Array.isArray(state['fav.places']) ? state['fav.places'] : []
  const has = (to) => list.some((f) => f.to === to)
  const toggle = (place) => set('fav.places', has(place.to) ? list.filter((f) => f.to !== place.to) : [...list, place])
  return { list, has, toggle }
}

function StarButton({ place, light = false }) {
  const fav = useFavorites()
  const on = fav.has(place.to)
  return (
    <button type="button" className={`star-btn ${on ? 'is-on' : ''} ${light ? 'is-light' : ''}`}
      onClick={() => fav.toggle(place)} aria-pressed={on}
      aria-label={on ? `Tirar ${place.name} dos favoritos` : `Favoritar ${place.name}`}>
      <Icon name="star" size={18} />
    </button>
  )
}

/* ---------- Menu "Ao redor" ---------- */
function AroundMenu({ cats, active, onPick }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const current = cats.find((c) => c.id === active)
  return (
    <div className="around" ref={ref}>
      <button type="button" className={`map-btn ${current ? 'is-active' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name={current?.icon || 'pin'} size={16} /> {current?.label || 'Ao redor'} <Icon name="chevron" size={14} />
      </button>
      {open && (
        <ul className="around-menu" role="menu">
          {cats.map((c) => (
            <li key={c.id}>
              <button type="button" role="menuitem" className={c.id === active ? 'is-active' : ''} onClick={() => { onPick(c.id); setOpen(false) }}>
                <Icon name={c.icon} size={18} /> {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- Lista de lugares (categoria ou favoritos) ---------- */
function PlaceList({ items, onRoute, base, empty }) {
  if (!items.length) return <p className="empty">{empty}</p>
  return (
    <ul className="place-list">
      {items.map((it) => (
        <li key={it.to || it.name}>
          <div className="place-text">
            <strong>{it.name}</strong>
            {it.description && <small>{it.description}</small>}
            {it.phone && <a className="place-phone" href={`tel:${it.tel}`}><Icon name="phone" size={14} /> {it.phone}</a>}
          </div>
          <div className="place-actions">
            {it.to && <StarButton place={{ name: it.name, to: it.to, description: it.description, category: it.category }} />}
            {it.to
              ? <button type="button" className="round-btn" onClick={() => onRoute(it)} aria-label={`Rota até ${it.name}`}><Icon name="route" size={18} /></button>
              : it.url && <a className="round-btn" href={it.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${it.name}`}><Icon name="external" size={16} /></a>}
            {it.to && <a className="round-btn" href={mapsDir(base, it.to, 'walking')} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${it.name} no Google Maps`}><Icon name="external" size={16} /></a>}
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ---------- O mapa único ---------- */
function RegionMap() {
  const { guide, state, set } = useApp()
  const h = guide.housing
  const base = h.address
  const cats = guide.nearby
  const fav = useFavorites()

  // Vindo da Home: categoria escolhida e, se permitido, a posição atual.
  const nav = useLocation().state || {}
  const near = nav.near ? `${nav.near.lat},${nav.near.lon}` : null

  // O que o mapa está mostrando: residência, uma categoria ou uma rota.
  const [view, setView] = useState(() => (nav.cat && cats.some((c) => c.id === nav.cat) ? { kind: 'cat', id: nav.cat } : { kind: 'home' }))
  useEffect(() => {
    if (nav.cat) document.getElementById('mapa-unico')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [nav.cat])
  const [routeOpen, setRouteOpen] = useState(false)
  const from = state['route.from'] ?? base
  const to = state['route.to'] ?? ''
  const mode = state['route.mode'] ?? 'walking'

  const showRoute = (next = {}) => {
    const r = { from, to, mode, ...next }
    if (!r.from.trim() || !r.to.trim()) return
    setView({ kind: 'route', ...r })
    setRouteOpen(false)
  }
  const routeTo = (place) => {
    set('route.from', base); set('route.to', place.to)
    showRoute({ from: base, to: place.to })
    document.getElementById('mapa-unico')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const setMode = (m) => { set('route.mode', m); if (view.kind === 'route') showRoute({ mode: m }) }
  const swap = () => { set('route.from', to); set('route.to', from) }
  const goHome = () => { setView({ kind: 'home' }); setRouteOpen(false) }

  const cat = view.kind === 'cat' ? cats.find((c) => c.id === view.id) : null
  const src =
    view.kind === 'route' ? mapsDirEmbed(view.from, view.to, view.mode)
      : cat ? mapsEmbed(`${cat.search} near ${near || base}`)
        : mapsEmbed(h.map_query)
  const curTo = view.kind === 'route' ? view.to : to
  // Se o destino é um lugar da lista, o favorito herda o nome e a categoria dele.
  const known = cats.flatMap((c) => c.items.map((it) => ({ ...it, category: c.id }))).find((it) => it.to === curTo)
  const favPlace = curTo.trim()
    ? (known ? { name: known.name, to: known.to, description: known.description, category: known.category } : { name: short(curTo), to: curTo, category: 'outros' })
    : null
  // Favoritos agrupados na mesma ordem das categorias; o resto vai em "Outros lugares".
  const favGroups = [...cats, { id: 'outros', label: 'Outros lugares', icon: 'pin' }]
    .map((c) => ({ ...c, items: fav.list.filter((f) => (cats.some((x) => x.id === f.category) ? f.category : 'outros') === c.id) }))
    .filter((g) => g.items.length)

  return (
    <section className="block" id="mapa-unico">
      <SectionTitle kicker="01 · Por aqui" title="Daqui pra lá." />

      <div className="region">
        {/* Barra de rota, por cima do mapa (como no Google Maps) */}
        <div className={`route-bar ${routeOpen ? 'is-open' : ''}`}>
          {!routeOpen ? (
            <button type="button" className="route-bar-closed" onClick={() => setRouteOpen(true)}>
              <Icon name="route" size={18} />
              {view.kind === 'route'
                ? <span><b>{short(view.from)}</b> → <b>{favPlace?.name || short(view.to)}</b> <small>· {modeLabel(view.mode)}</small></span>
                : <span className="muted">Para onde você vai?</span>}
            </button>
          ) : (
            <form className="route-form" onSubmit={(e) => { e.preventDefault(); showRoute() }}>
              <div className="route-inputs">
                <label className="route-field">
                  <span className="mono-label">Partida</span>
                  <input value={from} onChange={(e) => set('route.from', e.target.value)} placeholder="Endereço de saída" />
                </label>
                <button type="button" className="swap" onClick={swap} aria-label="Inverter partida e destino"><Icon name="swap" size={18} /></button>
                <label className="route-field">
                  <span className="mono-label">Destino</span>
                  <input value={to} onChange={(e) => set('route.to', e.target.value)} placeholder="Endereço ou nome do lugar" autoFocus />
                </label>
              </div>
              <div className="presets">
                {guide.route_presets.map((p) => (
                  <button type="button" key={p.label} className={`chip ${to === p.to ? 'is-active' : ''}`} onClick={() => set('route.to', p.to)}>{p.label}</button>
                ))}
              </div>
              <div className="modes">
                {MODES.map((m) => (
                  <button type="button" key={m.id} className={`mode ${mode === m.id ? 'is-active' : ''}`} onClick={() => setMode(m.id)}>
                    <Icon name={m.icon} size={18} /> {m.label}
                  </button>
                ))}
              </div>
              <div className="route-actions">
                <button type="submit" className="btn btn-dark">Ver rota</button>
                <button type="button" className="link-btn" onClick={() => setRouteOpen(false)}>Fechar</button>
                {from !== base && <button type="button" className="link-btn" onClick={() => set('route.from', base)}>Sair da moradia</button>}
              </div>
            </form>
          )}
        </div>

        <div className="map-frame is-region">
          <iframe key={src} title="Mapa" src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          <div className="map-overlay">
            <AroundMenu cats={cats} active={cat?.id} onPick={(id) => setView({ kind: 'cat', id })} />
            {view.kind !== 'home' && (
              <button type="button" className="map-btn" onClick={goHome}><Icon name="home" size={16} /> Residência</button>
            )}
          </div>
        </div>

        <div className="region-foot">
          {view.kind === 'route' ? (
            <>
              {favPlace && <StarButton place={favPlace} />}
              <a className="btn btn-dark" href={mapsDir(view.from, view.to, view.mode)} target="_blank" rel="noopener noreferrer">
                Abrir no Google Maps <Icon name="external" size={14} />
              </a>
            </>
          ) : (
            <>
              <a className="address" href={mapsSearch(h.map_query)} target="_blank" rel="noopener noreferrer">
                <Icon name="home" size={18} /> <span>{h.address}</span>
              </a>
              <div className="row-links">
                {h.links.map((l) => <ExtLink key={l.url} href={l.url}>{l.label}</ExtLink>)}
              </div>
            </>
          )}
        </div>
      </div>

      {cat && (
        <div className="region-list">
          <div className="group-head">
            <span className="mono-label">{cat.label} {near ? 'perto de você' : 'perto da residência'}</span>
            <button type="button" className="link-btn" onClick={goHome}>Fechar</button>
          </div>
          <PlaceList items={cat.items.map((it) => ({ ...it, category: cat.id }))} onRoute={routeTo} base={base} empty="Nada separado ainda nessa categoria." />
        </div>
      )}

      {favGroups.length > 0 && (
        <div className="region-list" id="favoritos">
          <h3 className="fav-title"><Icon name="star" size={18} /> Favoritos <small>· {fav.list.length}</small></h3>
          {favGroups.map((g) => (
            <div key={g.id} className="fav-group">
              <span className="mono-label fav-group-label"><Icon name={g.icon} size={14} /> {g.label}</span>
              <PlaceList items={g.items} onRoute={routeTo} base={base} empty="" />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function MapPage() {
  return (
    <main className="page map-page">
      <section className="map-hero">
        <div className="map-hero-head">
          <Kicker light>Chapter one · the map</Kicker>
          <h1>Off the <em>map,</em><br />on the road.</h1>
        </div>
        <AfricaMap />
      </section>

      <div className="page-body">
        <RegionMap />
      </div>
    </main>
  )
}
