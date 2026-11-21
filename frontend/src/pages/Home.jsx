import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'
import { PassCarousel } from '../components/BoardingPass'
import Icon from '../components/Icon'
import { Kicker, Sheet } from '../components/ui'
import { Clocks, Converter } from './Essentials'
import { CPT_TZ, SP_TZ, WeatherIcon, WeatherSheet, fmtTime, refreshRates, useNow, useRate, useWeather, wmo } from '../components/Live'

/**
 * Paisagem de Cape Town vista da baía: Devil's Peak à esquerda, o topo reto da
 * Table Mountain no centro, os Twelve Apostles descendo atrás e o Lion's Head
 * com o Signal Hill à direita. (Usada se não houver foto em public/images/hero.jpg.)
 */
function HeroArt() {
  return (
    <svg className="hero-art" viewBox="-400 442 1200 358" preserveAspectRatio="xMidYMax slice" aria-hidden>
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
  const [open, setOpen] = useState(null) // 'weather' | 'time' | 'fx'
  const c = w?.current
  const updated = Math.min(...[w?.fetchedAt, fx.fetchedAt].filter(Boolean)) || null
  const offline = failed || !fx.live
  const doRefresh = () => { refresh(); refreshRates('ZAR') }

  return (
    <div className="live-panel">
      <div className="live-cells">
        <button type="button" className="live-cell" onClick={() => w && setOpen('weather')} disabled={!w}
          aria-label={c ? `Clima: ${Math.round(c.temperature_2m)} graus, ${wmo(c.weather_code)[0]}. Ver a semana` : 'Clima'}>
          <span className="live-label">Clima</span>
          <span className="live-main">
            {c ? <WeatherIcon code={c.weather_code} isDay={c.is_day} size={26} /> : null}
            <b>{c ? `${Math.round(c.temperature_2m)}°C` : '—'}</b>
          </span>
          <small>{c ? wmo(c.weather_code)[0] : failed ? 'Indisponível' : 'Carregando…'}</small>
        </button>
        <button type="button" className="live-cell" onClick={() => setOpen('time')} aria-label="Ver horários de Cape Town e São Paulo">
          <span className="live-label">Cape Town</span>
          <span className="live-main"><b>{fmtTime(now, CPT_TZ)}</b></span>
          <small>SP {fmtTime(now, SP_TZ)}</small>
        </button>
        <button type="button" className="live-cell" onClick={() => setOpen('fx')} aria-label="Abrir o conversor de moedas">
          <span className="live-label">Câmbio</span>
          <span className="live-main"><b>R$ {fx.rate ? fx.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</b></span>
          <small>por R 1</small>
        </button>
      </div>
      <div className="live-foot">
        <span className={`live-dot ${offline ? 'is-off' : ''}`} aria-hidden />
        <span>{offline ? 'Sem conexão · usando dados salvos' : `Ao vivo · atualizado ${agoLabel(updated, now)}`}</span>
        <button type="button" className={`live-refresh ${loading ? 'is-spinning' : ''}`} onClick={doRefresh} aria-label="Atualizar clima e câmbio">
          <Icon name="refresh" size={14} />
        </button>
      </div>
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
        <div className="hero-head">
          <span className="hero-kicker">Your city</span>
          <h1 className="hero-city">Cape Town</h1>
          <p className="hero-sub">Explore your new home</p>
        </div>
        <div className="hero-corners hero-bottom">
          <span>Find<br />your<br />place</span>
          <span className="ta-right hero-cta">Chapter one:<br />the map <Icon name="arrow" size={16} /></span>
        </div>
      </section>

      {/* Faixa ao vivo, entre a capa e a passagem */}
      <section className="live-band" aria-label="Agora em Cape Town">
        <LivePanel />
      </section>

      {/* 2. Cartão de embarque → documentos */}
      <section className="boarding">
        <div className="boarding-index" aria-hidden>
          <span>02</span><i /><span>04</span>
        </div>
        <Kicker light>Boarding pass · chapter two</Kicker>
        <Link to="/documentos" className="window" aria-label="Abrir documentos">
          <div className="window-glass">
            <PassCarousel />
          </div>
        </Link>
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
