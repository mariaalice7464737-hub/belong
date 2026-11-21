// Dados "ao vivo" usados na Home e em Essenciais: relógios e clima de Cape Town.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../AppContext'
import { Sheet } from './ui'

export const CPT_TZ = 'Africa/Johannesburg'
export const SP_TZ = 'America/Sao_Paulo'

/* ---------- Relógio ---------- */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export const fmtTime = (d, tz) => d.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
export const fmtSec = (d, tz) => d.toLocaleTimeString('pt-BR', { timeZone: tz, second: '2-digit' }).padStart(2, '0')
export const fmtDay = (d, tz) => d.toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')

/** Minutos de diferença do fuso em relação ao UTC (funciona em qualquer navegador, inclusive Safari). */
export function tzOffsetMin(d, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(d).map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000)
}
export const hoursAhead = (d) => Math.round((tzOffsetMin(d, CPT_TZ) - tzOffsetMin(d, SP_TZ)) / 60)

/* ---------- Clima (Open-Meteo, sem chave) ---------- */
const WMO = {
  0: ['Céu limpo', 'sun'], 1: ['Quase limpo', 'sun-cloud'], 2: ['Parcialmente nublado', 'sun-cloud'], 3: ['Nublado', 'cloud'],
  45: ['Neblina', 'fog'], 48: ['Neblina', 'fog'], 51: ['Garoa', 'drizzle'], 53: ['Garoa', 'drizzle'], 55: ['Garoa forte', 'drizzle'],
  61: ['Chuva fraca', 'rain'], 63: ['Chuva', 'rain'], 65: ['Chuva forte', 'rain'], 80: ['Pancadas', 'drizzle'],
  81: ['Pancadas', 'rain'], 82: ['Pancadas fortes', 'storm'], 95: ['Trovoadas', 'storm'],
}
export const wmo = (c) => WMO[c] || ['—', 'cloud']
/** Nome do desenho para o código do tempo; de noite, sol vira lua. */
const kindOf = (code, isDay = 1) => {
  const k = wmo(code)[1]
  if (isDay !== 0) return k
  return k === 'sun' ? 'moon' : k === 'sun-cloud' ? 'moon-cloud' : k
}

/** Desenho do tempo (sol, nuvem, chuva, lua…), em SVG. */
export function WeatherIcon({ code, isDay = 1, size = 28, className = '' }) {
  const k = kindOf(code, isDay)
  const sun = (cx, cy, r) => (
    <g className="wi-sun">
      <circle cx={cx} cy={cy} r={r} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180
        return <line key={a} x1={cx + Math.cos(rad) * (r + 2.5)} y1={cy + Math.sin(rad) * (r + 2.5)} x2={cx + Math.cos(rad) * (r + 5.5)} y2={cy + Math.sin(rad) * (r + 5.5)} />
      })}
    </g>
  )
  const moon = (cx, cy) => <path className="wi-moon" d={`M${cx + 3} ${cy - 8}a8 8 0 1 0 6 12a7 7 0 0 1-6-12z`} />
  const cloud = (dx = 0, dy = 0, dark = false) => (
    <path className={`wi-cloud ${dark ? 'is-dark' : ''}`} transform={`translate(${dx} ${dy})`}
      d="M9 27h17a6 6 0 0 0 0-12a8 8 0 0 0-15.3-1.8A5.5 5.5 0 0 0 9 27z" />
  )
  const drops = (n, long) => (
    <g className="wi-rain">
      {Array.from({ length: n }, (_, i) => <line key={i} x1={12 + i * 6} y1={29} x2={10 + i * 6} y2={long ? 35 : 32} />)}
    </g>
  )
  return (
    <svg className={`wicon ${className}`} viewBox="0 0 36 36" width={size} height={size} aria-hidden>
      {k === 'sun' && sun(18, 18, 6.5)}
      {k === 'moon' && moon(17, 18)}
      {k === 'sun-cloud' && <>{sun(23, 12, 5)}{cloud(-2, 3)}</>}
      {k === 'moon-cloud' && <>{moon(22, 12)}{cloud(-2, 3)}</>}
      {k === 'cloud' && <>{cloud(3, -2, true)}{cloud(-1, 3)}</>}
      {k === 'fog' && <>{cloud(0, -3)}<g className="wi-fog"><line x1="7" y1="28" x2="29" y2="28" /><line x1="10" y1="32" x2="26" y2="32" /></g></>}
      {k === 'drizzle' && <>{cloud(0, -3)}{drops(3, false)}</>}
      {k === 'rain' && <>{cloud(0, -3, true)}{drops(3, true)}</>}
      {k === 'storm' && <>{cloud(0, -3, true)}<path className="wi-bolt" d="M19 26l-4 6h4l-2 5 6-7h-4l2-4z" /></>}
    </svg>
  )
}

// Uma busca só por sessão, compartilhada entre a Home e Essenciais.
let weatherPromise = null
export function useWeather() {
  const { guide } = useApp()
  const { lat, lon } = guide.destinations.home
  const [w, setW] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    if (!weatherPromise) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day' +
        '&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,is_day' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset,precipitation_probability_max' +
        '&forecast_days=7&timezone=Africa%2FJohannesburg'
      weatherPromise = fetch(url).then((r) => r.json()).then((j) => { if (!j?.current) throw new Error('sem dados'); return j })
      weatherPromise.catch(() => { weatherPromise = null })
    }
    weatherPromise.then((j) => alive && setW(j)).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [lat, lon])
  return { w, failed }
}

const hourOf = (iso) => iso.slice(11, 13) + 'h'
const shortDay = (d, i) => (i === 0 ? 'Hoje' : new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''))
const longDay = (d, i) => (i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', ''))

/** Clima da semana + hora a hora do dia escolhido. */
export function WeatherSheet({ w, open, startDay = 0, onClose }) {
  const [day, setDay] = useState(startDay)
  useEffect(() => { if (open) setDay(startDay) }, [open, startDay])
  if (!open || !w) return null
  const d = w.daily
  const date = d.time[day]
  const nowIso = w.current.time.slice(0, 13)
  const hours = w.hourly.time.map((t, i) => ({ t, i })).filter(({ t }) => t.startsWith(date) && (day > 0 || t.slice(0, 13) >= nowIso))
  const temps = hours.map(({ i }) => w.hourly.temperature_2m[i])
  const lo = Math.min(...temps), hi = Math.max(...temps)

  // Portal: abre por cima de tudo, mesmo quando chamado de dentro da capa da Home.
  return createPortal(
    <Sheet open onClose={onClose} kicker="Clima em Cape Town" title={longDay(date, day)}>
      <ul className="week" role="tablist" aria-label="Dias da semana">
        {d.time.map((t, i) => (
          <li key={t}>
            <button type="button" role="tab" aria-selected={day === i} className={day === i ? 'is-on' : ''} onClick={() => setDay(i)}>
              <small>{shortDay(t, i)}</small>
              <WeatherIcon code={d.weather_code[i]} size={30} />
              <b>{Math.round(d.temperature_2m_max[i])}°</b>
              <small>{Math.round(d.temperature_2m_min[i])}°</small>
            </button>
          </li>
        ))}
      </ul>

      <div className="day-summary">
        <span>{wmo(d.weather_code[day])[0]}</span>
        <span>{Math.round(d.temperature_2m_min[day])}° / {Math.round(d.temperature_2m_max[day])}°</span>
        <span>Chuva até {d.precipitation_probability_max?.[day] ?? 0}%</span>
        <span>UV {Math.round(d.uv_index_max[day])}</span>
        <span>Sol {d.sunrise[day].slice(11)} – {d.sunset[day].slice(11)}</span>
      </div>

      <ul className="hourly">
        {hours.map(({ t, i }, k) => {
          const temp = w.hourly.temperature_2m[i]
          const pct = hi > lo ? ((temp - lo) / (hi - lo)) * 100 : 50
          const isNow = day === 0 && k === 0
          return (
            <li key={t} className={isNow ? 'is-now' : ''}>
              <span className="h-time">{isNow ? 'Agora' : hourOf(t)}</span>
              <span className="h-icon"><WeatherIcon code={w.hourly.weather_code[i]} isDay={w.hourly.is_day?.[i]} size={24} /></span>
              <span className="h-bar"><i style={{ left: `${pct}%` }} /></span>
              <b className="h-temp">{Math.round(temp)}°</b>
              <span className="h-rain">{w.hourly.precipitation_probability[i] ?? 0}%</span>
              <span className="h-wind">{Math.round(w.hourly.wind_speed_10m[i])} km/h</span>
            </li>
          )
        })}
      </ul>
      <p className="fine">Colunas: hora, tempo, temperatura, chance de chuva e vento. Previsão: Open-Meteo.</p>
    </Sheet>,
    document.body,
  )
}

/* ---------- Câmbio ---------- */
export const rateCache = {}

/** Cotação do dia de uma moeda para outra (open.er-api.com, sem chave). */
export function useRate(from, to, fallback) {
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

