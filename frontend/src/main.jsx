import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { STATIC } from './api'
import App from './App'
import { AppProvider } from './AppContext'
import './styles.css'

// No GitHub Pages as rotas vão depois do # (o Pages não conhece /mapa etc.).
const Router = STATIC ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <AppProvider>
        <App />
      </AppProvider>
    </Router>
  </React.StrictMode>,
)
