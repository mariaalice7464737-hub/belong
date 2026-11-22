import { Link, NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../AppContext'
import Icon from './Icon'

const TITLES = { '/explore': 'Explore', '/documentos': 'Documentos', '/essenciais': 'Essenciais' }

/** Barra do topo. Transparente sobre o hero da home; sólida nas outras páginas. */
export function TopBar() {
  const { pathname } = useLocation()
  const { saveStatus } = useApp()
  const isHome = pathname === '/'
  return (
    <header className={`topbar ${isHome ? 'is-overlay' : ''}`}>
      {isHome
        ? <span className="topbar-brand"><b>belong<i>.</i></b><small>Cape Town Edition</small></span>
        : <Link to="/" className="icon-btn" aria-label="Voltar para o início"><Icon name="back" /></Link>}
      {!isHome && <span className="topbar-title">{TITLES[pathname]}</span>}
      <span className={`save-dot is-${saveStatus}`} title={saveStatus === 'saved' ? 'Salvo' : ''} />
    </header>
  )
}

const NAV = [
  { to: '/', label: 'Início', icon: 'compass', end: true },
  { to: '/explore', label: 'Explore', icon: 'sparkle' },
  { to: '/documentos', label: 'Docs', icon: 'passport' },
  { to: '/essenciais', label: 'Essenciais', icon: 'clock' },
]

/** Menu lateral flutuante (tablet e computador). */
export function SideNav() {
  return (
    <nav className="sidenav" aria-label="Navegação">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end}>
          <Icon name={n.icon} size={20} />
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

/** Barra de abas fixa embaixo (só no celular). */
export function BottomNav() {
  return (
    <nav className="bottomnav" aria-label="Navegação">
      <NavLink to="/" end><Icon name="compass" /><span>Início</span></NavLink>
      <NavLink to="/explore"><Icon name="sparkle" /><span>Explore</span></NavLink>
      <NavLink to="/documentos"><Icon name="passport" /><span>Docs</span></NavLink>
      <NavLink to="/essenciais"><Icon name="clock" /><span>Essenciais</span></NavLink>
    </nav>
  )
}
