import { createCachedResource } from '../lib/cached-resource'
import { getSupabase } from '../lib/supabase'
import type { EnrollmentStatus } from './admin-users'

export type SubjectStatus = 'cursando' | 'aprovado' | 'reprovado'

export type Subject = {
  id: number
  code: string
  name: string
  // Semestre da grade: a disciplina só pode ser cursada a partir dele.
  semester: number
  workloadHours: number
}

// Cada vez que o aluno cursou (ou está cursando) uma disciplina.
export type SubjectAttempt = {
  id: number
  subjectId: number
  takenSemester: number
  status: SubjectStatus
}

export type SubjectsOverview = {
  enrollment: {
    id: number
    courseName: string
    status: EnrollmentStatus
    currentSemester: number
  } | null
  subjects: Subject[]
  attempts: SubjectAttempt[]
}

export const subjectStatusLabels: Record<SubjectStatus, string> = {
  cursando: 'Cursando',
  aprovado: 'Aprovada',
  reprovado: 'Reprovada',
}

// Situação de uma disciplina da grade para o aluno: a tentativa mais recente decide.
export type SubjectSituation = SubjectStatus | 'disponivel' | 'futura'

export function situationOf(subject: Subject, attempts: SubjectAttempt[], currentSemester: number): {
  situation: SubjectSituation
  attempts: SubjectAttempt[]
} {
  const own = attempts
    .filter((attempt) => attempt.subjectId === subject.id)
    .sort((a, b) => a.takenSemester - b.takenSemester || a.id - b.id)
  const last = own.at(-1)
  if (last) return { situation: last.status, attempts: own }
  return { situation: subject.semester <= currentSemester ? 'disponivel' : 'futura', attempts: own }
}

// Lê com a sessão do próprio aluno; a RLS só devolve as disciplinas dele. Antes, aplica a virada de
// semestre (inclui as disciplinas do semestre novo e aprova as do semestre encerrado).
async function fetchOwn(userId: string): Promise<SubjectsOverview> {
  const supabase = getSupabase()
  const { error: syncError } = await supabase.rpc('sync_my_subjects')
  if (syncError) throw new Error('Não foi possível atualizar suas disciplinas.')

  const { data: enrollment, error } = await supabase
    .from('enrollment_details')
    .select('id, course_id, course_name, status, current_semester')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('Não foi possível carregar sua matrícula.')
  if (!enrollment) return { enrollment: null, subjects: [], attempts: [] }

  const [subjectsResult, attemptsResult] = await Promise.all([
    supabase.from('subjects').select('id, code, name, semester, workload_hours')
      .eq('course_id', enrollment.course_id).order('semester').order('code'),
    supabase.from('subject_enrollments').select('id, subject_id, taken_semester, status')
      .eq('enrollment_id', enrollment.id),
  ])
  if (subjectsResult.error || attemptsResult.error) throw new Error('Não foi possível carregar suas disciplinas.')

  return {
    enrollment: {
      id: enrollment.id,
      courseName: enrollment.course_name,
      status: enrollment.status,
      currentSemester: enrollment.current_semester,
    },
    subjects: subjectsResult.data.map((subject) => ({
      id: subject.id,
      code: subject.code,
      name: subject.name,
      semester: subject.semester,
      workloadHours: subject.workload_hours,
    })),
    attempts: attemptsResult.data.map((attempt) => ({
      id: attempt.id,
      subjectId: attempt.subject_id,
      takenSemester: attempt.taken_semester,
      status: attempt.status,
    })),
  }
}

// Como a carteirinha: guardado por um dia, refeito quando o administrador muda as disciplinas ou a
// matrícula (Realtime) e conferido ao abrir o app, quando a virada de semestre também é aplicada.
const resource = createCachedResource<SubjectsOverview>({
  name: 'subjects',
  maxAgeMs: 24 * 60 * 60 * 1000,
  load: fetchOwn,
})

export const subjectsService = {
  peek: resource.peek,
  subscribe: resource.subscribe,
  refresh: resource.refresh,
  watch: (userId: string) => {
    const supabase = getSupabase()
    const revalidate = () => resource.revalidate(userId)
    // Nome único por ligação, pelo mesmo motivo de studentCardService.watch.
    const channel = supabase
      .channel(`subjects:${userId}:${crypto.randomUUID()}`)
      // Sem filtro: a RLS só entrega eventos das disciplinas do próprio aluno.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subject_enrollments' }, revalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments', filter: `user_id=eq.${userId}` }, revalidate)
      .subscribe((status) => { if (status === 'SUBSCRIBED') revalidate() })
    return () => {
      supabase.removeChannel(channel)
      resource.reset()
    }
  },
}
