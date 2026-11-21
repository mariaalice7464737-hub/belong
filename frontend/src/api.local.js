// Versão "sem backend" (GitHub Pages): tudo fica salvo no próprio navegador.
// Campos preenchidos → localStorage. Anexos → IndexedDB.
import guide from '../../backend/app/data/guide.json'

const STATE_KEY = 'ct.state'
const DB_NAME = 'ct-files'
const urls = new Map() // id → blob URL (para <img> e downloads)

const readState = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {} } catch { return {} } }
const writeState = (s) => { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)) } catch { /* sem espaço */ } }

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function tx(mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction('files', mode)
    const out = fn(t.objectStore('files'))
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
  })
}
const allFiles = async () => (await tx('readonly', (s) => s.getAll())) || []
const meta = ({ blob, ...m }) => m

export const api = {
  guide: async () => guide,
  state: async () => readState(),
  patchState: async (changes) => {
    const s = readState()
    for (const [k, v] of Object.entries(changes)) { if (v === null) delete s[k]; else s[k] = v }
    writeState(s)
    return s
  },
  budget: async () => ({}),

  files: async () => {
    const list = await allFiles()
    for (const f of list) if (!urls.has(f.id)) urls.set(f.id, URL.createObjectURL(f.blob))
    return list.map(meta).sort((a, b) => b.created_at - a.created_at)
  },
  uploadFiles: async (list, { kind = 'document', category = 'outros' } = {}) => {
    const saved = []
    for (const f of list) {
      const rec = { id: crypto.randomUUID(), name: f.name, content_type: f.type || 'application/octet-stream', kind, category, size: f.size, created_at: Date.now() / 1000, blob: f }
      await tx('readwrite', (s) => s.put(rec))
      saved.push(meta(rec))
    }
    return saved
  },
  deleteFile: async (id) => {
    await tx('readwrite', (s) => s.delete(id))
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id) }
    return null
  },
  fileUrl: (id) => urls.get(id) || '#',
  categoryZipUrl: null, // sem backend não há .zip por pasta

  // Backup: um .json com os campos e os anexos (em base64).
  backupUrl: '#backup',
  exportBackup: async () => {
    const files = await Promise.all((await allFiles()).map(async (f) => ({
      ...meta(f),
      data: await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f.blob) }),
    })))
    const blob = new Blob([JSON.stringify({ state: readState(), files })], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'cape-town-backup.json' })
    a.click()
  },
  restoreBackup: async (file) => {
    const data = JSON.parse(await file.text())
    if (!data || typeof data.state !== 'object') throw new Error('Esse arquivo não é um backup do app.')
    writeState(data.state)
    await tx('readwrite', (s) => s.clear())
    for (const f of data.files || []) {
      const blob = await (await fetch(f.data)).blob()
      const { data: _, ...m } = f
      await tx('readwrite', (s) => s.put({ ...m, blob }))
    }
    return { keys: Object.keys(data.state).length, files: (data.files || []).length }
  },
}
