import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../../auth/auth-context'
import { formatRelative } from '../../lib/format'
import { notificationsService, type Notification } from '../../services/notifications'
import { BellIcon } from './icons'

const empty: Notification[] = []

export function NotificationsMenu() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const notifications = useSyncExternalStore(
    notificationsService.subscribe,
    () => (userId ? notificationsService.list(userId) : empty),
  )
  const unread = notifications.filter((notification) => !notification.read).length

  // Fecha ao clicar fora ou pressionar Esc, como o menu do usuário.
  useEffect(() => {
    if (!open) return
    function handlePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!userId) return null

  return (
    <div className="user-menu" ref={containerRef}>
      <button type="button" className="icon-button notifications-button" aria-haspopup="dialog" aria-expanded={open}
        aria-label={unread ? `Notificações, ${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Notificações'} title="Notificações"
        onClick={() => setOpen(!open)}>
        <BellIcon />
        {unread > 0 && <span className="notifications-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="popover notifications-popover" role="dialog" aria-label="Notificações">
          <div className="notifications-header">
            <strong>Notificações</strong>
            {unread > 0 && (
              <button type="button" className="link-button" onClick={() => notificationsService.markAllRead(userId)}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          {notifications.length === 0 ? <p className="notifications-empty">Nenhuma notificação.</p> : (
            <ul className="notifications-list">
              {notifications.map((notification) => (
                <li key={notification.id} className={notification.read ? 'notification' : 'notification notification-unread'}>
                  <span className="notification-dot" aria-hidden="true" />
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.body}</p>
                    <div className="notification-meta">
                      <time dateTime={notification.createdAt}>{formatRelative(notification.createdAt)}</time>
                      {!notification.read && (
                        <button type="button" className="link-button"
                          onClick={() => notificationsService.markRead(userId, notification.id)}>
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
