// Com backend Python (start.bat) usa a API; no GitHub Pages (VITE_STATIC=1) salva no navegador.
import { api as server } from './api.server'
import { api as local } from './api.local'

export const STATIC = !!import.meta.env.VITE_STATIC
export const api = STATIC ? local : server
