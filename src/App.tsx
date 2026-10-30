import type { ReactNode } from 'react'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/auth-context'
import { AppLayout } from './components/layout/AppLayout'
import { adminRoutes, useHashRoute, type Route } from './hooks/useHashRoute'
import { AdminPage } from './pages/AdminPage'
import { CarteirinhaPage } from './pages/CarteirinhaPage'
import { DisciplinasPage } from './pages/DisciplinasPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SecretariaPage } from './pages/SecretariaPage'
import { SystemPage } from './pages/SystemPage'

const pages: Record<Route, () => ReactNode> = {
  home: HomePage,
  disciplinas: DisciplinasPage,
  carteirinha: CarteirinhaPage,
  secretaria: SecretariaPage,
  admin: AdminPage,
  system: SystemPage,
}

function Screen({ route }: { route: Route }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <p aria-live="polite">Carregando…</p>
  // A tela só esconde o acesso; a Edge Function admin-users é quem garante a permissão.
  if (adminRoutes.includes(route) && !isAdmin) {
    return <p className="alert" role="alert">Acesso restrito a administradores.</p>
  }
  const Page = pages[route]
  return <Page />
}

function Shell() {
  const route = useHashRoute()
  const { session, loading } = useAuth()
  // O login ocupa a tela toda, fora do layout com cabeçalho.
  if (!loading && !session) return <LoginPage />
  return <AppLayout route={route}><Screen route={route} /></AppLayout>
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
