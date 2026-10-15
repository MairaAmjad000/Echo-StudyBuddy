import { NavLink, useNavigate } from 'react-router-dom'
import Logo from '../brand/Logo.jsx'
import ProgressBar from '../ui/ProgressBar.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { avatarById } from '../../lib/avatars.js'
import { useCompanion } from '../mascot/companion-context.jsx'
import { signOutStory } from '../mascot/scenarios.js'

const GROUPS = [
  {
    title: 'Study',
    items: [
      { to: '/app', label: 'Dashboard', end: true },
      { to: '/app/map', label: 'Learning Map' },
      { to: '/app/materials', label: 'My Materials' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/app/chat', label: 'Chat with Echo' },
      { to: '/app/notes', label: 'Smart Notes' },
      { to: '/app/flashcards', label: 'Flashcards' },
      { to: '/app/quiz', label: 'Quiz Arena' },
      { to: '/app/teach', label: 'Teach Echo' },
    ],
  },
  {
    title: 'You',
    items: [
      { to: '/app/performance', label: 'Performance' },
      { to: '/app/achievements', label: 'Achievements' },
      { to: '/app/settings', label: 'Settings' },
    ],
  },
]

export default function Sidebar() {
  const { state, level, actions } = useApp()
  const navigate = useNavigate()
  const companion = useCompanion()
  const name = state.account?.name || 'Explorer'
  // The chosen profile picture; without one the card falls back to the initial.
  const pic = state.account?.avatar ? avatarById(state.account.avatar) : null

  const signOut = () => {
    // Echo says goodbye before the page goes: the note follows you to home.
    const story = signOutStory()
    companion.react(story.pose, story.line, story.tone, story.ms)
    actions.signOut()
    navigate('/')
  }

  return (
    <div className="sidebar-inner">
      <div className="sidebar-logo">
        <Logo to="/app" />
      </div>

      <nav aria-label="App">
        {GROUPS.map((g) => (
          <div className="nav-group" key={g.title}>
            <p className="nav-title">{g.title}</p>
            {g.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="user-card">
        <div className="user-row">
          {pic ? (
            <img className="avatar avatar-img" src={pic.src} alt="" width="36" height="36" />
          ) : (
            <span className="avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
          )}
          <div>
            <p className="user-name">{name}</p>
            <p className="user-level">Explorer, level {level.level}</p>
          </div>
        </div>
        <ProgressBar value={(level.into / level.size) * 100} tone="blue" label="Progress to next level" />
        <p className="user-xp">
          {level.maxed ? 'Max level reached.' : `${level.into} / ${level.size} XP to level ${level.level + 1}`}
        </p>
        <button type="button" className="btn-text small" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}
