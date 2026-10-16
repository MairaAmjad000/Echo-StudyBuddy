import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Logo from '../brand/Logo.jsx'
import Sidebar from './Sidebar.jsx'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import ToastHost from '../ui/ToastHost.jsx'
import ErrorBoundary from '../ui/ErrorBoundary.jsx'
import './layout.css'

export default function AppShell() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  // Close the drawer after navigating, and start each page at the top.
  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="shell">
      <header className="shell-bar">
        <Logo to="/app" />
        {/* The top bar only exists on phones. The light/dark switch lives here
            as well, so it is one of the bar's controls instead of a button
            floating on its own above whatever the page happens to start with
            (the dashboard hides its own copy of it at this width). */}
        <div className="shell-bar-actions">
          <ThemeToggle />
          <button type="button" className="btn btn-quiet" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </header>

      <aside id="sidebar" className={`sidebar${open ? ' is-open' : ''}`}>
        <Sidebar />
      </aside>

      {/* Chat with Echo is a two-column workspace: it gets the wider canvas so
          the history rail never squeezes the conversation. */}
      <main className={`shell-main${pathname === '/app/chat' ? ' shell-main-wide' : ''}`} id="main">
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <ToastHost />
    </div>
  )
}
