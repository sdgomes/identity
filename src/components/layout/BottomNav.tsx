import type { Route } from '../../hooks/useHashRoute'
import { mainLinks } from './navigation'

// Barra de navegação fixa no rodapé, só no mobile (o CSS esconde no desktop).
export function BottomNav({ route }: { route: Route }) {
  return (
    <nav className="bottom-nav" aria-label="Principal">
      {mainLinks.map((link) => (
        <a key={link.route} href={link.href} aria-current={route === link.route ? 'page' : undefined}>
          {link.icon}
          <span>{link.label}</span>
        </a>
      ))}
    </nav>
  )
}
