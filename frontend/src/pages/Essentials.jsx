import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import Icon from '../components/Icon'
import { Field, Kicker, SectionTitle } from '../components/ui'

const CPT_TZ = 'Africa/Johannesburg'
const SP_TZ = 'America/Sao_Paulo'

/* ---------- Relógios ---------- */
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

const fmtTime = (d, tz) => d.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
const fmtDay = (d, tz) => d.toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')

/** Diferença em horas entre dois fusos, no momento atual (acompanha horário de verão se houver). */
function hoursAhead(d, tzA, tzB) {
  const at = (tz) => new Date(d.toLocaleString('en-US', { timeZone: tz }))
  return Math.round((at(tzA) - at(tzB)) / 36e5)
}

function Clocks() {
  const now = useNow()
  const diff = hoursAhead(now, CPT_TZ, SP_TZ)
  const hourCpt = Number(now.toLocaleString('en-US', { timeZone: CPT_TZ, hour: 'numeric', hour12: false }))
  const callOk = (() => {
    const hSp = (hourCpt - diff + 24) % 24
    return hSp >= 8 && hSp < 22
  })()
  return (
    <div className="clocks">
      <div className="clock">
        <span className="mono-label">Cape Town · CPT</span>
        <strong>{fmtTime(now, CPT_TZ)}</strong>
        <small>{fmtDay(now, CPT_TZ)}</small>
      </div>
      <div className="clock-diff">
        <b>{diff >= 0 ? `+${diff}h` : `${diff}h`}</b>
        <small>{callOk ? 'bom horário pra ligar' : 'tarde no Brasil'}</small>
      </div>
      <div className="clock">
        <span className="mono-label">São Paulo · BRT</span>
        <strong>{fmtTime(now, SP_TZ)}</strong>
        <small>{fmtDay(now, SP_TZ)}</small>
      </div>
    </div>
  )
}

/* ---------- Câmbio ---------- */
const QUICK = [50, 100, 250, 500, 1000]

function useLiveRate() {
  const [live, setLive] = useState(null) // { rate, date }
  useEffect(() => {
    let alive = true
    fetch('https://open.er-api.com/v6/latest/ZAR')
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.rates?.BRL) {
          setLive({ rate: j.rates.BRL, date: new Date(j.time_last_update_unix * 1000).toLocaleDateString('pt-BR') })
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return live
}

function Converter() {
  const { guide, state, set } = useApp()
  const cur = guide.currency
  const live = useLiveRate()
  const manual = Number(state['fx.manual'])
  const rate = manual > 0 ? manual : live?.rate ?? cur.default_fx
  const source = manual > 0 ? 'cotação que você digitou' : live ? `cotação do dia · ${live.date}` : `cotação salva · ${cur.fx_date} (sem internet)`

  const [zarVal, setZar] = useState('100')
  const [brlVal, setBrl] = useState('')
  const [last, setLast] = useState('zar')
  const shownZar = last === 'zar' ? zarVal : brlVal === '' ? '' : (Number(brlVal) / rate).toFixed(2)
  const shownBrl = last === 'brl' ? brlVal : zarVal === '' ? '' : (Number(zarVal) * rate).toFixed(2)

  return (
    <div className="card conv">
      <label className="conv-row">
        <span className="conv-cur"><b>R</b><small>ZAR · rand</small></span>
        <input inputMode="decimal" value={shownZar} placeholder="0"
          onChange={(e) => { setLast('zar'); setZar(e.target.value.replace(',', '.')) }} />
      </label>
      <div className="conv-sep"><Icon name="swap" size={16} /></div>
      <label className="conv-row">
        <span className="conv-cur"><b>R$</b><small>BRL · real</small></span>
        <input inputMode="decimal" value={shownBrl} placeholder="0"
          onChange={(e) => { setLast('brl'); setBrl(e.target.value.replace(',', '.')) }} />
      </label>
      <div className="conv-quick">
        {QUICK.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => { setLast('zar'); setZar(String(q)) }}>R{q}</button>
        ))}
      </div>
      <p className="fine">
        1 rand = <b>R$ {rate.toFixed(4).replace('.', ',')}</b> · {source}.
        {' '}No cartão ainda entram IOF e a taxa do banco.
      </p>
      <details className="conv-manual">
        <summary>Usar a cotação do meu cartão</summary>
        <Field k="fx.manual" label="R$ por 1 rand (deixe vazio para a cotação do dia)" type="number" placeholder={String(cur.default_fx)} />
        {manual > 0 && <button type="button" className="link-btn" onClick={() => set('fx.manual', '')}>Voltar para a cotação do dia</button>}
      </details>
    </div>
  )
}

/* ---------- Clima (Open-Meteo, sem chave) ---------- */
const WMO = {
  0: ['Céu limpo', '☀️'], 1: ['Quase limpo', '🌤️'], 2: ['Parcialmente nublado', '⛅'], 3: ['Nublado', '☁️'],
  45: ['Neblina', '🌫️'], 48: ['Neblina', '🌫️'], 51: ['Garoa', '🌦️'], 53: ['Garoa', '🌦️'], 55: ['Garoa forte', '🌦️'],
  61: ['Chuva fraca', '🌧️'], 63: ['Chuva', '🌧️'], 65: ['Chuva forte', '🌧️'], 80: ['Pancadas', '🌦️'],
  81: ['Pancadas', '🌧️'], 82: ['Pancadas fortes', '⛈️'], 95: ['Trovoadas', '⛈️'],
}
const wmo = (c) => WMO[c] || ['—', '🌡️']

function Weather() {
  const { guide } = useApp()
  const { lat, lon } = guide.destinations.home
  const [w, setW] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&forecast_days=5&timezone=Africa%2FJohannesburg'
    fetch(url).then((r) => r.json()).then(setW).catch(() => setFailed(true))
  }, [lat, lon])

  if (failed) return <div className="card weather"><p className="muted">Não consegui carregar o clima agora (sem internet?). Tente de novo mais tarde.</p></div>
  if (!w?.current) return <div className="card weather"><p className="muted">Carregando o clima…</p></div>

  const c = w.current
  const [label, emoji] = wmo(c.weather_code)
  const wind = Math.round(c.wind_speed_10m)
  const uv = Math.round(w.daily.uv_index_max[0])
  return (
    <div className="card weather">
      <div className="weather-now">
        <span className="weather-emoji" aria-hidden>{emoji}</span>
        <div>
          <strong>{Math.round(c.temperature_2m)}°</strong>
          <small>{label} · sensação {Math.round(c.apparent_temperature)}°</small>
        </div>
      </div>
      <dl className="facts">
        <div><dt>Vento</dt><dd>{wind} km/h{wind >= 35 ? ' · ventania' : ''}</dd></div>
        <div><dt>UV hoje</dt><dd>{uv}{uv >= 8 ? ' · protetor!' : ''}</dd></div>
      </dl>
      <ul className="forecast">
        {w.daily.time.map((d, i) => (
          <li key={d}>
            <small>{i === 0 ? 'Hoje' : new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small>
            <span aria-hidden>{wmo(w.daily.weather_code[i])[1]}</span>
            <b>{Math.round(w.daily.temperature_2m_max[i])}°</b>
            <small>{Math.round(w.daily.temperature_2m_min[i])}°</small>
          </li>
        ))}
      </ul>
      <p className="fine">Cape Town venta muito no verão (o “Cape Doctor”). Previsão: Open-Meteo.</p>
    </div>
  )
}

/* ---------- Números importantes ---------- */
function Emergency() {
  const { guide } = useApp()
  const e = guide.emergency
  return (
    <>
      <ul className="sos-list">
        {e.contacts.map((c, i) => (
          <li key={i} className={c.primary ? 'is-primary' : ''}>
            <a href={c.email ? `mailto:${c.email}` : `tel:${c.tel}`}>
              <span className="sos-icon"><Icon name={c.email ? 'mail' : 'phone'} size={18} /></span>
              <span className="sos-text">
                <small>{c.label}</small>
                <strong>{c.number}</strong>
                {c.note && <em>{c.note}</em>}
              </span>
              <Icon name="arrow" size={18} />
            </a>
          </li>
        ))}
      </ul>
      <div className="two">
        {e.custom_fields.map((f) => <Field key={f.key} k={f.key} label={f.label} placeholder={f.default ?? f.placeholder} />)}
      </div>
      <p className="fine">
        Fontes:{' '}
        {e.sources.map((s, i) => (
          <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></span>
        ))}
      </p>
    </>
  )
}

export default function Essentials() {
  const { guide } = useApp()
  return (
    <main className="page ess-page">
      <section className="docs-hero ess-hero">
        <Kicker light>Chapter three · essentials</Kicker>
        <h1>Tudo <em>à mão,</em><br />o tempo todo.</h1>
        <Clocks />
      </section>

      <nav className="jump">
        <a href="#cambio">Câmbio</a><a href="#clima">Clima</a><a href="#sos">Emergência</a>
      </nav>

      <div className="page-body">
        <section className="block" id="cambio">
          <SectionTitle kicker="01 · Câmbio" title="Quanto é isso em reais?">
            Digite em rand ou em real, o outro lado calcula sozinho.
          </SectionTitle>
          <Converter />
        </section>

        <section className="block" id="clima">
          <SectionTitle kicker="02 · Clima" title="Como está lá fora.">Agora e nos próximos dias em Cape Town.</SectionTitle>
          <Weather />
        </section>

        <section className="block" id="sos">
          <SectionTitle kicker="03 · Números importantes" title="Salve no celular.">{guide.emergency.intro}</SectionTitle>
          <Emergency />
        </section>
      </div>
    </main>
  )
}
