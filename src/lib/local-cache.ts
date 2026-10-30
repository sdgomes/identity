// Cache no localStorage: sobrevive a recarregar a página, a fechar a aba e é compartilhado entre abas.
// É apagado no logout (src/auth/AuthProvider.tsx), assim como a sessão do Supabase guardada no mesmo lugar.
// Leitura e escrita são protegidas: com armazenamento bloqueado (janela anônima, política do navegador)
// o app só deixa de usar o cache.

const PREFIX = 'identity:'

type Entry<T> = { savedAt: number, value: T }

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const localCache = {
  // Devolve null se não houver entrada ou se ela for mais velha que maxAgeMs.
  read<T>(key: string, maxAgeMs: number): Entry<T> | null {
    try {
      const raw = storage()?.getItem(PREFIX + key)
      if (!raw) return null
      const entry = JSON.parse(raw) as Entry<T>
      if (typeof entry?.savedAt !== 'number' || Date.now() - entry.savedAt > maxAgeMs) {
        storage()?.removeItem(PREFIX + key)
        return null
      }
      return entry
    } catch {
      return null
    }
  },
  write<T>(key: string, value: T) {
    const entry: Entry<T> = { savedAt: Date.now(), value }
    try {
      storage()?.setItem(PREFIX + key, JSON.stringify(entry))
    } catch {
      // Cota cheia ou armazenamento bloqueado: segue sem cache.
    }
    return entry
  },
  // Chamado ao sair da conta, para não deixar dados pessoais no navegador.
  clear() {
    try {
      const store = storage()
      if (!store) return
      Object.keys(store).filter((key) => key.startsWith(PREFIX)).forEach((key) => store.removeItem(key))
    } catch {
      // Nada a limpar.
    }
  },
}
