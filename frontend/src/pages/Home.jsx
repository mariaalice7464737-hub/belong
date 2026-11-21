import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'
import { PassCarousel } from '../components/BoardingPass'
import Icon from '../components/Icon'
import { Kicker } from '../components/ui'
import { CPT_TZ, SP_TZ, WeatherIcon, WeatherSheet, fmtTime, useNow, useRate, useWeather, wmo } from '../components/Live'

/** Paisagem de Cape Town ao entardecer (usada se não houver foto em public/images/hero.jpg). */
function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 430 400 370" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f8f97" />
          <stop offset="1" stopColor="#2f4d57" />
        </linearGradient>
      </defs>
      {/* Lion's Head + Table Mountain + Devil's Peak */}
      <path fill="#5f7a82" d="M-60 560 L20 520 L45 470 L58 452 L70 470 L92 515 L120 500 L150 452 L330 444 L350 430 L372 404 L392 428 L460 500 L460 600 L-60 600Z" />
      <path fill="#4b666f" opacity=".85" d="M-60 575 L60 548 L140 556 L230 540 L330 552 L460 536 L460 610 L-60 610Z" />
      <rect x="-60" y="580" width="520" height="220" fill="url(#sea)" />
      <g stroke="#fff3df" strokeOpacity=".35" strokeWidth="1.2">
        <path d="M250 600h80M220 618h120M260 640h70M200 664h90" />
      </g>
      {/* Muro da orla de Sea Point */}
      <path fill="#1f3640" d="M-60 742 Q200 726 460 738 L460 800 L-60 800Z" />
    </svg>
  )
}

/** Faixa do topo: clima, horários e câmbio, ao vivo. */
function HeroLive() {
  const { guide } = useApp()
  const { w, failed } = useWeather()
  const now = useNow(1000)
  const fx = useRate('ZAR', 'BRL', { rate: guide.currency.default_fx, date: guide.currency.fx_date })
  const [open, setOpen] = useState(false)
  const c = w?.current
  return (
    <div className="hero-live">
      <button type="button" className="live-pill live-weather" onClick={() => w && setOpen(true)} disabled={!w}
        aria-label={c ? `Clima em Cape Town: ${Math.round(c.temperature_2m)} graus, ${wmo(c.weather_code)[0]}. Ver a semana` : 'Clima em Cape Town'}>
        {c ? (
          <>
            <WeatherIcon code={c.weather_code} isDay={c.is_day} size={40} />
            <span>
              <strong>{Math.round(c.temperature_2m)}°C</strong>
              <small>{wmo(c.weather_code)[0]}</small>
            </span>
          </>
        ) : (
          <span><strong>—°C</strong><small>{failed ? 'Clima indisponível' : 'Carregando clima…'}</small></span>
        )}
      </button>
      <Link to="/essenciais" className="live-pill live-time" aria-label="Horário em Cape Town e São Paulo">
        <span><small>CPT</small><b>{fmtTime(now, CPT_TZ)}</b></span>
        <span><small>SP</small><b>{fmtTime(now, SP_TZ)}</b></span>
      </Link>
      <Link to="/essenciais" className="live-pill live-fx" aria-label="Cotação do rand">
        <small>R 1 =</small><b>R$ {fx.rate ? fx.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</b>
      </Link>
      <WeatherSheet w={w} open={open} onClose={() => setOpen(false)} />
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
        <HeroLive />
        <h1 className="hero-title">
          <span className="ht-line">Travel</span>
          <span className="ht-script">to</span>
          <span className="ht-line ht-small">South Africa</span>
        </h1>
        <div className="hero-corners hero-bottom">
          <span>Between<br />now<br />and<br />summer</span>
          <span className="ta-right hero-cta">Chapter one:<br />the map <Icon name="arrow" size={16} /></span>
        </div>
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
