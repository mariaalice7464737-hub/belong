import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useApp } from './AppContext'
import { BottomNav, TopBar } from './components/Chrome'
import Documents from './pages/Documents'
import Essentials from './pages/Essentials'
import Home from './pages/Home'
import MapPage from './pages/MapPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const { guide, error, reload } = useApp()

  // Se o backend ainda está ligando, tenta de novo sozinho a cada 3 s.
  useEffect(() => {
    if (!error) return
    const t = setInterval(reload, 3000)
    return () => clearInterval(t)
  }, [error, reload])

  if (error) {
    return (
      <div className="splash">
        <span className="kicker">Erro de conexão</span>
        <h2>Não consegui falar com o backend</h2>
        <p>Confira se a janela <b>“Cape Town - Backend”</b> está aberta e sem erro, ou rode:</p>
        <pre>cd backend{'\n'}.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000</pre>
        <p className="fine">Detalhe: {/internal server error|failed to fetch/i.test(error) ? 'o backend (porta 8000) não está respondendo' : error}. Tentando de novo sozinho…</p>
        <button className="btn btn-light" onClick={reload}>Tentar de novo</button>
      </div>
    )
  }
  if (!guide) return <div className="splash"><span className="kicker">Carregando o diário…</span></div>

  return (
    <>
      <ScrollToTop />
      <TopBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mapa" element={<MapPage />} />
        <Route path="/documentos" element={<Documents />} />
        <Route path="/essenciais" element={<Essentials />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <BottomNav />
    </>
  )
}
