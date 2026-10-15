import { Link } from 'react-router-dom'
import './brand.css'

/**
 * The brand lockup for the navbar and the sidebar: the Echo image mark from
 * /public next to the wordmark. The live Echo avatar is still used for the
 * companion, the margin notes and the chat bubbles — just not as the logo.
 */
export default function Logo({ to = '/' }) {
  return (
    <Link className="logo" to={to} aria-label="Echo home">
      <img className="logo-mark" src="/echo.png" alt="" width="42" height="42" />
      Echo
    </Link>
  )
}
