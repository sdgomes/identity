import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/auth-context'
import { profileService } from '../../services/profiles'
import { Avatar } from '../Avatar'
import { LogOutIcon } from './icons'
import { adminLinks } from './navigation'

export function UserMenu() {
  const { session, profile, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [avatar, setAvatar] = useState<{ path: string, url: string | null } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const avatarPath = profile?.avatar_path ?? null

  // Fecha ao clicar fora ou pressionar Esc.
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

  // A foto fica em bucket privado: a URL é assinada e temporária.
  useEffect(() => {
    if (!avatarPath) return
    let active = true
    profileService.avatarUrl(avatarPath).then((url) => { if (active) setAvatar({ path: avatarPath, url }) })
    return () => { active = false }
  }, [avatarPath])

  if (!session) return null
  const email = session.user.email ?? ''
  const name = profile?.full_name || email
  const avatarUrl = avatar?.path === avatarPath ? avatar.url : null

  return (
    <div className="user-menu" ref={containerRef}>
      <button type="button" className="avatar" aria-label="Menu do usuário" aria-haspopup="menu"
        aria-expanded={open} onClick={() => setOpen(!open)}>
        <Avatar name={name} url={avatarUrl} />
      </button>
      {open && (
        <div className="popover" role="menu" aria-label="Menu do usuário">
          <div className="popover-header">
            <strong>{name}</strong>
            {name !== email && <span>{email}</span>}
          </div>
          {/* No mobile não há menu lateral: a administração fica aqui (o CSS esconde no desktop). */}
          {isAdmin && (
            <div className="user-menu-admin">
              <span className="popover-group">Administração</span>
              <ul className="popover-actions">
                {adminLinks.map((link) => (
                  <li key={link.route}>
                    <a href={link.href} role="menuitem" onClick={() => setOpen(false)}>
                      {link.icon}
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="popover-actions">
            <li>
              <button type="button" role="menuitem" onClick={signOut}>
                <LogOutIcon />
                Sair
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
