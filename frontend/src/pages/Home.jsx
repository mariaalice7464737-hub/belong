import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'
import { PassCarousel } from '../components/BoardingPass'
import Icon from '../components/Icon'
import { Kicker } from '../components/ui'

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

const CHAPTERS = [
  { n: '01', title: 'O mapa', sub: 'Províncias, moradia, rotas, lugares perto e favoritos', to: '/mapa', icon: 'map' },
  { n: '02', title: 'Documentos', sub: 'Passaporte, vacinas e comprovantes', to: '/documentos', icon: 'passport' },
  { n: '03', title: 'Essenciais', sub: 'Câmbio, clima, horário, internet e números de emergência', to: '/essenciais', icon: 'clock' },
  { n: '04', title: 'Orçamento', sub: 'Quanto custa cada mês', soon: true, icon: 'grid' },
]

export default function Home() {
  const { guide } = useApp()
  const { trip } = guide

  return (
    <main className="home">
      {/* 1. Chamada principal → mapa */}
      <Link to="/mapa" className="hero" aria-label="Abrir o mapa da viagem">
        <HeroArt />
        <div className="hero-photo" />
        <div className="hero-shade" />
        <div className="hero-corners hero-top">
          <span>Summer<br />edit</span>
          <span>Travel<br />diary</span>
          <span>{trip.period.split('—')[0].trim()}<br />{(trip.period.split('—')[1] || '').trim()}</span>
          <span className="ta-right">Endless<br />summer</span>
        </div>
        <h1 className="hero-title">
          <span className="ht-line">Travel</span>
          <span className="ht-script">to</span>
          <span className="ht-line ht-small">South Africa</span>
        </h1>
        <div className="hero-corners hero-bottom">
          <span>Between<br />now<br />and<br />summer</span>
          <span className="ta-right hero-cta">Chapter one:<br />the map <Icon name="arrow" size={16} /></span>
        </div>
      </Link>

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
