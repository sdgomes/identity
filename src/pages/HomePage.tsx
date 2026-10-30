import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../auth/auth-context'
import { RefreshIcon } from '../components/layout/icons'
import { formatRelative } from '../lib/format'
import { categoryLabel, feedService, type Feed, type FeedCategory, type FeedItem, type FeedState } from '../services/feed'

type Filter = 'todos' | FeedCategory

const categoryOrder: FeedCategory[] = ['area', 'formacao', 'ensino']
// Quantos artigos vão para a faixa "Em alta", logo depois do destaque.
const TRENDING_COUNT = 6

// Imagem do site de origem; se não houver ou quebrar, um fundo com o nome da fonte.
function NewsImage({ item }: { item: FeedItem }) {
  const [failed, setFailed] = useState(false)
  if (!item.imageUrl || failed) return <span className="news-image-fallback">{item.source}</span>
  return <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

function Meta({ item }: { item: FeedItem }) {
  return (
    <span className="news-meta">
      {item.publishedAt && (
        <time dateTime={item.publishedAt} title={new Date(item.publishedAt).toLocaleString('pt-BR')}>
          {formatRelative(item.publishedAt)}
        </time>
      )}
      {item.publishedAt && ' · '}
      {item.source}
    </span>
  )
}

function newsLink(item: FeedItem) {
  return { href: item.link, target: '_blank', rel: 'noopener noreferrer' }
}

const emptyState: FeedState = { cached: null, refreshing: false, error: null }

export function HomePage() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [filter, setFilter] = useState<Filter>('todos')
  // Feed guardado no navegador: aparece na hora; a atualização roda em segundo plano.
  const { cached, refreshing, error } = useSyncExternalStore(
    feedService.subscribe,
    () => (userId ? feedService.state(userId) : emptyState),
  )

  useEffect(() => {
    if (userId) feedService.revalidate(userId)
  }, [userId])

  const feed = cached?.feed
  const area: Feed['area'] = feed?.area ?? null
  // Só aparecem filtros de categorias que têm artigo agora.
  const categories = categoryOrder.filter((category) => feed?.items.some((item) => item.category === category))
  const activeFilter = filter === 'todos' || categories.includes(filter) ? filter : 'todos'
  const items = feed?.items.filter((item) => activeFilter === 'todos' || item.category === activeFilter) ?? []
  const failed = feed?.failedSources ?? []

  // Destaque: o artigo mais recente com imagem. Depois, a faixa "Em alta" e o resto em "Mais recentes".
  const featured = items.find((item) => item.imageUrl) ?? items[0]
  const others = items.filter((item) => item !== featured)
  const trending = others.slice(0, TRENDING_COUNT)
  const latest = others.slice(TRENDING_COUNT)

  return (
    <>
      {/* Sem título visível: o botão de atualizar fica fixo à esquerda e só as pílulas rolam para o lado. */}
      <h1 className="sr-only">Novidades</h1>
      <div className="news-toolbar">
        <button type="button" className="icon-button news-refresh" disabled={refreshing || !userId}
          aria-label={refreshing ? 'Atualizando' : 'Atualizar'} title="Atualizar"
          onClick={() => { if (userId) feedService.refresh(userId) }}>
          <RefreshIcon />
        </button>
        {categories.length > 0 && (
          <div className="news-pills" role="group" aria-label="Filtrar por categoria">
            {(['todos', ...categories] as Filter[]).map((option) => (
              <button key={option} type="button" className="news-pill" aria-pressed={activeFilter === option}
                onClick={() => setFilter(option)}>
                {option === 'todos' ? 'Todos' : categoryLabel(option, area)}
              </button>
            ))}
          </div>
        )}
      </div>

      {!feed && !error && <p aria-live="polite">Carregando…</p>}
      {/* Com feed guardado na tela, uma falha ao atualizar não apaga os artigos. */}
      {error && <p className={feed ? 'alert alert-warning' : 'alert'} role="alert">
        {feed ? 'Não foi possível atualizar o feed agora. Mostrando a última versão.' : error}
      </p>}
      {failed.length > 0 && (
        <p className="alert alert-warning">Não foi possível atualizar: {failed.join(', ')}.</p>
      )}
      {feed && items.length === 0 && (
        <section className="card">
          <h2>Nada por aqui</h2>
          <p>Nenhum artigo agora. Tente atualizar mais tarde.</p>
        </section>
      )}

      {featured && (
        <a className="news-hero" {...newsLink(featured)}>
          <NewsImage item={featured} />
          <div className="news-hero-text">
            <span className="news-kicker">Destaque · {categoryLabel(featured.category, area)}</span>
            <h2>{featured.title}</h2>
            <Meta item={featured} />
          </div>
        </a>
      )}

      {trending.length > 0 && (
        <section className="news-section" aria-labelledby="em-alta">
          <div className="news-section-head">
            <h2 id="em-alta">Em alta</h2>
          </div>
          <ul className="news-rail">
            {trending.map((item) => (
              <li key={item.id}>
                <a className="news-rail-card" {...newsLink(item)}>
                  <div className="news-media"><NewsImage item={item} /></div>
                  <h3>{item.title}</h3>
                  <Meta item={item} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {latest.length > 0 && (
        <section className="news-section" aria-labelledby="mais-recentes">
          <div className="news-section-head">
            <h2 id="mais-recentes">Mais recentes</h2>
            <p>Ordenadas pela data de publicação</p>
          </div>
          <ul className="news-list">
            {latest.map((item) => (
              <li key={item.id}>
                <a className="news-card" {...newsLink(item)}>
                  <div className="news-media"><NewsImage item={item} /></div>
                  <span className="news-kicker">{categoryLabel(item.category, area)}</span>
                  <h3>{item.title}</h3>
                  <Meta item={item} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
