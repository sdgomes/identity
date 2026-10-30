// Feed da tela inicial: lê as fontes RSS/Atom abaixo e devolve os artigos já tratados,
// escolhidos pela área do curso em que o aluno está matriculado.
// Roda no servidor porque os sites não liberam CORS para o navegador.
// Nada é gravado: as fontes ficam no código e cada fonte lida só fica em memória por alguns minutos.
// Qualquer usuário autenticado pode chamar.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { XMLParser } from 'npm:fast-xml-parser@4.5.0'
import { decodeHTML } from 'npm:entities@4.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// area: notícias da área do curso; formacao: estudo e carreira na área; ensino: ensino superior em geral.
type Category = 'area' | 'formacao' | 'ensino'
type Source = { name: string, url: string }

type Area = {
  label: string
  // Códigos de public.courses.
  courses: string[]
  news: Source[]
  // Fontes dedicadas a estudo e carreira na área (opcional).
  learning?: Source[]
  // Notícias de ensino que citam a área também entram em "formacao". Comparadas sem acento e em minúsculas.
  keywords: RegExp
}

// Para incluir, trocar ou remover fontes e cursos, altere estas listas e republique a função.
const educationSources: Source[] = [
  { name: 'g1 Educação', url: 'https://g1.globo.com/rss/g1/educacao/' },
  { name: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/educacao/feed.xml' },
  { name: 'Jornal da USP', url: 'https://jornal.usp.br/feed/' },
]

const areas: Record<string, Area> = {
  ti: {
    label: 'Tecnologia da Informação',
    courses: ['ADS', 'GTI', 'RDC', 'CDD', 'CCO', 'ESW', 'SIN', 'ECDI', 'ESEG', 'EESW'],
    news: [
      { name: 'Tecnoblog', url: 'https://tecnoblog.net/feed/' },
      { name: 'Canaltech', url: 'https://canaltech.com.br/rss/' },
      { name: 'Olhar Digital', url: 'https://olhardigital.com.br/feed/' },
    ],
    learning: [
      { name: 'Alura', url: 'https://www.alura.com.br/artigos/rss' },
      { name: 'DEV Community', url: 'https://dev.to/feed/tag/braziliandevs' },
    ],
    keywords: /tecnologia|programa(cao|dor)|computacao|software|\bdados\b|inteligencia artificial|\bia\b|ciberseguranca|digital|\bti\b/,
  },
  negocios: {
    label: 'Gestão e Negócios',
    courses: ['ADM', 'CCT', 'GFI', 'GRH', 'LOG', 'MGP', 'MGE', 'MFC', 'MGPS'],
    news: [
      { name: 'Exame', url: 'https://exame.com/feed/' },
      { name: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' },
      { name: 'Agência Brasil Economia', url: 'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml' },
      { name: 'Contábeis', url: 'https://www.contabeis.com.br/rss/noticias/' },
      { name: 'Melhor RH', url: 'https://www.melhorrh.com.br/feed/' },
    ],
    keywords: /administracao|gestao|economia|financ|empreend|contab|mercado de trabalho|logistica|recursos humanos/,
  },
  comunicacao: {
    label: 'Comunicação e Design',
    courses: ['MKT', 'MMD', 'PUB', 'JOR', 'DGR'],
    news: [
      { name: 'Meio & Mensagem', url: 'https://www.meioemensagem.com.br/feed' },
      { name: 'B9', url: 'https://www.b9.com.br/feed/' },
      { name: 'Observatório da Imprensa', url: 'https://www.observatoriodaimprensa.com.br/feed/' },
    ],
    keywords: /comunicacao|jornalis|marketing|publicidade|design|midia|redes sociais/,
  },
  saude: {
    label: 'Saúde',
    courses: ['BMD', 'EFI', 'ENF', 'FAR', 'FIS', 'MED', 'VET', 'NUT', 'ODO', 'EUTI'],
    news: [
      { name: 'Agência Brasil Saúde', url: 'https://agenciabrasil.ebc.com.br/rss/saude/feed.xml' },
      { name: 'Agência Fiocruz', url: 'https://agencia.fiocruz.br/rss.xml' },
      { name: 'Medicina S/A', url: 'https://medicinasa.com.br/feed/' },
      { name: 'Saúde Business', url: 'https://saudebusiness.com/feed/' },
    ],
    keywords: /saude|medic|enfermag|residencia|revalida|farmac|odontolog|fisioterap|nutri(cao|cionista)|\bsus\b|hospital|veterinar|biomedic|educacao fisica/,
  },
  psicologia: {
    label: 'Psicologia',
    courses: ['PSI'],
    news: [
      { name: 'Conselho Federal de Psicologia', url: 'https://site.cfp.org.br/feed/' },
      { name: 'Psicologias do Brasil', url: 'https://www.psicologiasdobrasil.com.br/feed/' },
      { name: 'Agência Brasil Saúde', url: 'https://agenciabrasil.ebc.com.br/rss/saude/feed.xml' },
    ],
    keywords: /psicolog|saude mental|ansiedade|depressao|bem-estar/,
  },
  direito: {
    label: 'Direito',
    courses: ['DIR', 'EDTR', 'EDCP'],
    news: [
      { name: 'Conjur', url: 'https://www.conjur.com.br/rss.xml' },
      { name: 'JOTA', url: 'https://www.jota.info/feed' },
      { name: 'Agência Brasil Justiça', url: 'https://agenciabrasil.ebc.com.br/rss/justica/feed.xml' },
      { name: 'Jusbrasil', url: 'https://www.jusbrasil.com.br/noticias/rss' },
    ],
    keywords: /direito|juridic|\boab\b|advoca|\blei\b|\bstf\b|justica|tribunal/,
  },
  engenharia: {
    label: 'Engenharia e Arquitetura',
    courses: ['ARQ', 'ECV', 'EPR'],
    news: [
      { name: 'ArchDaily Brasil', url: 'https://www.archdaily.com.br/br/feed' },
      { name: 'CBIC', url: 'https://www.cbic.org.br/feed/' },
      { name: 'Engenharia É', url: 'https://www.engenhariae.com.br/feed' },
      { name: 'Inovação Tecnológica', url: 'https://www.inovacaotecnologica.com.br/boletim/rss.xml' },
    ],
    keywords: /engenhari|arquitet|construcao|urbanis|infraestrutura|\bcrea\b/,
  },
  educacao: {
    label: 'Educação',
    courses: ['PED', 'LET', 'HIS', 'MAT', 'EPSP', 'EDES'],
    news: [
      { name: 'Porvir', url: 'https://porvir.org/feed/' },
      { name: 'Todos Pela Educação', url: 'https://www.todospelaeducacao.org.br/feed/' },
    ],
    keywords: /professor|docen|licenciatura|pedagog|alfabetiza|escola|sala de aula|ensino/,
  },
  gastronomia: {
    label: 'Gastronomia',
    courses: ['GAS'],
    news: [
      { name: 'Food Connection', url: 'https://www.foodconnection.com.br/feed' },
      { name: 'Gastronomia & Negócios', url: 'https://www.gastronomiaenegocios.com.br/feed/' },
    ],
    keywords: /gastronom|culinari|alimenta|\bchef\b|restaurante|cozinha/,
  },
  internacional: {
    label: 'Relações Internacionais',
    courses: ['REI'],
    news: [
      { name: 'Agência Brasil Internacional', url: 'https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml' },
      { name: 'Le Monde Diplomatique Brasil', url: 'https://diplomatique.org.br/feed/' },
      { name: 'Poder360', url: 'https://www.poder360.com.br/feed/' },
    ],
    keywords: /internacional|intercambio|exterior|diplomac|idioma|\bonu\b/,
  },
}

type FeedItem = {
  id: string
  title: string
  summary: string
  link: string
  imageUrl: string | null
  publishedAt: string | null
  source: string
  category: Category
}

// deno-lint-ignore no-explicit-any
type Node = any

const CACHE_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 8000
const ITEMS_PER_SOURCE = 12
const MAX_ITEMS = 80
const SUMMARY_LENGTH = 220

// Cache por fonte: áreas diferentes compartilham fontes (ex.: ensino superior) sem buscar de novo.
const cache = new Map<string, { at: number, items: FeedItem[] }>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Cliente com o token de quem chama: a RLS só devolve a matrícula do próprio aluno.
function supabaseFor(token: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  )
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  // Mesmo com um único item ou link, o resultado vem como lista.
  isArray: (name) => ['item', 'entry', 'link', 'media:content', 'media:thumbnail', 'enclosure'].includes(name),
})

function text(node: Node): string {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return text(node[0])
  return text(node['#text'])
}

// Descrições trazem HTML (às vezes escapado duas vezes); o card mostra só texto corrido.
function plainText(html: string) {
  const decoded = decodeHTML(html)
    // Legendas de imagem e scripts não são texto do artigo.
    .replace(/<(figure|figcaption|script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    // Atributos entre aspas podem conter ">".
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' ')
  return decodeHTML(decoded)
    // Rodapé padrão do WordPress: "O post X apareceu primeiro em Y."
    .replace(/O post .+? apareceu primeiro em [^.]*\.?/gs, '')
    .replace(/\s+/g, ' ')
    // Tags inline viram espaço; ele não pode sobrar antes da pontuação.
    .replace(/\s+([.,;:!?)])/g, '$1')
    .trim()
}

// Alguns sites repetem o título como link no fim da descrição.
function summaryOf(entry: Node, title: string) {
  const candidates = [text(entry['atom:subtitle']), text(entry.description), text(entry.summary), text(entry['content:encoded'])]
  for (const candidate of candidates) {
    const summary = plainText(candidate).replace(new RegExp(`\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '')
    if (summary) return truncate(summary)
  }
  return ''
}

function truncate(value: string) {
  if (value.length <= SUMMARY_LENGTH) return value
  return `${value.slice(0, SUMMARY_LENGTH).replace(/\s+\S*$/, '')}…`
}

// Logos em SVG e ícones do tema/plugins do WordPress (ex.: logo da loja em posts de oferta) não ilustram o artigo.
function isUsableImage(url: string) {
  return /^https:\/\//i.test(url) && !/\.svg(\?|$)/i.test(url) && !/\/wp-content\/(themes|plugins)\//i.test(url)
}

// Primeira imagem real do HTML, ignorando também pixels de rastreamento.
function firstImage(html: string) {
  for (const match of decodeHTML(html).matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0]
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1]
    if (!src || /width=["']?1["'\s>]|width:\s*1px/i.test(tag)) continue
    if (isUsableImage(src)) return src
  }
  return null
}

// media:content também traz vídeos (ex.: embed do YouTube); só serve o que é imagem.
function isImageMedia(item: Node) {
  const url = item?.['@_url']
  if (typeof url !== 'string' || !isUsableImage(url)) return false
  if (item['@_medium']) return item['@_medium'] === 'image'
  if (item['@_type']) return String(item['@_type']).startsWith('image/')
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url)
}

function imageOf(entry: Node) {
  const media = [...(entry['media:content'] ?? []), ...(entry['media:thumbnail'] ?? [])].find(isImageMedia)
  if (media) return media['@_url'] as string
  const enclosure = (entry.enclosure ?? []).find((item: Node) => String(item?.['@_type'] ?? '').startsWith('image/'))
  if (enclosure?.['@_url']) return enclosure['@_url'] as string
  // Campo próprio da Agência Brasil.
  const featured = text(entry['imagem-destaque'])
  if (featured) return featured
  return firstImage(text(entry['content:encoded'])) ?? firstImage(text(entry.description) || text(entry.content))
}

function linkOf(entry: Node) {
  for (const link of entry.link ?? []) {
    if (typeof link === 'string') return link.trim()
    // Atom: <link rel="alternate" href="..."/>
    if (link?.['@_href'] && (!link['@_rel'] || link['@_rel'] === 'alternate')) return link['@_href'] as string
  }
  return ''
}

function dateOf(entry: Node) {
  const raw = text(entry.pubDate) || text(entry.published) || text(entry.updated) || text(entry['dc:date'])
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function parseFeed(xml: string, source: Source): Omit<FeedItem, 'category'>[] {
  const document = parser.parse(xml)
  const entries: Node[] = document.rss?.channel?.item ?? document['rdf:RDF']?.item ?? document.feed?.entry ?? []
  return entries.slice(0, ITEMS_PER_SOURCE).flatMap((entry) => {
    const title = plainText(text(entry.title))
    const link = linkOf(entry)
    if (!title || !/^https?:\/\//i.test(link)) return []
    return [{
      id: link,
      title,
      summary: summaryOf(entry, title),
      link,
      imageUrl: imageOf(entry),
      publishedAt: dateOf(entry),
      source: source.name,
    }]
  })
}

async function loadSource(source: Source) {
  const cached = cache.get(source.url)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.items
  const response = await fetch(source.url, {
    headers: { 'User-Agent': 'IdentityFeed/1.0 (+https://supabase.com)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const items = parseFeed(await response.text(), source)
  cache.set(source.url, { at: Date.now(), items })
  return items
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function areaOf(courseCode: string | null) {
  const key = Object.keys(areas).find((areaKey) => courseCode && areas[areaKey].courses.includes(courseCode))
  return key ? { key, ...areas[key] } : null
}

async function buildFeed(area: ReturnType<typeof areaOf>) {
  const groups: { category: Category, sources: Source[] }[] = [
    { category: 'area', sources: area?.news ?? [] },
    { category: 'formacao', sources: area?.learning ?? [] },
    { category: 'ensino', sources: educationSources },
  ]
  const sources = groups.flatMap((group) => group.sources.map((source) => ({ ...source, category: group.category })))

  // Uma fonte fora do ar não derruba o feed: ela só fica de fora desta vez.
  const results = await Promise.allSettled(sources.map(loadSource))
  const failedSources = sources.filter((_, index) => results[index].status === 'rejected').map((source) => source.name)

  const seen = new Set<string>()
  const items = results
    .flatMap((result, index) => result.status === 'fulfilled'
      ? result.value.map((item): FeedItem => {
          const category = sources[index].category
          // Notícia de ensino que fala da área do aluno vira "estudo e carreira na área".
          const aboutArea = category === 'ensino' && area?.keywords.test(normalize(`${item.title} ${item.summary}`))
          return { ...item, category: aboutArea ? 'formacao' : category }
        })
      : [])
    .filter((item) => !seen.has(item.link) && seen.add(item.link))
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, MAX_ITEMS)
  return { area: area ? { key: area.key, label: area.label } : null, items, failedSources: [...new Set(failedSources)] }
}

// Curso da matrícula mais recente do aluno; sem matrícula, o feed mostra só ensino superior.
async function courseCodeOf(token: string, userId: string) {
  const { data } = await supabaseFor(token)
    .from('enrollment_details')
    .select('course_code')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.course_code as string | undefined) ?? null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const { data: userData } = token ? await supabaseFor(token).auth.getUser(token) : { data: { user: null } }
  if (!token || !userData.user) return json({ error: 'Faça login para ver o feed.' }, 401)

  try {
    return json(await buildFeed(areaOf(await courseCodeOf(token, userData.user.id))))
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Não foi possível montar o feed.' }, 500)
  }
})
