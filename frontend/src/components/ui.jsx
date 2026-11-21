import { useEffect } from 'react'
import { useApp } from '../AppContext'
import Icon from './Icon'

/** Campo ligado a uma chave do estado salvo no backend. */
export function Field({ k, label, type = 'text', placeholder, rows = 3, dark = false }) {
  const { state, set } = useApp()
  const value = state[k] ?? ''
  const onChange = (e) => set(k, e.target.value)
  return (
    <label className={`field ${dark ? 'field-dark' : ''}`}>
      <span className="field-label">{label}</span>
      {type === 'textarea'
        ? <textarea value={value} placeholder={placeholder} rows={rows} onChange={onChange} />
        : <input type={type} value={value} placeholder={placeholder} onChange={onChange} />}
    </label>
  )
}

export function Check({ k, label, hint, defaultValue = false }) {
  const { state, set } = useApp()
  const checked = state[k] ?? defaultValue
  return (
    <label className={`check ${checked ? 'is-done' : ''}`}>
      <input type="checkbox" checked={!!checked} onChange={(e) => set(k, e.target.checked)} />
      <span className="check-box" aria-hidden>{checked && <Icon name="check" size={14} stroke={2.4} />}</span>
      <span className="check-text">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

export function Kicker({ children, light }) {
  return <span className={`kicker ${light ? 'kicker-light' : ''}`}>{children}</span>
}

export function SectionTitle({ kicker, title, children, light }) {
  return (
    <header className={`section-title ${light ? 'is-light' : ''}`}>
      <Kicker light={light}>{kicker}</Kicker>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </header>
  )
}

/** Painel que sobe de baixo no celular (modal centrado no desktop). */
export function Sheet({ open, onClose, title, kicker, children, glass = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={`sheet-backdrop ${glass ? 'is-glass' : ''}`} onClick={onClose}>
      <div className={`sheet ${glass ? 'is-glass' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <header className="sheet-head">
          <div>
            {kicker && <Kicker>{kicker}</Kicker>}
            <h3>{title}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function ExtLink({ href, children, className = 'pill' }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children} <Icon name="external" size={13} stroke={1.8} />
    </a>
  )
}
