import type { ReactNode } from 'react'
import type { Route } from '../../hooks/useHashRoute'
import { BookIcon, ClipboardIcon, HomeIcon, IdCardIcon, ServerIcon, UsersIcon } from './icons'

export type NavLink = { route: Route, href: string, label: string, icon: ReactNode }

// Usados pelo menu lateral (desktop), pela barra inferior (mobile) e pelo menu do avatar (admin no mobile).
export const mainLinks: NavLink[] = [
  { route: 'home', href: '#/', label: 'Início', icon: <HomeIcon /> },
  { route: 'disciplinas', href: '#/disciplinas', label: 'Disciplinas', icon: <BookIcon /> },
  { route: 'carteirinha', href: '#/carteirinha', label: 'Carteirinha', icon: <IdCardIcon /> },
  { route: 'secretaria', href: '#/secretaria', label: 'Secretaria', icon: <ClipboardIcon /> },
]

export const adminLinks: NavLink[] = [
  { route: 'admin', href: '#/admin', label: 'Usuários', icon: <UsersIcon /> },
  { route: 'system', href: '#/system', label: 'Sistema', icon: <ServerIcon /> },
]
