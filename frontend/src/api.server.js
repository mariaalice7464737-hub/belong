// Todas as chamadas ao backend Python ficam aqui.
const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, options)
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail || detail } catch { /* sem corpo JSON */ }
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  guide: () => request('/guide'),
  state: () => request('/state'),
  patchState: (changes) =>
    request('/state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    }),
  budget: () => request('/budget'),

  files: () => request('/files'),
  uploadFiles: (files, { kind = 'document', category = 'outros' } = {}) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('kind', kind)
    fd.append('category', category)
    return request('/files', { method: 'POST', body: fd })
  },
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),
  fileUrl: (id, download = false) => `${BASE}/files/${id}${download ? '?download=true' : ''}`,

  categoryZipUrl: (category) => `${BASE}/files/zip?category=${encodeURIComponent(category)}`,

  backupUrl: `${BASE}/backup`,
  restoreBackup: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('/backup', { method: 'POST', body: fd })
  },
}
