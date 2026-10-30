import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { localCache } from '../lib/local-cache'
import { getSupabase } from '../lib/supabase'
import { authService } from './auth'

// area: notícias da área do curso; formacao: estudo e carreira na área; ensino: ensino superior em geral.
export type FeedCategory = 'area' | 'formacao' | 'ensino'

export type FeedItem = {
  id: string
  title: string
  summary: string
  link: string
  imageUrl: string | null
  publishedAt: string | null
  source: string
  category: FeedCategory
}

export type Feed = {
  // Área do curso da matrícula do aluno; sem matrícula, o feed traz só ensino superior.
  area: { key: string, label: string } | null
  items: FeedItem[]
  // Fontes que não responderam desta vez; o restante do feed aparece normalmente.
  failedSources: string[]
}

export type FeedState = {
  cached: { feed: Feed, savedAt: number } | null
  refreshing: boolean
  error: string | null
}

export function categoryLabel(category: FeedCategory, area: Feed['area']) {
  if (category === 'area') return area?.label ?? 'Sua área'
  return category === 'formacao' ? 'Estudo e carreira' : 'Ensino superior'
}

// O cache só evita a tela de carregamento a cada visita; o botão "Atualizar" busca na hora.
// Com mais de 10 minutos (o mesmo tempo do cache da função), o feed guardado continua na tela
// e é atualizado em segundo plano. Com mais de 1 hora, é descartado.
const FRESH_MS = 10 * 60 * 1000
const MAX_AGE_MS = 60 * 60 * 1000

const cacheKey = (userId: string) => `feed:${userId}`

// Estado em memória: o React compara por referência para saber se precisa redesenhar.
let state: ({ userId: string } & FeedState) | null = null
const listeners = new Set<() => void>()
const inFlight = new Map<string, Promise<void>>()

function currentState(userId: string): FeedState {
  if (state?.userId !== userId) {
    const entry = localCache.read<Feed>(cacheKey(userId), MAX_AGE_MS)
    state = { userId, cached: entry ? { feed: entry.value, savedAt: entry.savedAt } : null, refreshing: false, error: null }
  }
  return state
}

function update(userId: string, changes: Partial<FeedState>) {
  state = { ...currentState(userId), ...changes, userId }
  listeners.forEach((listener) => listener())
}

// Os sites não liberam CORS para o navegador, por isso a leitura dos RSS passa pela Edge Function feed.
// A função descobre o curso pela matrícula de quem chama.
async function fetchFeed(): Promise<Feed> {
  const { data, error } = await getSupabase().functions.invoke<Feed>('feed')
  if (error) {
    if (error instanceof FunctionsFetchError) {
      throw new Error('Não foi possível acessar o feed. Verifique se a função feed está publicada.')
    }
    // 401: a função não reconheceu a sessão. Se ela foi revogada, verifySession leva ao login.
    if (error instanceof FunctionsHttpError && error.context.status === 401 && !await authService.verifySession()) {
      throw new Error('Sua sessão terminou. Entre novamente.')
    }
    const body = error instanceof FunctionsHttpError
      ? await error.context.json().catch(() => null)
      : null
    throw new Error(body?.error ?? body?.message ?? 'Não foi possível carregar o feed.')
  }
  return data as Feed
}

export const feedService = {
  // Lê só a memória e o cache, sem rede.
  state: (userId: string) => currentState(userId),
  // Para useSyncExternalStore: avisa quando o estado muda.
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  // Busca o feed e atualiza o cache. Se falhar, o feed guardado continua valendo.
  refresh: (userId: string) => {
    const pending = inFlight.get(userId)
    if (pending) return pending
    update(userId, { refreshing: true })
    const request = fetchFeed()
      .then((feed) => {
        const entry = localCache.write(cacheKey(userId), feed)
        update(userId, { cached: { feed, savedAt: entry.savedAt }, refreshing: false, error: null })
      })
      .catch((loadError: Error) => update(userId, { refreshing: false, error: loadError.message }))
      .finally(() => inFlight.delete(userId))
    inFlight.set(userId, request)
    return request
  },
  // Só busca se não houver feed guardado ou se ele tiver passado de 10 minutos.
  revalidate: (userId: string) => {
    const { cached } = currentState(userId)
    if (!cached || Date.now() - cached.savedAt > FRESH_MS) return feedService.refresh(userId)
  },
}
