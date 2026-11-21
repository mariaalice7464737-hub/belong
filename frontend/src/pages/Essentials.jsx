import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import Icon from '../components/Icon'
import { Check, ExtLink, Field, Kicker, SectionTitle } from '../components/ui'
import { CPT_TZ, SP_TZ, WeatherIcon, WeatherSheet, fmtDay, fmtSec, fmtTime, hoursAhead, rateCache, useNow, useRate, useWeather, wmo } from '../components/Live'

/* ---------- Relógios ---------- */
function Clocks() {
  const now = useNow(1000)
  const diff = hoursAhead(now)
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

/* ---------- Clima ---------- */
function Weather() {
  const { w, failed } = useWeather()
  const [openDay, setOpenDay] = useState(null)

  if (failed) return <div className="card weather"><p className="muted">Não consegui carregar o clima agora (sem internet?). Tente de novo mais tarde.</p></div>
  if (!w?.current) return <div className="card weather"><p className="muted">Carregando o clima…</p></div>

  const c = w.current
  const wind = Math.round(c.wind_speed_10m)
  const uv = Math.round(w.daily.uv_index_max[0])
  return (
    <div className="card weather">
      <button type="button" className="weather-now" onClick={() => setOpenDay(0)} aria-label="Ver o tempo de hoje hora a hora">
        <WeatherIcon code={c.weather_code} isDay={c.is_day} size={56} />
        <span className="weather-now-text">
          <strong>{Math.round(c.temperature_2m)}°</strong>
          <small>{wmo(c.weather_code)[0]} · sensação {Math.round(c.apparent_temperature)}°</small>
        </span>
        <span className="weather-more">Hora a hora <Icon name="arrow" size={14} /></span>
      </button>
      <dl className="facts">
        <div><dt>Vento</dt><dd>{wind} km/h{wind >= 35 ? ' · ventania' : ''}</dd></div>
        <div><dt>UV hoje</dt><dd>{uv}{uv >= 8 ? ' · protetor!' : ''}</dd></div>
      </dl>
      <ul className="forecast">
        {w.daily.time.slice(0, 5).map((d, i) => (
          <li key={d}>
            <button type="button" onClick={() => setOpenDay(i)}>
              <small>{i === 0 ? 'Hoje' : new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small>
              <WeatherIcon code={w.daily.weather_code[i]} size={26} />
              <b>{Math.round(w.daily.temperature_2m_max[i])}°</b>
              <small>{Math.round(w.daily.temperature_2m_min[i])}°</small>
            </button>
          </li>
        ))}
      </ul>
      <p className="fine">Toque num dia para ver hora a hora. Cape Town venta muito no verão (o “Cape Doctor”).</p>
      <WeatherSheet w={w} open={openDay != null} startDay={openDay ?? 0} onClose={() => setOpenDay(null)} />
    </div>
  )
}

/* ---------- Internet ---------- */
/** Quantos reais vale 1 unidade de cada moeda (cotação do dia; sem internet, só o rand). */
function useBrlPer() {
  const { guide } = useApp()
  useRate('BRL', 'ZAR', { rate: 1 / guide.currency.default_fx, date: guide.currency.fx_date })
  const rates = rateCache.BRL?.rates
  return (code) => (code === 'BRL' ? 1 : rates?.[code] ? 1 / rates[code] : code === 'ZAR' ? guide.currency.default_fx : null)
}

const planId = (prov, p) => `${prov}:${p.gb ?? 'ilim'}:${p.days}:${p.price}`
const gbLabel = (p) => (p.gb == null ? 'Ilimitado' : `${String(p.gb).replace('.', ',')} GB`)
const priceLabel = (p) => `${p.cur === 'USD' ? 'US$' : 'R'} ${String(p.price).replace('.', ',')}`

function NetPlan({ prov, plan, selected, onPick, onRemove, brlPer }) {
  const rate = brlPer(plan.cur)
  return (
    <li>
      <button type="button" className={`net-plan ${selected ? 'is-on' : ''}`} onClick={onPick} aria-pressed={selected}>
        <span className="net-radio" aria-hidden />
        <span className="net-plan-main">
          <strong>{gbLabel(plan)}{plan.bonus ? <small> + {String(plan.bonus).replace('.', ',')} GB madrugada</small> : null}</strong>
          <small>{plan.days} dias{prov.custom ? ' · adicionado por você' : ''}</small>
        </span>
        <span className="net-plan-price">
          <b>{priceLabel(plan)}</b>
          {rate && plan.cur !== 'BRL' && <small>≈ R$ {Math.round(plan.price * rate)}</small>}
        </span>
      </button>
      {onRemove && <button type="button" className="link-btn net-remove" onClick={onRemove}>Remover</button>}
    </li>
  )
}

function AddPlanForm({ kind, onAdd }) {
  const [f, setF] = useState({ name: '', gb: '', days: '30', price: '', cur: kind === 'esim' ? 'USD' : 'ZAR' })
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.name.trim() && Number(f.price.replace(',', '.')) > 0
  const submit = (e) => {
    e.preventDefault()
    if (!ok) return
    onAdd({ name: f.name.trim(), kind, plan: { gb: f.gb ? Number(f.gb.replace(',', '.')) : null, days: Number(f.days) || 30, price: Number(f.price.replace(',', '.')), cur: f.cur } })
    setF({ ...f, name: '', gb: '', price: '' })
  }
  return (
    <form className="net-add" onSubmit={submit}>
      <label className="field"><span className="field-label">Operadora / app</span><input value={f.name} onChange={up('name')} placeholder="Ex.: Telkom" /></label>
      <label className="field"><span className="field-label">Dados (GB)</span><input inputMode="decimal" value={f.gb} onChange={up('gb')} placeholder="vazio = ilimitado" /></label>
      <label className="field"><span className="field-label">Validade (dias)</span><input inputMode="numeric" value={f.days} onChange={up('days')} /></label>
      <label className="field"><span className="field-label">Preço</span>
        <span className="net-price-in">
          <select value={f.cur} onChange={up('cur')} aria-label="Moeda"><option value="ZAR">R</option><option value="USD">US$</option><option value="BRL">R$</option></select>
          <input inputMode="decimal" value={f.price} onChange={up('price')} placeholder="0" />
        </span>
      </label>
      <button type="submit" className="btn btn-dark" disabled={!ok}>Adicionar opção</button>
    </form>
  )
}

function Internet() {
  const { guide, state, set } = useApp()
  const net = guide.internet
  const brlPer = useBrlPer()
  const [kind, setKind] = useState('chip')
  const custom = Array.isArray(state['net.custom']) ? state['net.custom'] : []
  const providers = [
    ...net.providers,
    ...Object.values(custom.reduce((acc, c, i) => {
      const id = `custom-${c.kind}-${c.name.toLowerCase()}`
      acc[id] ??= { id, kind: c.kind, name: c.name, custom: true, plans: [] }
      acc[id].plans.push({ ...c.plan, _i: i })
      return acc
    }, {})),
  ].filter((p) => p.kind === kind)
  const [provId, setProvId] = useState(providers[0]?.id)
  const prov = providers.find((p) => p.id === provId) || providers[0]
  const chosen = state['net.plan'] // { id, provider, label, price, cur, kind }

  const pick = (pv, p) => {
    const id = planId(pv.id, p)
    if (chosen?.id === id) { set('net.plan', null); return }
    set('net.plan', { id, provider: pv.name, kind: pv.kind, label: `${gbLabel(p)} · ${p.days} dias`, price: p.price, cur: p.cur })
    // Orçamento mensal: chip local em rand entra como custo do mês.
    if (p.cur === 'ZAR') set('field.simchoice', String(p.price))
  }
  const addCustom = (c) => {
    set('net.custom', [...custom, c])
    setProvId(`custom-${c.kind}-${c.name.toLowerCase()}`)
  }
  const removeCustom = (i) => set('net.custom', custom.filter((_, k) => k !== i))
  const changeKind = (k) => { setKind(k); setProvId(undefined) }
  const chosenRate = chosen ? brlPer(chosen.cur) : null

  return (
    <>
      {chosen && (
        <div className="net-chosen">
          <span className="mono-label">Seu plano</span>
          <strong>{chosen.provider} · {chosen.label}</strong>
          <span>{priceLabel(chosen)}{chosenRate && chosen.cur !== 'BRL' ? ` ≈ R$ ${Math.round(chosen.price * chosenRate)}` : ''}</span>
        </div>
      )}

      <div className="net-kinds" role="tablist">
        {net.kinds.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={`mode ${kind === k.id ? 'is-active' : ''}`} onClick={() => changeKind(k.id)}>
            {k.label}
          </button>
        ))}
      </div>
      <p className="muted net-hint">{net.kinds.find((k) => k.id === kind).hint}</p>

      <div className="presets net-provs">
        {providers.map((p) => (
          <button key={p.id} type="button" className={`chip ${prov?.id === p.id ? 'is-active' : ''}`} onClick={() => setProvId(p.id)}>{p.name}</button>
        ))}
      </div>

      {prov && (
        <div className="card net-card">
          <ul className="net-list">
            {prov.plans.map((p) => (
              <NetPlan key={planId(prov.id, p)} prov={prov} plan={p} brlPer={brlPer}
                selected={chosen?.id === planId(prov.id, p)} onPick={() => pick(prov, p)}
                onRemove={prov.custom ? () => removeCustom(p._i) : null} />
            ))}
          </ul>
          {prov.note && <p className="fine">{prov.note}</p>}
          {prov.url && <div className="row-links"><ExtLink href={prov.url}>Site da {prov.name}</ExtLink></div>}
        </div>
      )}

      <details className="net-add-wrap">
        <summary>Achou outra opção? Adicione aqui</summary>
        <AddPlanForm key={kind} kind={kind} onAdd={addCustom} />
      </details>

      <div className="card net-card net-checks">
        <Check k="check.esim" label="eSIM instalado antes da viagem" hint="Ativa só ao chegar na África do Sul" />
        <Check k="check.rica" label="Chip local registrado (RICA)" hint="Passaporte + endereço da residência" />
        <Check k="check.wifi" label="Wi-Fi do quarto confirmado" hint="Velocidade e cobertura" />
      </div>

      <p className="fine">
        Preços pesquisados em {net.checked} e mudam com frequência: confira no site antes de comprar.
        Valores em reais pela cotação do dia. Fontes:{' '}
        {net.sources.map((s, i) => <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></span>)}
      </p>
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
          <SectionTitle kicker="03 · Internet" title="Sempre conectada.">Compare chip local e eSIM, toque no plano que você escolheu.</SectionTitle>
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
