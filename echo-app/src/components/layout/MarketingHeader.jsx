import Logo from '../brand/Logo.jsx'
import Button from '../ui/Button.jsx'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import { useApp } from '../../store/AppContext.jsx'
import './layout.css'

export default function MarketingHeader() {
  const { state } = useApp()
  const signedIn = state.signedIn

  return (
    <header className="wrap top">
      <Logo />
      <nav aria-label="Main">
        <a href="#features">Features</a>
        <a href="#uploads">What you can upload</a>
        <ThemeToggle className="top-theme" />
        {signedIn ? (
          <Button to="/app">Open dashboard</Button>
        ) : (
          <>
            <Button to="/login" variant="text" className="top-login">Log in</Button>
            <Button to="/signup">Upload notes</Button>
          </>
        )}
      </nav>
    </header>
  )
}
