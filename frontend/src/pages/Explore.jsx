import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { exploreApi, exploreConfigured } from '../api.explore'
import ExperienceCard from '../components/ExperienceCard'
import Icon from '../components/Icon'
import { Kicker } from '../components/ui'

// Categorias de reserva (as oficiais vêm de GET /api/explore/categories).
const FALLBACK_CATEGORIES = [
  { id: 'music-night', label: 'Música e noite', icon: 'music' },
  { id: 'movement', label: 'Movimento e bem-estar', icon: 'dumbbell' },
  { id: 'sports-adventure', label: 'Esportes e aventuras', icon: 'compass' },
  { id: 'arts-culture', label: 'Arte e cultura', icon: 'frame' },
  { id: 'food-community', label: 'Gastronomia e comunidade', icon: 'fork' },
]
const NEIGHBORHOODS = ['Sea Point', 'Green Point', 'De Waterkant', 'V&A Waterfront', 'City Bowl', 'Bo-Kaap', 'Gardens',
  'Woodstock', 'Observatory', 'Camps Bay', 'Clifton', 'Hout Bay', 'Newlands', 'Constantia', 'Muizenberg', 'Kalk Bay']
const EXAMPLES = ['Festa de afro house sábado perto de Sea Point', 'Yoga ao ar livre no fim de semana', 'Mercado com comida boa no sábado',
  'Algo grátis para fazer hoje']
const EMPTY_FILTERS = { date: '', date_from: '', neighborhood: '', max_distance_km: '', price: '', outdoor: false }
const PAGE_SIZE = 12

function buildBody(q, category, filters, loc, page) {
  const f = {}
  if (filters.date === 'custom' && filters.date_from) Object.assign(f, { date: 'custom', date_from: filters.date_from })
  else if (filters.date && filters.date !== 'custom') f.date = filters.date
  if (filters.neighborhood) f.neighborhood = filters.neighborhood
  if (filters.max_distance_km && loc) f.max_distance_km = Number(filters.max_distance_km)
  if (filters.price) f.price = filters.price
  if (filters.outdoor) f.outdoor = true
  if (category) f.category = category
  return { q, filters: f, page, page_size: PAGE_SIZE, ...(loc ? { lat: loc.lat, lon: loc.lon } : {}) }
}

function IntentChips({ intent, categories }) {
  if (!intent?.text) return null
  const cat = categories.find((c) => c.id === intent.category)
  const chips = [
    intent.activity && intent.activity,
    cat && cat.label,
    intent.date_label && (intent.date_from === intent.date_to || !intent.date_to
      ? `${intent.date_label} · ${new Date(intent.date_from + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
      : intent.date_label),
    intent.neighborhood && `perto de ${intent.neighborhood}`,
    intent.price && { free: 'grátis', budget: 'barato', mid: 'preço médio', premium: 'sofisticado' }[intent.price],
    intent.outdoor === true && 'ao ar livre',
    intent.social === 'social' && 'para conhecer gente',
  ].filter(Boolean)
  if (!chips.length) return null
  return (
    <p className="x-intent">
      <span>Entendi:</span>
      {chips.map((c) => <b key={c}>{c}</b>)}
    </p>
  )
}

function Sources({ providers }) {
  if (!providers?.length) return null
  return (
    <p className="x-sources" aria-label="Fontes consultadas">
      <span>Fontes</span>
      {providers.map((p) => (
        <span key={p.id} className={`x-src ${!p.enabled ? 'is-off' : p.ok === false ? 'is-err' : 'is-on'}`}
          title={p.reason || p.error || ''}>
          <i aria-hidden /> {p.name}
          {p.enabled ? (p.ok === false ? ' · erro' : p.count != null ? ` · ${p.count}` : '') : ' · sem chave'}
        </span>
      ))}
    </p>
  )
}

function Skeletons() {
  return (
    <div className="x-grid" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="xcard is-skeleton"><div className="xcard-media" /><div className="xcard-body"><span /><span /><span /></div></div>
      ))}
    </div>
  )
}

export default function Explore() {
  const { state, set } = useApp()
  const saved = useMemo(() => (Array.isArray(state['explore.favorites']) ? state['explore.favorites'] : []), [state])
  const savedIds = useMemo(() => new Set(saved.map((e) => e.id)), [saved])

  const [categories, setCategories] = useState(FALLBACK_CATEGORIES)
  const [q, setQ] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [category, setCategory] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loc, setLoc] = useState(null)
  const [locStatus, setLocStatus] = useState('idle')
  const [tab, setTab] = useState('results')

  const [status, setStatus] = useState(exploreConfigured ? 'loading' : 'unconfigured') // loading | ready | error | unconfigured
  const [error, setError] = useState(null)
  const [data, setData] = useState(null) // última resposta
  const [items, setItems] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [slow, setSlow] = useState(false)
  const reqRef = useRef(null)

  useEffect(() => {
    if (!exploreConfigured) return
    exploreApi.categories().then(setCategories).catch(() => {})
  }, [])

  const run = useCallback(async (page = 1) => {
    if (!exploreConfigured) return
    reqRef.current?.abort()
    const ctrl = new AbortController()
    reqRef.current = ctrl
    page === 1 ? setStatus('loading') : setLoadingMore(true)
    setError(null)
    const slowTimer = setTimeout(() => setSlow(true), 6000)
    try {
      const res = await exploreApi.search(buildBody(submitted, category, filters, loc, page), { signal: ctrl.signal })
      setData(res)
      setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items.filter((i) => !prev.some((p) => p.id === i.id))]))
      setStatus('ready')
    } catch (e) {
      if (ctrl.signal.aborted && e.kind === undefined) return
      setError(e)
      setStatus(e.kind === 'unconfigured' ? 'unconfigured' : 'error')
    } finally {
      clearTimeout(slowTimer)
      setSlow(false)
      setLoadingMore(false)
    }
  }, [submitted, category, filters, loc])

  useEffect(() => { run(1) }, [run])

  const submit = (e) => { e.preventDefault(); setTab('results'); setSubmitted(q.trim()) }
  const useExample = (ex) => { setQ(ex); setSubmitted(ex); setTab('results') }
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }))
  const clearAll = () => { setFilters(EMPTY_FILTERS); setCategory(''); setQ(''); setSubmitted('') }
  const hasFilters = category || Object.entries(filters).some(([k, v]) => v && EMPTY_FILTERS[k] !== v)

  const toggleSave = (e) => {
    const next = savedIds.has(e.id) ? saved.filter((s) => s.id !== e.id) : [{ ...e, score: null }, ...saved]
    set('explore.favorites', next)
  }

  const locate = () => {
    if (!('geolocation' in navigator)) { setLocStatus('denied'); return }
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lon: p.coords.longitude }); setLocStatus('ok') },
      () => setLocStatus('denied'),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }

  const shown = tab === 'saved' ? saved : items

  return (
    <main className="page explore-page">
      <section className="x-hero">
        <div className="x-hero-inner">
          <Kicker light>Explore · Cape Town</Kicker>
          <h1>Explore</h1>
          <p className="x-sub">Find your place in the city.</p>
          <form className="x-search" onSubmit={submit} role="search">
            <Icon name="search" size={20} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="O que você quer viver? Ex.: yoga ao ar livre no sábado"
              aria-label="Buscar experiências" enterKeyHint="search" />
            <button type="submit" className="x-go" disabled={status === 'unconfigured'}>Buscar</button>
          </form>
          <div className="x-examples">
            {EXAMPLES.map((ex) => <button key={ex} type="button" onClick={() => useExample(ex)}>{ex}</button>)}
          </div>
        </div>
      </section>

      <div className="x-body">
        <div className="x-cats" role="tablist" aria-label="Categorias">
          <button type="button" role="tab" aria-selected={!category} className={`x-cat ${!category ? 'is-on' : ''}`} onClick={() => setCategory('')}>
            <Icon name="sparkle" size={16} /> Tudo
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={`x-cat ${category === c.id ? 'is-on' : ''}`}
              onClick={() => setCategory(category === c.id ? '' : c.id)}>
              <Icon name={c.icon} size={16} /> {c.label}
            </button>
          ))}
        </div>

        <div className="x-filters">
          <label className="x-f">
            <span>Data</span>
            <select value={filters.date} onChange={(e) => setF('date', e.target.value)}>
              <option value="">Qualquer data</option>
              <option value="today">Hoje</option>
              <option value="tomorrow">Amanhã</option>
              <option value="weekend">Fim de semana</option>
              <option value="week">Próximos 7 dias</option>
              <option value="custom">Escolher dia…</option>
            </select>
          </label>
          {filters.date === 'custom' && (
            <label className="x-f">
              <span>Dia</span>
              <input type="date" value={filters.date_from} onChange={(e) => setF('date_from', e.target.value)} />
            </label>
          )}
          <label className="x-f">
            <span>Bairro</span>
            <select value={filters.neighborhood} onChange={(e) => setF('neighborhood', e.target.value)}>
              <option value="">Toda a cidade</option>
              {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="x-f">
            <span>Distância</span>
            <select value={filters.max_distance_km} onChange={(e) => setF('max_distance_km', e.target.value)} disabled={!loc}
              title={!loc ? 'Use sua localização para filtrar por distância' : undefined}>
              <option value="">{loc ? 'Qualquer' : 'Precisa da localização'}</option>
              {[1, 3, 5, 10].map((k) => <option key={k} value={k}>Até {k} km</option>)}
            </select>
          </label>
          <label className="x-f">
            <span>Preço</span>
            <select value={filters.price} onChange={(e) => setF('price', e.target.value)}>
              <option value="">Qualquer preço</option>
              <option value="free">Grátis</option>
              <option value="budget">Até R 200</option>
              <option value="mid">Até R 500</option>
              <option value="premium">Acima de R 500</option>
            </select>
          </label>
          <label className="x-toggle">
            <input type="checkbox" checked={filters.outdoor} onChange={(e) => setF('outdoor', e.target.checked)} />
            <span>Ao ar livre</span>
          </label>
          <button type="button" className={`x-loc ${locStatus === 'ok' ? 'is-on' : ''}`} onClick={locate} disabled={locStatus === 'asking'}>
            <Icon name="locate" size={16} />
            {locStatus === 'ok' ? 'Usando sua localização' : locStatus === 'asking' ? 'Localizando…' : locStatus === 'denied' ? 'Sem permissão' : 'Usar minha localização'}
          </button>
          {hasFilters && <button type="button" className="link-btn x-clear" onClick={clearAll}>Limpar tudo</button>}
        </div>

        <div className="x-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'results'} className={tab === 'results' ? 'is-on' : ''} onClick={() => setTab('results')}>
            Resultados{status === 'ready' && data ? ` · ${data.total}` : ''}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? 'is-on' : ''} onClick={() => setTab('saved')}>
            <Icon name="star" size={14} /> Salvos · {saved.length}
          </button>
        </div>

        {tab === 'results' && status === 'ready' && (
          <div className="x-context">
            <IntentChips intent={data?.intent} categories={categories} />
            <Sources providers={data?.providers} />
            {data?.warnings?.filter((w) => !w.startsWith('Nenhuma')).map((w) => <p key={w} className="x-warn">{w}</p>)}
          </div>
        )}

        {tab === 'results' && status === 'unconfigured' && (
          <div className="x-state">
            <Icon name="sparkle" size={28} />
            <h2>O Explore está quase pronto</h2>
            <p>As buscas são feitas por um servidor próprio, que ainda não foi publicado. Quando ele estiver no ar, as experiências aparecem aqui.</p>
            <p className="fine">Para quem configura: defina <code>VITE_EXPLORE_API_URL</code> com o endereço do backend (veja o README).</p>
          </div>
        )}

        {tab === 'results' && status === 'error' && (
          <div className="x-state is-error" role="alert">
            <Icon name="alert" size={28} />
            <h2>{error?.kind === 'timeout' ? 'O servidor demorou para responder' : 'Não consegui buscar agora'}</h2>
            <p>{error?.message} {error?.kind !== 'server' && 'Se o servidor estava parado, ele leva até um minuto para acordar.'}</p>
            <button type="button" className="btn btn-dark" onClick={() => run(1)}>Tentar de novo</button>
          </div>
        )}

        {tab === 'results' && status === 'loading' && (
          <>
            {slow && <p className="x-slow">Acordando o servidor… a primeira busca do dia pode levar até um minuto.</p>}
            <Skeletons />
          </>
        )}

        {status !== 'loading' && (tab === 'saved' || status === 'ready') && shown.length > 0 && (
          <div className="x-grid">
            {shown.map((e) => (
              <ExperienceCard key={e.id} e={e} categories={categories} saved={savedIds.has(e.id)} onToggleSave={toggleSave} />
            ))}
          </div>
        )}

        {tab === 'results' && status === 'ready' && items.length === 0 && (
          <div className="x-state">
            <Icon name="search" size={28} />
            <h2>Nada encontrado {submitted ? `para “${submitted}”` : 'com esses filtros'}</h2>
            <p>Tente ampliar a busca:</p>
            <div className="x-suggest">
              {filters.date && <button type="button" onClick={() => setF('date', '')}>Qualquer data</button>}
              {filters.neighborhood && <button type="button" onClick={() => setF('neighborhood', '')}>Toda a cidade</button>}
              {filters.max_distance_km && <button type="button" onClick={() => setF('max_distance_km', '')}>Sem limite de distância</button>}
              {filters.price && <button type="button" onClick={() => setF('price', '')}>Qualquer preço</button>}
              {filters.outdoor && <button type="button" onClick={() => setF('outdoor', false)}>Também lugares fechados</button>}
              {category && <button type="button" onClick={() => setCategory('')}>Todas as categorias</button>}
              {submitted && <button type="button" onClick={() => { setQ(''); setSubmitted('') }}>Ver tudo</button>}
              {!hasFilters && !submitted && EXAMPLES.slice(0, 2).map((ex) => <button key={ex} type="button" onClick={() => useExample(ex)}>{ex}</button>)}
            </div>
            {data?.providers?.some((p) => !p.enabled) && (
              <p className="fine">Algumas fontes ainda estão desligadas, então a busca usa só as experiências verificadas pelo Belong.</p>
            )}
          </div>
        )}

        {tab === 'saved' && saved.length === 0 && (
          <div className="x-state">
            <Icon name="star" size={28} />
            <h2>Nada salvo ainda</h2>
            <p>Toque na estrela de uma experiência para guardar aqui. Os salvos ficam neste aparelho.</p>
          </div>
        )}

        {tab === 'results' && status === 'ready' && data?.has_more && (
          <div className="x-more">
            <button type="button" className="btn btn-dark" onClick={() => run((data.page || 1) + 1)} disabled={loadingMore}>
              {loadingMore ? 'Carregando…' : 'Ver mais'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
