import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'

export const authService = {
  getSession: () => getSupabase().auth.getSession(),
  signIn: (email: string, password: string) =>
    getSupabase().auth.signInWithPassword({ email, password }),
  // "local": sai só deste navegador. O padrão do Supabase ("global") derruba a sessão em todos os
  // navegadores do usuário, que continuam parecendo logados até o token vencer.
  signOut: () => getSupabase().auth.signOut({ scope: 'local' }),
  onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) =>
    getSupabase().auth.onAuthStateChange(callback),
  // Confere no servidor se a sessão ainda existe. O token guardado continua válido até vencer mesmo
  // depois de a sessão ser revogada (logout global, senha trocada, usuário removido); nesse caso o
  // cliente do Supabase descarta a sessão e avisa SIGNED_OUT, e o app volta para o login.
  verifySession: async () => {
    const { error } = await getSupabase().auth.getUser()
    return !error
  },
}
