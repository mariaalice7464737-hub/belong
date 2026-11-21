import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import Icon from '../components/Icon'
import { Check, ExtLink, Field, Kicker, SectionTitle, Sheet } from '../components/ui'

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
const fmtSec = (d, tz) => d.toLocaleTimeString('pt-BR', { timeZone: tz, second: '2-digit' }).padStart(2, '0')
const fmtDay = (d, tz) => d.toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')

/** Minutos de diferença do fuso em relação ao UTC (funciona em qualquer navegador, inclusive Safari). */
function tzOffsetMin(d, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(d).map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000)
}

function Clocks() {
  const now = useNow(1000)
  const diff = Math.round((tzOffsetMin(now, CPT_TZ) - tzOffsetMin(now, SP_TZ)) / 60)
  const hSp = Number(new Intl.DateTimeFormat('en-US', { timeZone: SP_TZ, hour: 'numeric', hourCycle: 'h23' }).format(now))
  const callOk = hSp >= 8 && hSp < 22
  const Clock = ({ label, tz, right }) => (
    <div className={`clock ${right ? 'is-right' : ''}`}>
      <span className="mono-label">{label}</span>
      <strong>{fmtTime(now, tz)}<span className="clock-sec">:{fmtSec(now, tz)}</span></strong>
      <small>{fmtDay(now, tz)}</small>
    </div>
  )
  return (
    <div className="clocks" aria-live="off">
      <Clock label="Cape Town · CPT" tz={CPT_TZ} />
      <div className="clock-diff">
        <b>{diff >= 0 ? `+${diff}h` : `${diff}h`}</b>
        <small>{callOk ? 'bom horário pra ligar' : 'tarde no Brasil'}</small>
      </div>
      <Clock label="São Paulo · BRT" tz={SP_TZ} right />
    </div>
  )
}

/* ---------- Câmbio ---------- */
const CURRENCIES = [
  { code: 'ZAR', symbol: 'R', name: 'Rand' },
  { code: 'BRL', symbol: 'R$', name: 'Real' },
  { code: 'USD', symbol: 'US$', name: 'Dólar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'Libra' },
  { code: 'NAD', symbol: 'N$', name: 'Dólar namibiano' },
  { code: 'BWP', symbol: 'P', name: 'Pula (Botsuana)' },
  { code: 'MZN', symbol: 'MT', name: 'Metical (Moçambique)' },
]
const cur = (code) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]
const rateCache = {}

/** Cotação do dia de uma moeda para outra (open.er-api.com, sem chave). */
function useRate(from, to, fallback) {
  const [live, setLive] = useState(rateCache[from] || null)
  useEffect(() => {
    let alive = true
    if (rateCache[from]) { setLive(rateCache[from]); return }
    setLive(null)
    fetch(`https://open.er-api.com/v6/latest/${from}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.rates) return
        rateCache[from] = { rates: j.rates, date: new Date(j.time_last_update_unix * 1000).toLocaleDateString('pt-BR') }
        setLive(rateCache[from])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [from])
  if (from === to) return { rate: 1, source: 'mesma moeda' }
  if (live?.rates?.[to]) return { rate: live.rates[to], source: `cotação do dia · ${live.date}` }
  // Sem internet: só sabemos rand ↔ real (cotação salva no guide.json).
  if (from === 'ZAR' && to === 'BRL') return { rate: fallback.rate, source: `cotação salva · ${fallback.date} (sem internet)` }
  if (from === 'BRL' && to === 'ZAR') return { rate: 1 / fallback.rate, source: `cotação salva · ${fallback.date} (sem internet)` }
  return { rate: null, source: 'sem internet para buscar essa cotação' }
}

const fmtMoney = (n) => (Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
const parseMoney = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'))

function CurrencySelect({ value, onChange, label }) {
  return (
    <label className="conv-cur">
      <span className="sr-only">{label}</span>
      <b>{cur(value).symbol}</b>
      <span className="conv-code">{value}</span>
      <Icon name="chevron" size={14} />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
      </select>
    </label>
  )
}

function Converter() {
  const { guide, state, set } = useApp()
  const from = state['fx.from'] || 'ZAR'
  const to = state['fx.to'] || 'BRL'
  const manualKey = `fx.manual.${from}_${to}`
  const manual = Number(String(state[manualKey] ?? '').replace(',', '.'))
  const live = useRate(from, to, { rate: guide.currency.default_fx, date: guide.currency.fx_date })
  const rate = manual > 0 ? manual : live.rate
  const source = manual > 0 ? 'cotação que você digitou' : live.source

  const [amount, setAmount] = useState('100')
  const [side, setSide] = useState('from') // qual campo você está digitando
  const typed = parseMoney(amount)
  const fromVal = side === 'from' ? amount : (rate && amount !== '' ? fmtMoney(typed / rate) : '')
  const toVal = side === 'to' ? amount : (rate && amount !== '' ? fmtMoney(typed * rate) : '')

  const swap = () => {
    set('fx.from', to); set('fx.to', from)
    setSide(side === 'from' ? 'to' : 'from')
  }

  return (
    <div className="card conv">
      <div className="conv-row">
        <CurrencySelect value={from} onChange={(v) => set('fx.from', v)} label="Moeda de origem" />
        <input inputMode="decimal" value={fromVal} placeholder="0" aria-label={`Valor em ${from}`}
          onFocus={() => side !== 'from' && (setSide('from'), setAmount(fromVal))}
          onChange={(e) => { setSide('from'); setAmount(e.target.value) }} />
      </div>
      <div className="conv-sep">
        <button type="button" className="round-btn" onClick={swap} aria-label="Inverter moedas"><Icon name="swap" size={16} /></button>
      </div>
      <div className="conv-row">
        <CurrencySelect value={to} onChange={(v) => set('fx.to', v)} label="Moeda de destino" />
        <input inputMode="decimal" value={toVal} placeholder="0" aria-label={`Valor em ${to}`}
          onFocus={() => side !== 'to' && (setSide('to'), setAmount(toVal))}
          onChange={(e) => { setSide('to'); setAmount(e.target.value) }} />
      </div>
      <p className="fine">
        {rate
          ? <>1 {from} = <b>{cur(to).symbol} {rate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</b> · {source}.</>
          : <>Não consegui a cotação {from} → {to}: {source}.</>}
        {' '}No cartão ainda entram IOF e a taxa do banco.
      </p>
      <details className="conv-manual">
        <summary>Usar a cotação do meu cartão ({from} → {to})</summary>
        <Field k={manualKey} label={`Quanto vale 1 ${from} em ${to}`} placeholder={rate ? String(Number(rate.toFixed(4))) : ''} />
        {manual > 0 && <button type="button" className="link-btn" onClick={() => set(manualKey, '')}>Voltar para a cotação do dia</button>}
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

const hourOf = (iso) => iso.slice(11, 13) + 'h'
const dayName = (d, i) => (i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long' }))

/** Previsão hora a hora de um dia (abre ao tocar no clima). */
function DaySheet({ w, dayIdx, onClose }) {
  if (dayIdx == null) return null
  const date = w.daily.time[dayIdx]
  const nowIso = w.current.time.slice(0, 13)
  const hours = w.hourly.time.map((t, i) => ({ t, i })).filter(({ t }) => t.startsWith(date) && (dayIdx > 0 || t.slice(0, 13) >= nowIso))
  const temps = hours.map(({ i }) => w.hourly.temperature_2m[i])
  const lo = Math.min(...temps), hi = Math.max(...temps)
  const [label] = wmo(w.daily.weather_code[dayIdx])
  return (
    <Sheet open onClose={onClose} kicker="Cape Town · hora a hora" title={dayName(date, dayIdx)}>
      <div className="day-summary">
        <span>{label}</span>
        <span>{Math.round(w.daily.temperature_2m_min[dayIdx])}° / {Math.round(w.daily.temperature_2m_max[dayIdx])}°</span>
        <span>UV {Math.round(w.daily.uv_index_max[dayIdx])}</span>
        <span>☀ {w.daily.sunrise[dayIdx].slice(11)} · ☾ {w.daily.sunset[dayIdx].slice(11)}</span>
      </div>
      <ul className="hourly">
        {hours.map(({ t, i }, k) => {
          const temp = w.hourly.temperature_2m[i]
          const pct = hi > lo ? ((temp - lo) / (hi - lo)) * 100 : 50
          return (
            <li key={t} className={dayIdx === 0 && k === 0 ? 'is-now' : ''}>
              <span className="h-time">{dayIdx === 0 && k === 0 ? 'Agora' : hourOf(t)}</span>
              <span className="h-icon" aria-hidden>{w.hourly.is_day?.[i] === 0 && w.hourly.weather_code[i] <= 2 ? '🌙' : wmo(w.hourly.weather_code[i])[1]}</span>
              <span className="h-bar"><i style={{ left: `${pct}%` }} /></span>
              <b className="h-temp">{Math.round(temp)}°</b>
              <span className="h-rain">{w.hourly.precipitation_probability[i] ?? 0}%</span>
              <span className="h-wind">{Math.round(w.hourly.wind_speed_10m[i])} km/h</span>
            </li>
          )
        })}
      </ul>
      <p className="fine">Colunas: hora, tempo, temperatura, chance de chuva e vento. Previsão: Open-Meteo.</p>
    </Sheet>
  )
}

function Weather() {
  const { guide } = useApp()
  const { lat, lon } = guide.destinations.home
  const [w, setW] = useState(null)
  const [failed, setFailed] = useState(false)
  const [openDay, setOpenDay] = useState(null)

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset&forecast_days=5&timezone=Africa%2FJohannesburg'
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
      <button type="button" className="weather-now" onClick={() => setOpenDay(0)} aria-label="Ver o tempo de hoje hora a hora">
        <span className="weather-emoji" aria-hidden>{emoji}</span>
        <span className="weather-now-text">
          <strong>{Math.round(c.temperature_2m)}°</strong>
          <small>{label} · sensação {Math.round(c.apparent_temperature)}°</small>
        </span>
        <span className="weather-more">Hora a hora <Icon name="arrow" size={14} /></span>
      </button>
      <dl className="facts">
        <div><dt>Vento</dt><dd>{wind} km/h{wind >= 35 ? ' · ventania' : ''}</dd></div>
        <div><dt>UV hoje</dt><dd>{uv}{uv >= 8 ? ' · protetor!' : ''}</dd></div>
      </dl>
      <ul className="forecast">
        {w.daily.time.map((d, i) => (
          <li key={d}>
            <button type="button" onClick={() => setOpenDay(i)} aria-label={`Ver ${dayName(d, i)} hora a hora`}>
              <small>{i === 0 ? 'Hoje' : new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small>
              <span aria-hidden>{wmo(w.daily.weather_code[i])[1]}</span>
              <b>{Math.round(w.daily.temperature_2m_max[i])}°</b>
              <small>{Math.round(w.daily.temperature_2m_min[i])}°</small>
            </button>
          </li>
        ))}
      </ul>
      <p className="fine">Toque num dia para ver hora a hora. Cape Town venta muito no verão (o “Cape Doctor”).</p>
      <DaySheet w={w} dayIdx={openDay} onClose={() => setOpenDay(null)} />
    </div>
  )
}

/* ---------- Internet ---------- */
function Internet() {
  const { guide, state, set } = useApp()
  const net = guide.places.find((p) => p.id === 'internet')
  const fx = guide.currency.default_fx
  if (!net) return null
  const sel = net.fields.find((f) => f.type === 'select')
  return (
    <>
      <ol className="net-steps">
        <li><b>Antes de embarcar</b><span>Instale um eSIM de dados (Airalo) para já chegar com internet.</span></li>
        <li><b>Ao chegar</b><span>Compre um chip pré-pago da Vodacom (no aeroporto ou num shopping). Leve o passaporte e o endereço da residência: o chip precisa ser registrado (RICA).</span></li>
        <li><b>No dia a dia</b><span>Recarregue pacotes de dados pelo app da operadora. Use o Wi-Fi da residência quando der.</span></li>
      </ol>

      <ul className="net-plans">
        {net.prices.map((p) => (
          <li key={p.label}>
            <small>{p.label.split(' ')[0]}</small>
            <strong>{p.label.replace(/^\S+\s/, '')}</strong>
            <span className="mono">R{p.zar}{p.sub ? ` · ${p.sub}` : ''} <em>≈ R$ {Math.round(p.zar * fx)}</em></span>
          </li>
        ))}
      </ul>

      <div className="card net-card">
        {sel && (
          <label className="field">
            <span className="field-label">{sel.label}</span>
            <select className="net-select" value={state[sel.key] ?? ''} onChange={(e) => set(sel.key, e.target.value)}>
              <option value="">Escolher…</option>
              {sel.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        {net.checks.map((c) => <Check key={c.key} k={c.key} label={c.label} hint={c.hint} />)}
        <Check k="check.esim" label="eSIM instalado antes da viagem" hint="Ativa só ao chegar na África do Sul" />
        <Check k="check.rica" label="Chip local registrado (RICA)" hint="Passaporte + endereço da residência" />
        <div className="row-links">
          {net.links.map((l) => <ExtLink key={l.url} href={l.url}>{l.label}</ExtLink>)}
        </div>
      </div>
      <p className="fine">{net.note} Valores em reais aproximados pela cotação salva.</p>
    </>
  )
}

/* ---------- Números importantes ---------- */
function Emergency() {
  const { guide } = useApp()
  const e = guide.emergency
  return (
    <>
      <ul className="sos-grid">
        {e.contacts.map((c, i) => (
          <li key={i} className={c.primary ? 'is-primary' : ''}>
            <a href={c.email ? `mailto:${c.email}` : `tel:${c.tel}`} title={c.note || undefined}>
              <Icon name={c.email ? 'mail' : 'phone'} size={16} />
              <small>{c.short || c.label}</small>
              <strong className={c.email ? 'is-email' : ''}>{c.number}</strong>
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
        <a href="#cambio">Câmbio</a><a href="#clima">Clima</a><a href="#internet">Internet</a><a href="#sos">Emergência</a>
      </nav>

      <div className="page-body">
        <section className="block" id="cambio">
          <SectionTitle kicker="01 · Câmbio" title="Quanto é isso em reais?">
            Escolha as moedas e digite em qualquer um dos lados.
          </SectionTitle>
          <Converter />
        </section>

        <section className="block" id="clima">
          <SectionTitle kicker="02 · Clima" title="Como está lá fora.">Agora e nos próximos dias em Cape Town.</SectionTitle>
          <Weather />
        </section>

        <section className="block" id="internet">
          <SectionTitle kicker="03 · Internet" title="Sempre conectada.">Chip, eSIM e quanto custa.</SectionTitle>
          <Internet />
        </section>

        <section className="block" id="sos">
          <SectionTitle kicker="04 · Números importantes" title="Salve no celular.">{guide.emergency.intro}</SectionTitle>
          <Emergency />
        </section>
      </div>
    </main>
  )
}
