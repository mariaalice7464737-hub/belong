import { Link, NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../AppContext'
import Icon from './Icon'

const TITLES = { '/mapa': 'O mapa', '/documentos': 'Documentos', '/essenciais': 'Essenciais' }

/** Barra do topo. Transparente sobre o hero da home; sólida nas outras páginas. */
export function TopBar() {
  const { pathname } = useLocation()
  const { saveStatus } = useApp()
  const isHome = pathname === '/'
  return (
    <header className={`topbar ${isHome ? 'is-overlay' : ''}`}>
      {isHome
        ? <span className="topbar-brand">CT<i>·</i>editorial</span>
        : <Link to="/" className="icon-btn" aria-label="Voltar para o início"><Icon name="back" /></Link>}
      {!isHome && <span className="topbar-title">{TITLES[pathname]}</span>}
      <span className={`save-dot is-${saveStatus}`} title={saveStatus === 'saved' ? 'Salvo' : ''} />
      <nav className="topbar-links">
        <NavLink to="/" end>Início</NavLink>
        <NavLink to="/mapa">Mapa</NavLink>
        <NavLink to="/documentos">Documentos</NavLink>
        <NavLink to="/essenciais">Essenciais</NavLink>
      </nav>
    </header>
  )
}

/** Barra de abas fixa embaixo (só no celular). */
export function BottomNav() {
  return (
    <nav className="bottomnav" aria-label="Navegação">
      <NavLink to="/" end><Icon name="compass" /><span>Início</span></NavLink>
      <NavLink to="/mapa"><Icon name="map" /><span>Mapa</span></NavLink>
      <NavLink to="/documentos"><Icon name="passport" /><span>Docs</span></NavLink>
      <NavLink to="/essenciais"><Icon name="clock" /><span>Essenciais</span></NavLink>
    </nav>
  )
}
