import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import { PassCarousel } from '../components/BoardingPass'
import Icon from '../components/Icon'
import { Kicker, Sheet } from '../components/ui'
import { Clocks, Converter } from './Essentials'
import { CPT_TZ, SP_TZ, WeatherIcon, WeatherSheet, fmtDay, fmtTime, refreshRates, useNow, useRate, useWeather, wmo } from '../components/Live'

/**
 * Paisagem de Cape Town vista da baía: Devil's Peak à esquerda, o topo reto da
 * Table Mountain no centro, os Twelve Apostles descendo atrás e o Lion's Head
 * com o Signal Hill à direita. (Usada se não houver foto em public/images/hero.jpg.)
 */
function HeroArt() {
  return (
    <svg className="hero-art" viewBox="-400 442 1200 358" preserveAspectRatio="xMidYMin slice" aria-hidden>
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f8f97" />
          <stop offset="1" stopColor="#2f4d57" />
        </linearGradient>
        <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#647f88" />
          <stop offset="1" stopColor="#526d76" />
        </linearGradient>
      </defs>
      {/* Twelve Apostles: contrafortes recortados atrás, descendo para o sul (direita) */}
      <path fill="#7d959c" opacity=".75"
        d="M226 470 L236 462 L242 468 L250 458 L257 466 L264 456 L271 465 L279 457 L286 467 L294 460 L301 470 L309 463
           L316 474 L324 468 L332 480 L345 486 L380 494 L420 492 L460 502 L520 506 L600 520 L800 536 L800 580 L226 580Z" />
      {/* Morros baixos à esquerda, depois do Devil's Peak */}
      <path fill="#6a848c" d="M-400 552 L-300 540 L-200 528 L-120 520 L-60 510 L-20 512 L20 530 L20 580 L-400 580Z" />
      {/* Devil's Peak + Table Mountain (topo reto, paredões) + descida até o Kloof Nek */}
      <path fill="url(#rock)"
        d="M-400 590 L-400 576 C-260 570 -140 556 -60 540 C-30 524 -5 508 12 490 L28 470 L41 452 L50 466 L64 484 L78 490 L92 476 L98 462 L104 455
           L226 453 L232 458 L238 476 L246 500 L262 520 L284 528 L300 532 L300 600 L-400 600Z" />
      {/* Lion's Head (cúpula com o bico) + Signal Hill, que desce até Sea Point */}
      <path fill="#5a7680"
        d="M262 560 C282 540 296 512 306 486 C312 470 317 458 322 452 C325 448 330 448 333 452 C338 460 342 474 347 490
           C354 510 364 522 380 528 C400 534 430 534 470 538 C540 544 640 552 800 560 L800 600 L262 600Z" />
      {/* Encosta da cidade */}
      <path fill="#4b666f" opacity=".9" d="M-400 574 L-200 566 L-60 572 L40 556 L120 562 L200 552 L280 560 L360 552 L460 558 L600 562 L800 566 L800 610 L-400 610Z" />
      <rect x="-400" y="580" width="1200" height="220" fill="url(#sea)" />
      <g stroke="#fff3df" strokeOpacity=".35" strokeWidth="1.2">
        <path d="M250 600h80M220 618h120M260 640h70M200 664h90M-180 610h90M520 626h110M-260 650h70" />
      </g>
      {/* Muro da orla de Sea Point */}
      <path fill="#1f3640" d="M-400 744 Q200 722 800 744 L800 800 L-400 800Z" />
    </svg>
  )
}

const agoLabel = (t, now) => {
  if (!t) return null
  const min = Math.floor((now - t) / 60000)
  return min < 1 ? 'agora há pouco' : min === 1 ? 'há 1 min' : min < 60 ? `há ${min} min` : `às ${new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** Painel compacto: clima, horários e câmbio, com indicação de atualização. */
function LivePanel() {
  const { guide } = useApp()
  const { w, failed, loading, refresh } = useWeather()
  const now = useNow(1000)
  const fx = useRate('ZAR', 'BRL', { rate: guide.currency.default_fx, date: guide.currency.fx_date })
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(null) // pop-up: 'weather' | 'time' | 'fx'
  const ref = useRef(null)
  const c = w?.current
  const d = w?.daily
  const updated = Math.min(...[w?.fetchedAt, fx.fetchedAt].filter(Boolean)) || null
  const offline = failed || !fx.live
  const doRefresh = () => { refresh(); refreshRates('ZAR') }
  const money = (n, dig = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: dig, maximumFractionDigits: dig })
  const pop = (k) => { setOpen(k); setExpanded(false) }

  // Fecha o cartão expandido ao tocar fora ou apertar Esc.
  useEffect(() => {
    if (!expanded) return
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setExpanded(false) }
    const onKey = (e) => e.key === 'Escape' && setExpanded(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [expanded])

  return (
    <div className={`live-panel ${expanded ? 'is-open' : ''}`} ref={ref}>
      <button type="button" className="live-bar" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} aria-controls="live-more"
        aria-label={`Agora em Cape Town: ${c ? `${Math.round(c.temperature_2m)} graus, ` : ''}${fmtTime(now, CPT_TZ)}, rand a R$ ${money(fx.rate || 0)}. ${expanded ? 'Recolher' : 'Ver mais'}`}>
        <span className="live-cell">
          {c && <WeatherIcon code={c.weather_code} isDay={c.is_day} size={18} />}
          <b>{c ? `${Math.round(c.temperature_2m)}°` : '—'}</b>
        </span>
        <span className="live-cell"><b>{fmtTime(now, CPT_TZ)}</b><small>CPT</small></span>
        <span className="live-cell"><b>R$ {fx.rate ? money(fx.rate) : '—'}</b></span>
        <span className="live-cell live-status"><span className={`live-dot ${offline ? 'is-off' : ''}`} /><Icon name="chevron" size={14} className="live-chev" /></span>
      </button>

      {expanded && (
        <div className="live-more" id="live-more" role="region" aria-label="Mais informações">
          <button type="button" className="lm-row" onClick={() => w && pop('weather')} disabled={!w}>
            <span className="lm-label">Clima</span>
            {c ? (
              <span className="lm-body">
                <b>{Math.round(c.temperature_2m)}° · {wmo(c.weather_code)[0]}</b>
                <small>Sensação {Math.round(c.apparent_temperature)}° · mín {Math.round(d.temperature_2m_min[0])}° máx {Math.round(d.temperature_2m_max[0])}° · vento {Math.round(c.wind_speed_10m)} km/h</small>
              </span>
            ) : <span className="lm-body"><small>{failed ? 'Indisponível agora' : 'Carregando…'}</small></span>}
            <span className="lm-go">Semana <Icon name="arrow" size={12} /></span>
          </button>
          <button type="button" className="lm-row" onClick={() => pop('time')}>
            <span className="lm-label">Horário</span>
            <span className="lm-body">
              <b>{fmtTime(now, CPT_TZ)} Cape Town · {fmtTime(now, SP_TZ)} São Paulo</b>
              <small>Cape Town está 5h à frente · {fmtDay(now, CPT_TZ)}</small>
            </span>
            <span className="lm-go">Fusos <Icon name="arrow" size={12} /></span>
          </button>
          <button type="button" className="lm-row" onClick={() => pop('fx')}>
            <span className="lm-label">Câmbio</span>
            <span className="lm-body">
              <b>R 1 = R$ {fx.rate ? money(fx.rate, 4) : '—'}</b>
              <small>{fx.rate ? `R$ 1 = R ${money(1 / fx.rate)} · R 100 = R$ ${money(fx.rate * 100)}` : fx.source}</small>
            </span>
            <span className="lm-go">Converter <Icon name="arrow" size={12} /></span>
          </button>
          <div className="lm-foot">
            <span className={`live-dot ${offline ? 'is-off' : ''}`} aria-hidden />
            <span>{offline ? 'Sem conexão · usando dados salvos' : `Atualizado ${agoLabel(updated, now)}`}</span>
            <button type="button" className={`lm-refresh ${loading ? 'is-spinning' : ''}`} onClick={doRefresh}>
              <Icon name="refresh" size={13} /> Atualizar
            </button>
          </div>
        </div>
      )}

      <WeatherSheet glass w={w} open={open === 'weather'} onClose={() => setOpen(null)} />
      {open === 'time' && createPortal(
        <Sheet glass open onClose={() => setOpen(null)} kicker="Fuso horário" title="Agora">
          <Clocks />
          <p className="fine">Cape Town fica 5 horas à frente de Brasília. Bom horário para ligar para o Brasil: entre 13h e 3h de Cape Town (8h às 22h no Brasil).</p>
        </Sheet>, document.body)}
      {open === 'fx' && createPortal(
        <Sheet glass open onClose={() => setOpen(null)} kicker="Câmbio" title="Conversor">
          <Converter />
        </Sheet>, document.body)}
    </div>
  )
}

/* ---------- Perto de você: acesso rápido ao mapa ---------- */
const distKm = (a, b) => {
  const R = 6371, rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function NearbyCard() {
  const { guide } = useApp()
  const navigate = useNavigate()
  const home = guide.destinations.home
  const cats = (guide.home_nearby || []).map((id) => guide.nearby.find((c) => c.id === id)).filter(Boolean)
  const [loc, setLoc] = useState(null) // { lat, lon }
  const [status, setStatus] = useState('idle') // idle | asking | ok | denied | unsupported

  const ask = () => {
    if (!('geolocation' in navigator)) { setStatus('unsupported'); return }
    setStatus('asking')
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lon: p.coords.longitude }); setStatus('ok') },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }
  const go = (cat) => navigate('/mapa', { state: { cat, near: loc } })
  const km = loc ? distKm(loc, home) : null
  const where = {
    idle: 'Mostrando o que há perto da residência, em Green Point.',
    asking: 'Pedindo sua localização…',
    ok: km < 1 ? 'Você está pertinho da residência.' : km < 60 ? `Você está a ${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km da residência.` : 'Você ainda não está em Cape Town: mostrando o entorno da residência.',
    denied: 'Sem permissão de localização: usando a residência.',
    unsupported: 'Este navegador não informa a localização: usando a residência.',
  }[status]

  return (
    <article className="bcard bcard-map">
      <svg className="bcard-map-art" viewBox="0 0 160 160" aria-hidden>
        <circle cx="80" cy="80" r="70" /><circle cx="80" cy="80" r="48" /><circle cx="80" cy="80" r="26" />
        <path className="road" d="M0 104 C40 96 70 112 160 84 M58 0 C66 50 60 110 72 160" />
        <circle className="me" cx="80" cy="80" r="5" />
        <circle className="pin" cx="112" cy="56" r="3.5" /><circle className="pin" cx="46" cy="64" r="3.5" /><circle className="pin" cx="104" cy="118" r="3.5" />
      </svg>
      <span className="bcard-kicker">Perto de você</span>
      <h3 className="bcard-title">O que tem por aqui?</h3>
      <p className="bcard-text">{where}</p>
      <div className="bcard-chips">
        {cats.map((c) => (
          <button key={c.id} type="button" className="bchip" onClick={() => go(c.id)}>
            <Icon name={c.icon} size={15} /> {c.label}
          </button>
        ))}
      </div>
      <div className="bcard-foot">
        {status !== 'ok' ? (
          <button type="button" className="bbtn" onClick={ask} disabled={status === 'asking'}>
            <Icon name="locate" size={16} /> {status === 'asking' ? 'Localizando…' : 'Usar minha localização'}
          </button>
        ) : (
          <span className="bcard-ok"><span className="live-dot" /> Localização ativa</span>
        )}
        <Link to="/mapa" className="blink">Abrir o mapa <Icon name="arrow" size={14} /></Link>
      </div>
    </article>
  )
}

function FxCard() {
  return (
    <article className="bcard bcard-fx glass-scope">
      <span className="bcard-kicker">Câmbio</span>
      <h3 className="bcard-title">Quanto é em reais?</h3>
      <Converter />
    </article>
  )
}

const CHAPTERS = [
  { n: '01', title: 'O mapa', sub: 'Províncias, moradia, rotas, lugares perto e favoritos', to: '/mapa', icon: 'map' },
  { n: '02', title: 'Documentos', sub: 'Passaporte, vacinas e comprovantes', to: '/documentos', icon: 'passport' },
  { n: '03', title: 'Essenciais', sub: 'Câmbio, clima, horário, internet e números de emergência', to: '/essenciais', icon: 'clock' },
  { n: '04', title: 'Orçamento', sub: 'Quanto custa cada mês', soon: true, icon: 'grid' },
]

export default function Home() {
  return (
    <main className="home">
      {/* 1. Chamada principal → mapa */}
      <section className="hero">
        <Link to="/mapa" className="hero-link" aria-label="Abrir o mapa da viagem" />
        <HeroArt />
        <div className="hero-photo" />
        <div className="hero-shade" />
        <LivePanel />
        <h1 className="hero-title">
          <span className="ht-line">Travel</span>
          <span className="ht-script">to</span>
          <span className="ht-line ht-small">South Africa</span>
        </h1>
        <div className="hero-corners hero-bottom">
          <span>Find<br />your<br />place</span>
          <span className="ta-right hero-cta">Chapter one:<br />the map <Icon name="arrow" size={16} /></span>
        </div>
      </section>

      {/* 2. Cartão de embarque → documentos */}
      <section className="boarding">
        <div className="boarding-index" aria-hidden>
          <span>02</span><i /><span>04</span>
        </div>
        <Kicker light>Boarding pass · chapter two</Kicker>
        <div className="boarding-grid">
          <div className="boarding-main">
            <Link to="/documentos" className="window" aria-label="Abrir documentos">
              <div className="window-glass">
                <PassCarousel />
              </div>
            </Link>
          </div>
          <div className="boarding-side">
            <NearbyCard />
            <FxCard />
          </div>
        </div>
      </section>

      {/* 3. Índice de capítulos */}
      <section className="chapters">
        <Kicker>Contents</Kicker>
        <ol>
          {CHAPTERS.map((c) => {
            const inner = (
              <>
                <span className="ch-n">{c.n}</span>
                <span className="ch-text">
                  <strong>{c.title}</strong>
                  <small>{c.sub}</small>
                </span>
                {c.soon ? <span className="ch-soon">em breve</span> : <Icon name="arrow" />}
              </>
            )
            return (
              <li key={c.n}>
                {c.soon ? <div className="ch is-soon">{inner}</div> : <Link to={c.to} className="ch">{inner}</Link>}
              </li>
            )
          })}
        </ol>
      </section>

      <footer className="foot">
        <strong>Cape Town · 2026—2027</strong>
        <span>Planejado com calma, vivido com liberdade.</span>
      </footer>
    </main>
  )
}
