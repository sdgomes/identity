import { useAuth } from '../../auth/auth-context'
import type { Route } from '../../hooks/useHashRoute'
import { adminLinks, mainLinks, type NavLink } from './navigation'

function LinkList({ links, route }: { links: NavLink[], route: Route }) {
  return (
    <ul>
      {links.map((link) => (
        <li key={link.route}>
          <a href={link.href} aria-current={route === link.route ? 'page' : undefined}>{link.label}</a>
        </li>
      ))}
    </ul>
  )
}

// Menu lateral do desktop. No mobile ele dá lugar à BottomNav, e a administração vai para o menu do avatar.
export function Sidebar({ route }: { route: Route }) {
  const { isAdmin } = useAuth()

  return (
    <aside className="sidebar">
      <nav aria-label="Principal">
        <LinkList links={mainLinks} route={route} />
        {isAdmin && (
          <>
            <span className="sidebar-group">Administração</span>
            <LinkList links={adminLinks} route={route} />
          </>
        )}
      </nav>
    </aside>
  )
}
