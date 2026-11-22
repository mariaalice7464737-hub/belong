// Cliente do Explore. O endereço do backend vem de VITE_EXPLORE_API_URL (ex.: https://belong-explore.onrender.com).
// Em desenvolvimento local, sem essa variável, usa /api/explore pelo proxy do Vite (backend na porta 8000).
// No GitHub Pages sem a variável, o Explore avisa que o servidor ainda não foi configurado.
const ENV_URL = (import.meta.env.VITE_EXPLORE_API_URL || '').replace(/\/+$/, '')
const STATIC = !!import.meta.env.VITE_STATIC

export const EXPLORE_ORIGIN = ENV_URL                     // '' = mesmo endereço do site (proxy local)
export const EXPLORE_BASE = ENV_URL ? `${ENV_URL}/api/explore` : STATIC ? null : '/api/explore'
export const exploreConfigured = !!EXPLORE_BASE

export class ExploreError extends Error {
  constructor(message, kind = 'server') {
    super(message)
    this.kind = kind // 'unconfigured' | 'network' | 'server' | 'timeout'
  }
}

async function request(path, { method = 'GET', body, signal, timeout = 70000 } = {}) {
  if (!EXPLORE_BASE) throw new ExploreError('O servidor do Explore ainda não foi configurado.', 'unconfigured')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort('timeout'), timeout)
  signal?.addEventListener('abort', () => ctrl.abort('cancel'))
  let res
  try {
    res = await fetch(EXPLORE_BASE + path, {
      method,
      signal: ctrl.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    if (ctrl.signal.reason === 'cancel') throw e
    if (ctrl.signal.reason === 'timeout') throw new ExploreError('O servidor demorou demais para responder.', 'timeout')
    throw new ExploreError('Não consegui falar com o servidor do Explore.', 'network')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let detail = `Erro ${res.status}`
    try {
      const j = await res.json()
      detail = typeof j.detail === 'string' ? j.detail : detail
    } catch { /* sem corpo JSON */ }
    throw new ExploreError(detail, 'server')
  }
  return res.status === 204 ? null : res.json()
}

export const exploreApi = {
  health: (opts) => request('/health', opts),
  categories: (opts) => request('/categories', opts),
  search: (body, opts) => request('/search', { method: 'POST', body, ...opts }),
  experience: (id, opts) => request(`/experiences/${encodeURIComponent(id)}`, opts),
}

/** Fotos do Google passam pelo backend (a chave nunca vai para o site). */
export const imageUrl = (src) => (src && src.startsWith('/api/') ? `${EXPLORE_ORIGIN}${src}` : src)
