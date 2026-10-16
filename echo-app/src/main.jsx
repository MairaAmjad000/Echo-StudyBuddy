import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/tokens.css'
import './styles/base.css'
import './styles/print.css'
// The dark theme loads with the tokens: it only ever adds rules scoped to
// html.dark, so light mode is unaffected either way.
import './styles/dark.css'
import App from './App.jsx'
import { AppProvider } from './store/AppContext.jsx'
import { CompanionProvider } from './components/mascot/companion-context.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <CompanionProvider>
          <App />
        </CompanionProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
