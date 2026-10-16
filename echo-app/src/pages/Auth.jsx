import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Logo from '../components/brand/Logo.jsx'
import EchoMark from '../components/brand/EchoMark.jsx'
import { useApp } from '../store/AppContext.jsx'
import { api } from '../lib/api.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'

// Google's mark, drawn locally like every other icon in the project.
const GoogleMark = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58Z" />
  </svg>
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASS = 8

// Server errors arrive either as zod field messages ("body.email: ...") or as
// plain sentences (wrong password, duplicate email). Split them back to the
// field they belong to, so the message shows under that input instead of as
// one blob at the bottom of the form.
function fieldErrorFrom(err) {
  const message = err?.message || 'Could not reach the server. Please try again.'
  const zod = /^(?:body\.)?([a-z]+):\s*(.+)$/i.exec(message)
  if (zod && ['name', 'email', 'password'].includes(zod[1])) return { field: zod[1], message: zod[2] }
  if (/already exists/i.test(message)) return { field: 'email', message }
  if (err?.status === 401 && /password/i.test(message)) return { field: 'password', message }
  if (err?.status === 401 && /email/i.test(message)) return { field: 'email', message }
  return { field: '', message }
}

/** Sign up or log in. The account lives on the server; only the httpOnly session cookie is kept here. */
export default function Auth({ mode }) {
  const signup = mode === 'signup'
  useDocumentTitle(signup ? 'Create account' : 'Log in')
  const { state, actions } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  // Arriving with a reason means a session that used to be signed in expired:
  // say so instead of letting the student wonder what happened.
  const expired = location.state?.reason === 'expired'
  // Google hands its failures back here as ?authError=... so the reason is
  // read the same way a keyboard-shortcut error would be.
  const bouncedBack = params.get('authError')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState(bouncedBack || '')
  const [errorField, setErrorField] = useState('') // '' | 'name' | 'email' | 'password'
  const [busy, setBusy] = useState(false)
  // Only offered when the server has credentials for it; a button that ends in
  // "not set up" is worse than no button.
  const [googleReady, setGoogleReady] = useState(false)
  // Where to land after Google sends the browser back — the same place a
  // password login would have gone.
  const next = typeof location.state?.from === 'string' ? location.state.from : '/app'

  useEffect(() => {
    let live = true
    api
      .get('/api/auth/providers')
      .then((p) => live && setGoogleReady(Boolean(p?.google)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  if (state.signedIn) return <Navigate to="/app" replace />

  // Typing in the field that carries the error clears it.
  const edit = (field, set) => (e) => {
    set(e.target.value)
    if (errorField === field) {
      setError('')
      setErrorField('')
    }
  }
  const fail = (field, message) => {
    setErrorField(field)
    setError(message)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setErrorField('')
    const n = name.trim()
    const em = email.trim()
    if (signup && n.length < 2) return fail('name', 'Enter a name with at least two letters.')
    if (!EMAIL_RE.test(em)) {
      return fail('email', signup ? 'Enter a valid email address, like you@example.com.' : 'Enter the email you signed up with.')
    }
    if (pass.length < MIN_PASS) {
      return fail('password', signup ? `Choose a password with at least ${MIN_PASS} characters.` : 'Enter your password.')
    }
    setBusy(true)
    try {
      if (signup) await actions.signUp(n, em, pass)
      else await actions.logIn(em, pass)
      navigate('/app')
    } catch (err) {
      const f = fieldErrorFrom(err)
      fail(f.field, f.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-top"><Logo /></div>
      <form className="auth-card surface" onSubmit={submit} noValidate>
        <EchoMark size={56} />
        <h1>{signup ? 'Start with your details.' : 'Welcome back.'}</h1>
        <p className="muted">
          {signup
            ? 'Echo keeps your notes and progress on your account, safe on any device. You will get a sample course to try straight away.'
            : 'Enter the email and password you signed up with.'}
        </p>
        {expired && (
          <p className="small muted" role="status">
            Your session ended — log back in and you will land right where you were. Your notes never left.
          </p>
        )}
        {googleReady && (
          <>
            <a className="btn btn-google" href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
              <GoogleMark />
              Continue with Google
            </a>
            <p className="auth-or"><span>or use your email</span></p>
          </>
        )}
        {signup && (
          <label className="field">
            <span>Your name</span>
            <input value={name} onChange={edit('name', setName)} autoComplete="name" placeholder="Ada Lovelace" autoFocus />
            {errorField === 'name' && <span className="field-error" role="alert">{error}</span>}
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={edit('email', setEmail)}
            autoComplete={signup ? 'email' : 'username'}
            placeholder="you@example.com"
            autoFocus={signup ? undefined : true}
          />
          {errorField === 'email' && <span className="field-error" role="alert">{error}</span>}
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={pass}
            onChange={edit('password', setPass)}
            autoComplete={signup ? 'new-password' : 'current-password'}
            placeholder={signup ? `At least ${MIN_PASS} characters` : 'Your password'}
          />
          {errorField === 'password' && <span className="field-error" role="alert">{error}</span>}
        </label>
        {error && !errorField && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? (signup ? 'Creating your account...' : 'Logging you in...') : signup ? 'Create account' : 'Log in'}
        </button>
        <p className="small muted">
          {signup ? (
            <>Already have an account? <Link to="/login">Log in</Link></>
          ) : (
            <>New to Echo? <Link to="/signup">Create an account</Link></>
          )}
        </p>
      </form>
    </div>
  )
}
