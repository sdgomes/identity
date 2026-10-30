import type { ReactNode } from 'react'
import brandLogo from '../../assets/logo-fmu-fiam.png'
import { useAuth } from '../../auth/auth-context'
import type { Route } from '../../hooks/useHashRoute'
import { BottomNav } from './BottomNav'
import { NotificationsMenu } from './NotificationsMenu'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'

export function AppLayout({ route, children }: { route: Route, children: ReactNode }) {
  const { session } = useAuth()

  return (
    <div className={session ? 'app-shell' : 'app-shell app-shell-public'}>
      <header className="app-header">
        <span className="brand"><img src={brandLogo} alt="FMU | FIAM-FAAM" /></span>
        {session && (
          <div className="header-actions">
            <NotificationsMenu />
            <UserMenu />
          </div>
        )}
      </header>
      {/* Desktop: menu lateral. Mobile: barra inferior; o CSS mostra um ou outro. */}
      {session && <Sidebar route={route} />}
      <main>{children}</main>
      {session && <BottomNav route={route} />}
    </div>
  )
}
