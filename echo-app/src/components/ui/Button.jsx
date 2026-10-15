import { Link } from 'react-router-dom'
import './ui.css'

/** One button component. Pass `to` for a router link, `href` for a plain link, otherwise it is a <button>. */
export default function Button({ variant = 'primary', to, href, className = '', children, ...rest }) {
  const cls = `btn btn-${variant} ${className}`.trim()
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>
  return <button type="button" className={cls} {...rest}>{children}</button>
}
