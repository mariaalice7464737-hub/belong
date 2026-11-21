import { Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../AppContext'
import { api } from '../api'
import { PassCarousel } from '../components/BoardingPass'
import Icon from '../components/Icon'
import { Check, Field, Kicker, SectionTitle, Sheet } from '../components/ui'

const isImage = (f) => f.content_type.startsWith('image/')

/** Visualizador em tela cheia para imagens. */
function Viewer({ file, onClose }) {
  if (!file) return null
  return createPortal(
    <div className="viewer" onClick={onClose}>
      <button className="icon-btn viewer-close" aria-label="Fechar"><Icon name="close" /></button>
      <img src={api.fileUrl(file.id)} alt={file.name} onClick={(e) => e.stopPropagation()} />
      <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
        <span>{file.name}</span>
        <a className="pill pill-light" href={api.fileUrl(file.id, true)} download={file.name}><Icon name="download" size={14} /> Baixar</a>
      </div>
    </div>,
    document.body,
  )
}

/** Conteúdo de uma categoria: checklist, anexos, upload e anotações. */
function CategorySheet({ category, onClose }) {
  const { guide, files, uploadFiles, removeFile } = useApp()
  const [busy, setBusy] = useState('')
  const [viewing, setViewing] = useState(null)
  const inputRef = useRef(null)
  const cameraRef = useRef(null)
  if (!category) return null

  const list = files.filter((f) => f.category === category.id && f.kind === 'document')
  const checklist = guide.documents.filter((d) => category.checklist.includes(d.id))

  const upload = async (fileList) => {
    if (!fileList?.length) return
    try {
      setBusy('Enviando…')
      await uploadFiles(fileList, { category: category.id })
      setBusy('')
    } catch (e) {
      setBusy(e.message)
    }
  }

  return (
    <Sheet open onClose={onClose} title={category.label} kicker="Documentos">
      <p className="muted">{category.hint}</p>

      {checklist.length > 0 && (
        <div className="sheet-group">
          {checklist.map((d) => (
            <Check key={d.id} k={`check.doc.${d.id}`} label={d.title} hint={d.description} defaultValue={!!d.default_done} />
          ))}
        </div>
      )}

      <div className="sheet-group">
        <div className="group-head">
          <span className="mono-label">Anexos · {list.length}</span>
          {list.length > 1 && (
            <a className="link-btn" href={api.categoryZipUrl(category.id)} download>Baixar todos (.zip)</a>
          )}
        </div>
        {list.length === 0 && <p className="empty">Nenhum arquivo ainda. Tire uma foto ou escolha um arquivo.</p>}
        <div className="files">
          {list.map((f) => (
            <figure key={f.id} className="file">
              {isImage(f)
                ? <button className="file-thumb" onClick={() => setViewing(f)}><img src={api.fileUrl(f.id)} alt={f.name} /></button>
                : <a className="file-thumb is-pdf" href={api.fileUrl(f.id)} target="_blank" rel="noopener noreferrer"><Icon name="file" size={28} /><span>PDF</span></a>}
              <figcaption title={f.name}>{f.name}</figcaption>
              <a className="file-dl" href={api.fileUrl(f.id, true)} download={f.name} aria-label={`Baixar ${f.name}`}>
                <Icon name="download" size={14} /> Baixar
              </a>
              <button className="file-del" aria-label={`Excluir ${f.name}`}
                onClick={() => window.confirm(`Excluir "${f.name}"?`) && removeFile(f.id)}>
                <Icon name="trash" size={15} />
              </button>
            </figure>
          ))}
        </div>
        <div className="upload-row">
          <button className="btn btn-dark" onClick={() => cameraRef.current.click()}><Icon name="camera" size={18} /> Tirar foto</button>
          <button className="btn btn-ghost" onClick={() => inputRef.current.click()}><Icon name="plus" size={18} /> Escolher arquivo</button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
          <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        </div>
        {busy && <p className="fine">{busy}</p>}
        <p className="fine">Imagens ou PDF, até 10 MB cada. Ficam salvos só no seu computador (backend/storage).</p>
      </div>

      <div className="sheet-group">
        <Field k={`note.cat.${category.id}`} label="Anotações" type="textarea" placeholder="Número do documento, validade, protocolo…" />
      </div>

      <Viewer file={viewing} onClose={() => setViewing(null)} />
    </Sheet>
  )
}

function FlightSheet({ open, onClose }) {
  const { guide } = useApp()
  return (
    <Sheet open={open} onClose={onClose} title="Dados do voo" kicker="Cartão de embarque">
      <p className="muted">Já está com os dados da passagem LATAM. Preencha só o que mudar (assento e portão saem no check-in); o que você escrever aqui substitui o padrão no cartão de embarque.</p>
      {[['out', 'Ida'], ['return', 'Volta']].map(([leg, title]) => (
        <div key={leg} className="flight-leg">
          <h3 className="mono-label">{title}</h3>
          <div className="two">
            {guide.boarding_pass.fields.filter((f) => (f.leg ?? 'out') === leg).map((f) => <Field key={f.key} k={f.key} label={f.label} placeholder={f.default ?? f.placeholder} />)}
          </div>
        </div>
      ))}
    </Sheet>
  )
}

export default function Documents() {
  const { guide, state, files } = useApp()
  const [openCat, setOpenCat] = useState(null)
  const [flightOpen, setFlightOpen] = useState(false)
  const isDone = (id) => {
    const d = guide.documents.find((x) => x.id === id)
    return state[`check.doc.${id}`] ?? !!d?.default_done
  }

  return (
    <main className="page docs-page">
      <section className="docs-hero">
        <Kicker light>Chapter two · boarding</Kicker>
        <h1>Seus <em>documentos,</em><br />num só lugar.</h1>
        <div className="docs-pass">
          <PassCarousel compact />
          <button className="pill pill-light" onClick={() => setFlightOpen(true)}><Icon name="edit" size={14} /> Editar dados do voo</button>
        </div>
      </section>

      <div className="page-body">
        <section className="block">
          <SectionTitle kicker="01 · Pastas" title="Toque para abrir.">
            Cada ícone guarda as fotos e PDFs daquele documento, junto com o checklist.
          </SectionTitle>
          <div className="doc-icons">
            {guide.doc_categories.map((c) => {
              const count = files.filter((f) => f.category === c.id && f.kind === 'document').length
              const ok = c.checklist.every(isDone)
              return (
                <button key={c.id} className={`doc-icon ${ok ? 'is-ok' : ''}`} onClick={() => setOpenCat(c)}>
                  <span className="doc-icon-art"><Icon name={c.icon} size={30} stroke={1.3} /></span>
                  <strong>{c.label}</strong>
                  <small>{count ? `${count} anexo${count > 1 ? 's' : ''}` : 'Sem anexos'}</small>
                  <span className={`status-dot ${ok ? 'is-ok' : ''}`} aria-label={ok ? 'Concluído' : 'Pendente'} />
                </button>
              )
            })}
          </div>
        </section>

        <Link to="/essenciais" className="card ess-link">
          <span className="sos-icon"><Icon name="phone" size={18} /></span>
          <span><strong>Números de emergência</strong><small>Agora ficam em Essenciais, junto com câmbio, clima e horário.</small></span>
          <Icon name="arrow" size={18} />
        </Link>

        <section className="block">
          <SectionTitle kicker="02 · Backup" title="Não perca nada.">
            Baixe um .zip com todos os anexos e o que você preencheu. Guarde num lugar protegido.
          </SectionTitle>
          <BackupButtons />
        </section>
      </div>

      <CategorySheet category={openCat} onClose={() => setOpenCat(null)} />
      <FlightSheet open={flightOpen} onClose={() => setFlightOpen(false)} />
    </main>
  )
}

function BackupButtons() {
  const { restoreBackup } = useApp()
  const ref = useRef(null)
  const [msg, setMsg] = useState('')
  const onImport = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file || !window.confirm('Importar backup? Isso substitui tudo o que está salvo agora.')) return
    try {
      const r = await restoreBackup(file)
      setMsg(`Backup restaurado: ${r.keys} campos e ${r.files} anexos.`)
    } catch (err) { setMsg(err.message) }
  }
  return (
    <>
      <div className="row-links">
        <a className="btn btn-dark" href={api.backupUrl}>Exportar backup (.zip)</a>
        <button className="btn btn-ghost" onClick={() => ref.current.click()}>Importar backup</button>
        <input ref={ref} type="file" accept=".zip,application/zip" hidden onChange={onImport} />
      </div>
      {msg && <p className="fine">{msg}</p>}
    </>
  )
}
