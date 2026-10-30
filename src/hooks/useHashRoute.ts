import { useSyncExternalStore } from 'react'

export type Route = 'home' | 'disciplinas' | 'carteirinha' | 'secretaria' | 'admin' | 'system'

const routes: Record<string, Route> = {
  '#/disciplinas': 'disciplinas',
  '#/carteirinha': 'carteirinha',
  '#/secretaria': 'secretaria',
  '#/admin': 'admin',
  '#/system': 'system',
}

export const adminRoutes: Route[] = ['admin', 'system']

// Rotas por hash funcionam no GitHub Pages sem configuração de servidor.
function readRoute(): Route {
  return routes[window.location.hash] ?? 'home'
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

export function useHashRoute() {
  return useSyncExternalStore(subscribe, readRoute)
}
