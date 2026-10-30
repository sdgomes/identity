import { getSupabase } from '../lib/supabase'

export type AuthHealth = {
  ok: boolean
  version: string | null
  latencyMs: number
}

export type DatabaseHealth = {
  ok: boolean
  latencyMs: number
}

async function timed<T>(operation: () => Promise<T>) {
  const start = performance.now()
  const result = await operation()
  return { result, latencyMs: Math.round(performance.now() - start) }
}

export const systemInfoService = {
  // Endpoint público do Supabase Auth; responde com a versão do serviço.
  checkAuth: async (): Promise<AuthHealth> => {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '')
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
    try {
      const { result, latencyMs } = await timed(() => fetch(`${url}/auth/v1/health`, { headers: { apikey: key } }))
      const body = await result.json().catch(() => null)
      return { ok: result.ok, version: body?.version ?? null, latencyMs }
    } catch {
      return { ok: false, version: null, latencyMs: 0 }
    }
  },
  // Consulta mínima permitida pela RLS: o próprio perfil.
  checkDatabase: async (userId: string): Promise<DatabaseHealth> => {
    const { result, latencyMs } = await timed(async () =>
      getSupabase().from('profiles').select('id').eq('id', userId).single())
    return { ok: !result.error, latencyMs }
  },
}
