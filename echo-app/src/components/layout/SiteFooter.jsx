import { Link } from 'react-router-dom'
import './layout.css'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span>Echo, {new Date().getFullYear()}</span>
        <nav aria-label="Footer">
          <Link to="/login">Log in</Link>
          <Link to="/signup">Create account</Link>
          <a href="#features">Features</a>
        </nav>
      </div>
    </footer>
  )
}
