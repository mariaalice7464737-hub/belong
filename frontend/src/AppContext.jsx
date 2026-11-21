import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const SAVE_DELAY_MS = 400

export function AppProvider({ children }) {
  const [guide, setGuide] = useState(null)
  const [state, setState] = useState({})
  const [budget, setBudget] = useState(null)
  const [files, setFiles] = useState([])
  const [error, setError] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error

  const pending = useRef({})
  const timer = useRef(null)

  const loadAll = useCallback(async () => {
    try {
      const [g, s, b, f] = await Promise.all([api.guide(), api.state(), api.budget(), api.files()])
      setGuide(g); setState(s); setBudget(b); setFiles(f); setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const flush = useCallback(async () => {
    const changes = pending.current
    pending.current = {}
    setSaveStatus('saving')
    try {
      await api.patchState(changes)
      setBudget(await api.budget())
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [])

  /** Atualiza uma chave na hora e salva no backend com debounce. */
  const set = useCallback((key, value) => {
    const v = value === '' ? null : value
    setState((s) => {
      const next = { ...s }
      if (v === null) delete next[key]; else next[key] = v
      return next
    })
    pending.current[key] = v
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY_MS)
  }, [flush])

  const refreshFiles = useCallback(async () => setFiles(await api.files()), [])

  const uploadFiles = useCallback(async (list, options) => {
    await api.uploadFiles(list, options)
    await refreshFiles()
  }, [refreshFiles])

  const removeFile = useCallback(async (id) => {
    await api.deleteFile(id)
    await refreshFiles()
  }, [refreshFiles])

  const restoreBackup = useCallback(async (file) => {
    const result = await api.restoreBackup(file)
    await loadAll()
    return result
  }, [loadAll])

  const fx = Number(state.fx) || guide?.currency.default_fx || 0.34

  const value = {
    guide, state, budget, files, error, saveStatus, fx,
    set, uploadFiles, removeFile, restoreBackup, reload: loadAll,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
