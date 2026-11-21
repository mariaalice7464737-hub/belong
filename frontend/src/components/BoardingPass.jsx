import { useRef, useState } from 'react'
import { useApp } from '../AppContext'
import Icon from './Icon'

// Código de barras decorativo (sempre igual, para não "piscar" a cada render).
const BARS = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 1, 2, 2, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2]

function Barcode() {
  let x = 0
  const rects = BARS.map((w, i) => {
    const r = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w} height="34" /> : null
    x += w + 1
    return r
  })
  return (
    <svg className="pass-barcode" viewBox={`0 0 ${x} 34`} preserveAspectRatio="none" aria-hidden>
      {rects}
    </svg>
  )
}

/** Lê os dados do voo: o que foi preenchido em Documentos, senão o padrão do guide.json. */
function usePassData() {
  const { guide, state } = useApp()
  const bp = guide.boarding_pass
  const defaults = Object.fromEntries(bp.fields.map((f) => [f.key, f.default]))
  const v = (k, fallback = '—') => String(state[k] || defaults[k] || fallback).toUpperCase()
  const docs = guide.documents
  const done = docs.filter((d) => state[`check.doc.${d.id}`] ?? !!d.default_done).length
  return { bp, v, done, total: docs.length }
}

/** Um cartão de embarque de vidro fosco. leg = "out" (ida) ou "return" (volta). */
export default function BoardingPass({ leg = 'out', compact = false }) {
  const { bp, v, done, total } = usePassData()
  const home = v('pass.from', bp.from_code)
  const isOut = leg === 'out'
  const p = isOut ? 'pass.' : 'pass.return_'
  const from = isOut ? { code: home, city: home === bp.from_code ? bp.from_city : '' } : { code: bp.to_code, city: bp.to_city }
  const to = isOut ? { code: bp.to_code, city: bp.to_city } : { code: home, city: home === bp.from_code ? bp.from_city : '' }

  return (
    <div className={`pass ${compact ? 'is-compact' : ''}`}>
      <div className="pass-head">
        <span className="mono-label">{isOut ? 'Ida · outbound' : 'Volta · return'}</span>
        <span className="mono-label">{bp.airline}</span>
      </div>
      <div className="pass-route">
        <div>
          <span className="mono-label">From</span>
          <strong>{from.code}</strong>
          <small>{from.city}</small>
        </div>
        <Icon name="plane" size={30} stroke={1.3} className={`pass-plane ${isOut ? '' : 'is-return'}`} />
        <div className="pass-to">
          <span className="mono-label">To</span>
          <strong>{to.code}</strong>
          <small>{to.city}</small>
        </div>
      </div>

      <div className="pass-grid">
        <div><span className="mono-label">Flight</span><b>{v(p + 'flight')}</b></div>
        <div><span className="mono-label">Date</span><b>{v(p + 'date')}</b></div>
        <div><span className="mono-label">Departs</span><b>{v(p + 'depart')}</b></div>
        <div><span className="mono-label">Arrives</span><b>{v(p + 'arrive')}</b></div>
        <div><span className="mono-label">Seat</span><b>{v(p + 'seat')}</b></div>
        <div><span className="mono-label">Gate</span><b>{v(p + 'gate')}</b></div>
      </div>

      <div className="pass-docs">
        <span className="mono-label">Documentos</span>
        <div className="pass-meter"><div style={{ width: `${(done / total) * 100}%` }} /></div>
        <b>{String(done).padStart(2, '0')}/{total}</b>
      </div>

      {!compact && <Barcode />}
    </div>
  )
}

/** Os dois cartões (ida e volta) lado a lado: arraste para o lado ou toque nos pontos. */
export function PassCarousel({ compact = false }) {
  const track = useRef(null)
  const [idx, setIdx] = useState(0)
  const legs = ['out', 'return']

  const onScroll = () => {
    const el = track.current
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }
  const goTo = (e, i) => {
    e.preventDefault(); e.stopPropagation()
    track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="pass-carousel">
      <div className="pass-track" ref={track} onScroll={onScroll}>
        {legs.map((l) => (
          <div className="pass-slide" key={l}><BoardingPass leg={l} compact={compact} /></div>
        ))}
      </div>
      <div className="pass-dots" role="tablist" aria-label="Ida ou volta">
        {legs.map((l, i) => (
          <button key={l} type="button" role="tab" aria-selected={idx === i}
            className={`pass-dot ${idx === i ? 'is-active' : ''}`} onClick={(e) => goTo(e, i)}>
            {l === 'out' ? 'Ida' : 'Volta'}
          </button>
        ))}
      </div>
    </div>
  )
}
