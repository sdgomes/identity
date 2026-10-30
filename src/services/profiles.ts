import { getSupabase } from '../lib/supabase'

export type Role = 'user' | 'admin'

export type Profile = {
  id: string
  full_name: string | null
  role: Role
  avatar_path: string | null
}

export const profileService = {
  // A RLS só devolve o perfil do próprio usuário.
  getOwn: (userId: string) =>
    getSupabase().from('profiles').select('id, full_name, role, avatar_path').eq('id', userId).single<Profile>(),
  avatarUrl: async (path: string) => {
    const { data } = await getSupabase().storage.from('avatars').createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  },
}
