import { localCache } from './local-cache'

export type Cached<T> = { value: T, savedAt: number }

// Dado de um usuário guardado no localCache, com cópia em memória para o React comparar por referência
// (useSyncExternalStore) e sem consultas duplicadas ao mesmo tempo (StrictMode, Realtime e tela juntos).
export function createCachedResource<T>(options: {
  name: string
  maxAgeMs: number
  // Recebe o valor anterior para reaproveitar o que não mudou (ex.: a foto da carteirinha).
  load: (userId: string, previous: T | null) => Promise<T>
}) {
  const key = (userId: string) => `${options.name}:${userId}`
  let snapshot: { userId: string, value: Cached<T> | null } | null = null
  const listeners = new Set<() => void>()
  const inFlight = new Map<string, Promise<T>>()

  const resource = {
    // Lê só o cache, sem rede.
    peek: (userId: string): Cached<T> | null => {
      if (snapshot?.userId !== userId) {
        const entry = localCache.read<T>(key(userId), options.maxAgeMs)
        snapshot = { userId, value: entry }
      } else if (snapshot.value && Date.now() - snapshot.value.savedAt > options.maxAgeMs) {
        snapshot = { userId, value: null }
      }
      return snapshot.value
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    // Consulta, grava no cache e avisa as telas abertas.
    refresh: (userId: string): Promise<T> => {
      const pending = inFlight.get(userId)
      if (pending) return pending
      const request = options.load(userId, resource.peek(userId)?.value ?? null)
        .then((value) => {
          snapshot = { userId, value: localCache.write(key(userId), value) }
          listeners.forEach((listener) => listener())
          return value
        })
        .finally(() => inFlight.delete(userId))
      inFlight.set(userId, request)
      return request
    },
    // Só consulta se já houver algo guardado: sem cache, a tela ainda não foi aberta.
    revalidate: (userId: string) => {
      if (resource.peek(userId)) resource.refresh(userId).catch(() => {})
    },
    // Esquece a cópia em memória (logout); o localCache é limpo à parte.
    reset: () => { snapshot = null },
  }
  return resource
}
