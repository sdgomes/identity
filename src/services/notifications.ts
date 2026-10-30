import { localCache } from '../lib/local-cache'
import { subjectsService, type SubjectsOverview } from './subjects'

// Notificações de demonstração: não vêm do servidor. A cada login a lista é sorteada de novo:
// ela fica no localStorage por usuário (recarregar a página não muda nada) e é apagada no logout,
// como o resto do cache, então o próximo login sorteia outra.

export type Notification = {
  id: string
  title: string
  body: string
  createdAt: string
  read: boolean
}

// Em cada login há 1 chance em CHANCE de chegar, além da lista sorteada, uma notificação nova
// sobre o curso, o semestre ou uma disciplina em curso do aluno.
const CHANCE = 500
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ITEMS = 30

// "v3": a lista inicial passou a ser sorteada; quem já tinha a antiga recebe a nova.
const cacheKey = (userId: string) => `notifications:v3:${userId}`

let state: { userId: string, items: Notification[] } | null = null
const listeners = new Set<() => void>()

function minutesAgo(minutes: number, now = Date.now()) {
  return new Date(now - minutes * 60 * 1000).toISOString()
}

const samples: [title: string, body: string][] = [
  ['Pedido concluído na secretaria', 'Sua declaração de matrícula (SEC-2026-04187) foi enviada para o seu e-mail.'],
  ['Biblioteca: devolução em 2 dias', 'Um dos seus empréstimos vence na sexta. Renove pelo acervo digital.'],
  ['Semana acadêmica: inscrições abertas', 'Palestras, oficinas e minicursos com certificado de horas complementares.'],
  ['Calendário acadêmico publicado', 'Confira as datas de provas, feriados e rematrícula do semestre.'],
  ['Pesquisa de avaliação institucional', 'Responda até o fim do mês e ajude a melhorar o curso. Leva 5 minutos.'],
  ['Feriado na próxima semana', 'Não haverá aulas na quinta-feira. As atividades serão repostas conforme o calendário.'],
  ['Atualize seus dados cadastrais', 'Confira seu e-mail e telefone para não perder comunicados da instituição.'],
  ['Vagas de estágio no mural', 'Empresas parceiras publicaram novas oportunidades para alunos do seu polo.'],
  ['Manutenção programada', 'O ambiente virtual ficará fora do ar no domingo, das 2h às 6h.'],
  ['Horas complementares', 'Lembre-se de enviar os certificados de atividades até o fim do semestre.'],
]

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

// Lista de um login: de 3 a 8 notificações, sorteadas e espalhadas pela última semana.
// As mais recentes (de nenhuma a 3) ficam como não lidas: às vezes tudo já está lido.
function loginList(): Notification[] {
  const count = randomInt(3, 8)
  const unread = randomInt(0, 3)
  const chosen = [...samples].sort(() => Math.random() - 0.5).slice(0, count)
  const ages = chosen.map(() => randomInt(10, 7 * 24 * 60)).sort((a, b) => a - b)
  // Um só "agora" para todas: idades iguais não podem trocar de ordem por milissegundos.
  const now = Date.now()
  return chosen.map(([title, body], index) => ({
    id: crypto.randomUUID(),
    title,
    body,
    createdAt: minutesAgo(ages[index], now),
    read: index >= unread,
  }))
}

function items(userId: string) {
  if (state?.userId !== userId) {
    const saved = localCache.read<Notification[]>(cacheKey(userId), MAX_AGE_MS)?.value
    if (saved) {
      state = { userId, items: saved }
    } else {
      // Sem lista guardada é um login novo (o logout apaga a anterior): sorteia e grava na hora,
      // para não mudar a cada recarregamento.
      state = { userId, items: localCache.write(cacheKey(userId), loginList()).value }
      // Fora da renderização: a entrega é assíncrona e avisa as telas quando termina.
      if (randomInt(1, CHANCE) === 1) queueMicrotask(() => deliver(userId))
    }
  }
  return state.items
}

function save(userId: string, next: Notification[]) {
  state = { userId, items: next.slice(0, MAX_ITEMS) }
  localCache.write(cacheKey(userId), state.items)
  listeners.forEach((listener) => listener())
}

function pick<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)]
}

// Monta uma notificação com o curso, o semestre e as disciplinas em curso do aluno.
function compose(overview: SubjectsOverview | null): Omit<Notification, 'id' | 'createdAt' | 'read'> {
  const enrollment = overview?.enrollment
  const current = overview?.subjects.filter((subject) => overview.attempts.some(
    (attempt) => attempt.subjectId === subject.id && attempt.status === 'cursando',
  )) ?? []
  const subject = current.length ? pick(current).name : null
  const course = enrollment?.courseName ?? null

  const options = [
    subject && { title: `Nova atividade em ${subject}`, body: 'O professor publicou uma atividade. A entrega é em 7 dias.' },
    subject && { title: `Material disponível: ${subject}`, body: 'Slides e leituras da próxima aula já estão no ambiente virtual.' },
    subject && { title: `Avaliação agendada em ${subject}`, body: 'A prova foi marcada para daqui a duas semanas. Bons estudos!' },
    subject && { title: `Aula de ${subject} remarcada`, body: 'A aula desta semana mudou de horário. Confira com a coordenação.' },
    course && { title: `Aviso da coordenação de ${course}`, body: 'Há uma nova comunicação do curso no mural do seu polo.' },
    course && { title: `Palestra para alunos de ${course}`, body: 'Inscrições abertas para o ciclo de palestras com profissionais da área.' },
    enrollment && { title: `Você está no ${enrollment.currentSemester}º semestre`, body: 'Acompanhe suas disciplinas e sua situação na tela Disciplinas.' },
    { title: 'Biblioteca: novos títulos', body: 'Chegaram novos livros e periódicos ao acervo digital.' },
  ].filter((option): option is { title: string, body: string } => Boolean(option))
  return pick(options)
}

async function deliver(userId: string) {
  // Usa as disciplinas guardadas; sem cache, busca uma vez (o sorteio raramente acerta).
  const overview = subjectsService.peek(userId)?.value
    ?? await subjectsService.refresh(userId).catch(() => null)
  save(userId, [
    { id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false, ...compose(overview) },
    ...items(userId),
  ])
}

export const notificationsService = {
  list: (userId: string) => items(userId),
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  markRead: (userId: string, id: string) =>
    save(userId, items(userId).map((item) => (item.id === id ? { ...item, read: true } : item))),
  markAllRead: (userId: string) =>
    save(userId, items(userId).map((item) => (item.read ? item : { ...item, read: true }))),
  // Esquece a lista em memória no logout, para o próximo login sortear outra.
  reset: () => { state = null },
  // Entrega uma notificação na hora, sem esperar o sorteio (testes e demonstrações).
  simulate: (userId: string) => deliver(userId),
}
