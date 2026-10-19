import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppShell from './components/layout/AppShell.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import ToastHost from './components/ui/ToastHost.jsx'
import BootSplash from './components/mascot/BootSplash.jsx'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LearningMap from './pages/LearningMap.jsx'
import UploadMaterial from './pages/UploadMaterial.jsx'
import SmartNotes from './pages/SmartNotes.jsx'
import Flashcards from './pages/Flashcards.jsx'
import QuizArena from './pages/QuizArena.jsx'
import TeachEcho from './pages/TeachEcho.jsx'
import ChatEcho from './pages/ChatEcho.jsx'
import Whiteboard from './pages/Whiteboard.jsx'
import Podcast from './pages/Podcast.jsx'
import Performance from './pages/Performance.jsx'
import Achievements from './pages/Achievements.jsx'
import Settings from './pages/Settings.jsx'
import NotFound from './pages/NotFound.jsx'
import { useApp, sawApp } from './store/AppContext.jsx'

/**
 * The app pages need a signed-in account. The boot splash plays first: Echo
 * sleeps in the center of the page below "Waking Echo up...", wakes with a
 * splash, and only then does the screen move on — the app when the session is
 * good, the login page when nobody is signed in. If the server cannot be
 * reached at all, offer a retry instead of sending a signed-in student to the
 * login page over a hiccup.
 */
function RequireAccount({ children }) {
  const { state, booting, bootError } = useApp()
  const location = useLocation()
  const [splashDone, setSplashDone] = useState(false)
  if (state.signedIn && splashDone) return children
  if (booting || !splashDone) {
    return <BootSplash ready={!booting} onDone={() => setSplashDone(true)} />
  }
  if (bootError) {
    return (
      <div className="wrap empty surface" style={{ marginTop: 64 }}>
        <div>
          <h3 style={{ fontSize: '2rem' }}>We cannot reach the server.</h3>
          <p className="muted">Your notes and progress are safe. Check that the backend is running, then try again.</p>
          <div className="empty-action">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
  // Nobody is signed in. A returning student is told their session ended; a
  // first-time visitor just sees the welcome.
  return <Navigate to="/signup" replace state={{ from: location.pathname, reason: sawApp() ? 'expired' : undefined }} />
}

// The wake splash plays once per real page load. Refreshing the front page
// greets you with Echo waking up, while hopping back here through a link
// goes straight to the page — module state resets only on a true reload.
let landingSplashDone = false

/** The landing page gets the same splash as the app: a refresh of the front
 * page wakes Echo first instead of cutting straight to the marketing page.
 * The splash always finishes before the page takes over, and the page works
 * whether or not the server answered the boot check. */
function LandingWithSplash() {
  const { booting } = useApp()
  const [splashDone, setSplashDone] = useState(landingSplashDone)
  if (splashDone) return <Landing />
  return (
    <BootSplash
      ready={!booting}
      onDone={() => {
        landingSplashDone = true
        setSplashDone(true)
      }}
    />
  )
}

/** Echo is the companion: a live avatar that reads the route and the user's
 * actions and changes its face and pose to match. Every page renders it
 * through <Companion />, which also owns the speech notes. */
import { Companion } from './components/mascot/companion.jsx'

function RouteGuide() {
  const { pathname } = useLocation()
  return <Companion route={pathname} />
}

function ScrollToTop() {
  const { pathname } = useLocation()
  // Block body: this effect must return nothing. A concise body would return
  // window.scrollTo()'s value, and React calls effect results on cleanup
  // (`destroy is not a function` if it is not a function).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (      <ErrorBoundary>
      <ScrollToTop />
      <RouteGuide />
      <Routes>
        <Route path="/" element={<LandingWithSplash />} />
        <Route path="/signup" element={<Auth mode="signup" />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/app" element={<RequireAccount><AppShell /></RequireAccount>}>
          <Route index element={<Dashboard />} />
          <Route path="map" element={<LearningMap />} />
          <Route path="materials" element={<UploadMaterial />} />
          <Route path="notes" element={<SmartNotes />} />
          <Route path="flashcards" element={<Flashcards />} />
          <Route path="quiz" element={<QuizArena />} />
          <Route path="teach" element={<TeachEcho />} />
          <Route path="chat" element={<ChatEcho />} />
          <Route path="whiteboard" element={<Whiteboard />} />
          <Route path="podcast" element={<Podcast />} />
          <Route path="performance" element={<Performance />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastHost />
    </ErrorBoundary>
  )
}
