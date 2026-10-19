import { useEffect, useRef, useState } from 'react'
import { timeAgo } from '../../lib/format.js'
import './chat.css'

/**
 * The stored conversations, newest first — the rail beside the chat window.
 * A row opens that thread; the ⋮ on the row you are on (or pointing at) opens
 * a small menu, and Delete there forgets the conversation for good. The menu
 * closes on Escape, on a click anywhere else, when another row is picked, and
 * once the delete has run. It flips above its button when the rail is scrolled
 * so far down that a menu below would be cut off — but only when there is real
 * room above it, because the top row has none and must keep its menu below.
 */
export default function ChatHistory({ chats, activeId, onOpen, onDelete, onNew, busy }) {
  // { id, up } for the one open menu, or null.
  const [menu, setMenu] = useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (!menu) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMenu(null)
    }
    const onDown = (e) => {
      // Clicks inside the menu's own cell leave it alone: its button toggles
      // and its Delete item closes it on purpose.
      if (!e.target.closest('.chat-rail-menu-wrap')) setMenu(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [menu])

  // The list can change under an open menu (a delete, a reload): drop it then.
  useEffect(() => {
    if (menu && !chats.some((c) => c.id === menu.id)) setMenu(null)
  }, [chats, menu])

  const toggleMenu = (e, id) => {
    if (menu?.id === id) {
      setMenu(null)
      return
    }
    const list = listRef.current
    // A menu is ~76px tall with its gap. Flip it up only when it does not fit
    // below *and* there is that much room above: with few chats the list box
    // is barely taller than its rows, and the top row has no room above at all
    // — flipping there would push the menu over the rail's header.
    let up = false
    if (list) {
      const btn = e.currentTarget.getBoundingClientRect()
      const box = list.getBoundingClientRect()
      const MENU = 76
      up = box.bottom - btn.bottom < MENU && btn.top - box.top >= MENU
    }
    setMenu({ id, up })
  }

  const remove = (id) => {
    setMenu(null)
    onDelete(id)
  }

  return (
    <aside className="chat-rail" aria-label="Chat history">
      <div className="chat-rail-head">
        <span className="chat-rail-title-label">Chat history</span>
        <button type="button" className="btn btn-quiet chat-new" onClick={onNew} disabled={busy}>
          New chat
        </button>
      </div>

      {chats.length === 0 ? (
        <p className="chat-rail-empty small muted">
          Nothing saved yet. Ask a question and the conversation shows up here, ready to pick up again.
        </p>
      ) : (
        <ul className="chat-rail-list" ref={listRef}>
          {chats.map((c) => {
            const on = c.id === activeId
            const open = menu?.id === c.id
            return (
              <li key={c.id} className={`chat-rail-item${on ? ' is-on' : ''}${open ? ' is-menu' : ''}`}>
                <button type="button" className="chat-rail-open" onClick={() => onOpen(c.id)} disabled={busy} title={c.title}>
                  <span className="chat-rail-item-title">{c.title}</span>
                  <span className="chat-rail-meta">
                    {c.materialTitle ? `${c.materialTitle} · ` : ''}
                    {timeAgo(new Date(c.updatedAt).getTime())} · {c.turnCount} {c.turnCount === 1 ? 'message' : 'messages'}
                  </span>
                </button>

                <div className="chat-rail-menu-wrap">
                  <button
                    type="button"
                    className="chat-rail-more"
                    onClick={(e) => toggleMenu(e, c.id)}
                    disabled={busy}
                    aria-label={`Options for ${c.title}`}
                    aria-haspopup="menu"
                    aria-expanded={open}
                  >
                    <span className="chat-rail-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </button>

                  {open && (
                    <div className={`chat-rail-menu${menu.up ? ' is-up' : ''}`} role="menu">
                      <button type="button" role="menuitem" className="chat-rail-menu-item" onClick={() => remove(c.id)} disabled={busy}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
