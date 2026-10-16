import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import { useApp } from '../store/AppContext.jsx'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import { resetStory, deleteStory } from '../components/mascot/scenarios.js'
import { AVATARS, avatarById } from '../lib/avatars.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import '../styles/pages.css'

// Small inline icons — the project keeps them local instead of pulling a set.
const CameraIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 9.3a2.3 2.3 0 0 1 2.3-2.3h1.7l1.1-1.9h6.8l1.1 1.9h1.7a2.3 2.3 0 0 1 2.3 2.3v6.9a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3V9.3Z" />
    <circle cx="12" cy="12.6" r="3.2" />
  </svg>
)

const LockIcon = ({ size = 17 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path
      d="M7.75 10.4V7.7a4.25 4.25 0 0 1 8.5 0v2.7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
    />
    <rect x="5.2" y="10.4" width="13.6" height="9.4" rx="2.4" fill="currentColor" />
  </svg>
)

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12.5l4.6 4.6L19 7.6" />
  </svg>
)

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export default function Settings() {
  useDocumentTitle('Settings')
  const { state, actions, level } = useApp()
  const navigate = useNavigate()
  const companion = useCompanion()
  const [name, setName] = useState(state.account?.name || '')
  const [pickerOpen, setPickerOpen] = useState(false)
  // The question the confirm dialog is asking, or null when nothing is. Each
  // one carries its own wording and the work to run if the answer is yes.
  const [confirming, setConfirming] = useState(null)

  const saveName = (e) => {
    e.preventDefault()
    if (name.trim().length < 2) return actions.toast('Enter a name with at least two letters.', 'error')
    actions.rename(name)
    actions.toast('Name saved.', 'success')
  }

  // The picture currently on the profile, and the initial shown before one is picked.
  const pic = state.account?.avatar ? avatarById(state.account.avatar) : null
  const initial = (state.account?.name || 'E').trim().slice(0, 1).toUpperCase() || 'E'

  // The first locked picture the level has not reached yet, for the hint lines.
  const nextUnlock = AVATARS.find((a) => a.unlockLevel > level.level)
  const chooseAvatar = async (a) => {
    try {
      await actions.setAvatar(a.id)
      setPickerOpen(false)
      actions.toast(`Profile picture set to ${a.name}.`, 'success')
    } catch (e) {
      actions.toast(e.message || 'Could not set that picture.', 'error')
    }
  }

  // While the popup is open: Escape closes it and the page behind it holds still.
  useEffect(() => {
    if (!pickerOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [pickerOpen])

  return (
    <>
      <PageHeader title="Settings" subtitle="Everything is stored in this browser." />

      <div className="side-by-side">
        <div className="settings">
          <form className="surface settings-block" onSubmit={saveName}>
            <h3>Profile</h3>
            <p className="muted small">
              {state.account?.googleLinked
                ? `Signed in with Google as ${state.account.email}. Your password stays with Google.`
                : `Signed in as ${state.account?.email} with a password.`}
            </p>

            {/* Instagram-style profile picture: the portrait with a camera badge,
                tapping it opens the character picker. */}
            <div className="profile-pic-row">
              <button
                type="button"
                className="profile-pic"
                onClick={() => setPickerOpen(true)}
                aria-haspopup="dialog"
                aria-label="Change profile picture"
              >
                {pic ? (
                  <img src={pic.src} alt="" width="88" height="88" />
                ) : (
                  <span className="profile-pic-fallback" aria-hidden="true">
                    {initial}
                  </span>
                )}
                <span className="profile-pic-cam" aria-hidden="true">
                  <CameraIcon />
                </span>
              </button>
              <div className="profile-pic-info">
                <p className="profile-pic-name">{pic ? pic.name : 'No picture chosen'}</p>
                <p className="muted">
                  Three pictures open at level 1, then one more every five levels. You're level {level.level}
                  {nextUnlock ? ` — the next opens at level ${nextUnlock.unlockLevel}.` : ' — every picture is open.'}
                </p>
                <button type="button" className="btn btn-quiet" onClick={() => setPickerOpen(true)}>
                  Change profile picture
                </button>
              </div>
            </div>

            <label className="field">
              <span>Display name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="btn-row"><button type="submit" className="btn btn-primary">Save name</button></div>
          </form>

          <section className="surface settings-block">
            <h3>Echo</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={state.settings.echoEnabled !== false}
                onChange={(e) => actions.updateSettings({ echoEnabled: e.target.checked })}
              />
              <span>Show Echo in the bottom right corner of every page. Switch him off for a quieter screen.</span>
            </label>
          </section>

          <section className="surface settings-block">
            <h3>Start over</h3>
            <p className="muted">These cannot be undone.</p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() =>
                  setConfirming({
                    title: 'Reset your progress?',
                    message: 'XP, streak, scores and topic progress all go back to zero. Your materials and their notes stay.',
                    confirmLabel: 'Reset progress',
                    run: () => {
                      actions.clearProgress()
                      actions.toast('Progress reset.', 'info')
                      const story = resetStory()
                      companion.react(story.pose, story.line, story.tone, story.ms)
                    },
                  })
                }
              >
                Reset progress
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() =>
                  setConfirming({
                    title: 'Delete everything?',
                    message: 'Your account, your materials and all your progress are removed from this browser. There is no way back.',
                    confirmLabel: 'Delete everything',
                    run: () => {
                      const story = deleteStory()
                      companion.react(story.pose, story.line, story.tone, story.ms)
                      actions.resetAll()
                      navigate('/')
                    },
                  })
                }
              >
                Delete everything
              </button>
            </div>
          </section>
        </div>

      </div>

      {confirming && (
        <ConfirmDialog
          title={confirming.title}
          message={confirming.message}
          confirmLabel={confirming.confirmLabel}
          danger
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const run = confirming.run
            setConfirming(null)
            run()
          }}
        />
      )}

      {/* The character picker: every portrait, locked ones included, so the
          student can see what their level has opened and what is coming. */}
      {pickerOpen && (
        <div className="picker-backdrop" onClick={() => setPickerOpen(false)}>
          <div
            className="surface picker"
            role="dialog"
            aria-modal="true"
            aria-label="Choose your profile picture"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="picker-head">
              <div>
                <h3>Choose your profile picture</h3>
                <p className="muted">
                  You're level {level.level}.{' '}
                  {nextUnlock ? `The next picture opens at level ${nextUnlock.unlockLevel}.` : 'Every picture is open.'}
                </p>
              </div>
              <button
                type="button"
                className="picker-close"
                aria-label="Close"
                onClick={() => setPickerOpen(false)}
                autoFocus
              >
                <CloseIcon />
              </button>
            </div>

            <div className="avatar-grid">
              {AVATARS.map((a) => {
                const unlocked = a.unlockLevel <= level.level
                const chosen = state.account?.avatar === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`avatar-pick${chosen ? ' is-chosen' : ''}`}
                    aria-disabled={!unlocked}
                    aria-pressed={chosen}
                    title={unlocked ? `Use ${a.name}` : `Unlocks at level ${a.unlockLevel}`}
                    onClick={() =>
                      unlocked ? chooseAvatar(a) : actions.toast(`That picture unlocks at level ${a.unlockLevel}.`, 'info')
                    }
                  >
                    <span className="avatar-pick-face">
                      <img src={a.src} alt={a.name} width="64" height="64" loading="lazy" />
                      {unlocked && chosen && (
                        <span className="avatar-tick" aria-hidden="true">
                          <CheckIcon />
                        </span>
                      )}
                      {!unlocked && (
                        <span className="avatar-lock" aria-hidden="true">
                          <LockIcon />
                        </span>
                      )}
                    </span>
                    <span className="avatar-pick-name">
                      {unlocked ? (
                        a.name
                      ) : (
                        <span className="avatar-level">
                          <LockIcon size={11} /> Level {a.unlockLevel}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
