import { imageUrl } from '../api.explore'
import Icon from './Icon'

const TYPE_LABEL = { event: 'Evento', recurring: 'Recorrente', place: 'Lugar' }
const CAT_ICON = { 'music-night': 'music', movement: 'dumbbell', 'sports-adventure': 'compass', 'arts-culture': 'frame', 'food-community': 'fork' }
const SYMBOL = { ZAR: 'R', BRL: 'R$', USD: 'US$', EUR: '€', GBP: '£' }

const num = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: n < 100 ? 2 : 0 })

/** Quando acontece: só mostra data/hora que a fonte confirmou. */
function whenLabel(e) {
  const s = e.schedule
  if (e.type === 'event') {
    if (!s.start || !s.date_confirmed) return 'Data a confirmar'
    const d = new Date(s.start)
    const opts = { timeZone: s.timezone || 'Africa/Johannesburg' }
    const day = d.toLocaleDateString('pt-BR', { ...opts, weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')
    const hour = s.time_confirmed ? d.toLocaleTimeString('pt-BR', { ...opts, hour: '2-digit', minute: '2-digit' }) : null
    return hour ? `${day} · ${hour}` : day
  }
  if (e.type === 'recurring') return s.recurrence || 'Consultar agenda'
  return 'Consultar horários'
}

/** Preço: só o que a fonte informou. Reais só com câmbio disponível. */
function priceLabel(p) {
  if (p.is_free) return { main: 'Grátis' }
  if (p.min != null || p.max != null) {
    const sym = SYMBOL[p.currency] || p.currency || ''
    const range = p.min != null && p.max != null && p.max !== p.min ? `${num(p.min)}–${num(p.max)}` : num(p.min ?? p.max)
    const brl = p.brl_min != null ? ` ≈ R$ ${num(p.brl_min)}${p.brl_max != null && p.brl_max !== p.brl_min ? `–${num(p.brl_max)}` : ''}` : ''
    return { main: `${sym} ${range}`.trim(), sub: brl.trim() || null }
  }
  if (p.level != null) return { main: p.level === 0 ? 'Grátis' : '$'.repeat(p.level), sub: 'faixa de preço' }
  return { main: 'Preço não informado', muted: true }
}

const SOURCE_LABEL = { belong: 'Belong', google: 'Google Places', ticketmaster: 'Ticketmaster' }

export default function ExperienceCard({ e, categories, saved, onToggleSave }) {
  const cat = categories.find((c) => c.id === e.category)
  const price = priceLabel(e.price)
  const where = [e.location.neighborhood, e.location.venue !== e.name ? e.location.venue : null].filter(Boolean).join(' · ') || e.location.address
  const img = imageUrl(e.image)
  const src = e.source
  const checked = src.verification === 'verified' && src.fetched_at
    ? new Date(src.fetched_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : null

  return (
    <article className={`xcard is-${e.type}`}>
      <div className="xcard-media">
        {img
          ? <img src={img} alt="" loading="lazy" onError={(ev) => { ev.currentTarget.style.display = 'none' }} />
          : <span className="xcard-ph" aria-hidden><Icon name={CAT_ICON[e.category] || 'sparkle'} size={34} stroke={1.2} /></span>}
        <span className={`xcard-type is-${e.type}`}>{TYPE_LABEL[e.type]}</span>
        <button type="button" className={`xcard-save ${saved ? 'is-on' : ''}`} onClick={() => onToggleSave(e)}
          aria-pressed={saved} aria-label={saved ? `Tirar ${e.name} dos salvos` : `Salvar ${e.name}`}>
          <Icon name="star" size={18} />
        </button>
      </div>

      <div className="xcard-body">
        {cat && <span className="xcard-cat">{cat.label}</span>}
        <h3 className="xcard-title">{e.name}</h3>
        {e.description && <p className="xcard-desc">{e.description}</p>}

        <dl className="xcard-meta">
          <div><dt><Icon name="clock" size={14} /></dt><dd>{whenLabel(e)}</dd></div>
          {where && <div><dt><Icon name="pin" size={14} /></dt><dd>{where}{e.location.distance_km != null ? ` · ${num(e.location.distance_km)} km` : ''}</dd></div>}
          <div><dt><Icon name="ticket" size={14} /></dt><dd className={price.muted ? 'is-muted' : ''}>{price.main}{price.sub && <small> {price.sub}</small>}</dd></div>
        </dl>

        <div className="xcard-links">
          {e.links.tickets && <a href={e.links.tickets} target="_blank" rel="noopener noreferrer">Ingressos <Icon name="external" size={12} /></a>}
          {e.links.website && <a href={e.links.website} target="_blank" rel="noopener noreferrer">Site <Icon name="external" size={12} /></a>}
          {e.links.instagram && <a href={e.links.instagram} target="_blank" rel="noopener noreferrer"><Icon name="instagram" size={13} /> Instagram</a>}
          {e.location.maps_url && <a href={e.location.maps_url} target="_blank" rel="noopener noreferrer"><Icon name="map" size={13} /> Mapa</a>}
        </div>

        <p className="xcard-source">
          {src.url
            ? <a href={src.url} target="_blank" rel="noopener noreferrer">Fonte: {SOURCE_LABEL[src.provider] || src.provider}</a>
            : <>Fonte: {SOURCE_LABEL[src.provider] || src.provider}</>}
          {checked && <span className="xcard-verified"> · verificado em {checked}</span>}
        </p>
      </div>
    </article>
  )
}
