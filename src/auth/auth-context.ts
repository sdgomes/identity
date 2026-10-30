import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Profile } from '../services/profiles'

export type AuthState = {
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
