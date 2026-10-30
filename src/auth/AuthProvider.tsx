import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { localCache } from '../lib/local-cache'
import { supabase } from '../lib/supabase'
import { authService } from '../services/auth'
import { notificationsService } from '../services/notifications'
import { profileService, type Profile } from '../services/profiles'
import { studentCardService } from '../services/student-card'
import { subjectsService } from '../services/subjects'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(Boolean(supabase))
  const [loadedProfile, setLoadedProfile] = useState<{ userId: string, profile: Profile | null } | null>(null)

  useEffect(() => {
    // Sem Supabase configurado não há sessão possível: o app segue para o login.
    if (!supabase) return

    authService.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    // Mantém a tela sincronizada com login, logout, renovação de token e outras abas.
    const { data } = authService.onAuthStateChange((event, nextSession) => {
      // Logout nesta ou em outra aba, ou sessão expirada: os dados pessoais guardados saem junto.
      if (event === 'SIGNED_OUT') localCache.clear()
      setSession(nextSession)
      setSessionLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  // Ao abrir o app, confere se a sessão guardada ainda vale no servidor; se não, volta para o login.
  useEffect(() => {
    if (userId) authService.verifySession()
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let active = true
    profileService.getOwn(userId).then(({ data }) => {
      if (active) setLoadedProfile({ userId, profile: data })
    })
    return () => { active = false }
  }, [userId])

  // Mantém a carteirinha e as disciplinas guardadas em dia enquanto o app está aberto, em qualquer tela.
  useEffect(() => {
    if (!userId) return
    const stopCard = studentCardService.watch(userId)
    const stopSubjects = subjectsService.watch(userId)
    return () => {
      stopCard()
      stopSubjects()
      // As notificações de demonstração são sorteadas a cada login.
      notificationsService.reset()
    }
  }, [userId])

  // Ignora o perfil de um usuário anterior enquanto o do atual carrega.
  const profile = userId && loadedProfile?.userId === userId ? loadedProfile.profile : null
  const loading = sessionLoading || (userId !== null && loadedProfile?.userId !== userId)

  const signOut = async () => {
    await authService.signOut()
  }

  return (
    <AuthContext value={{ session, profile, isAdmin: profile?.role === 'admin', loading, signOut }}>
      {children}
    </AuthContext>
  )
}
