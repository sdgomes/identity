import { createCachedResource } from '../lib/cached-resource'
import { getSupabase } from '../lib/supabase'
import type { EnrollmentStatus } from './admin-users'
import type { Shift } from './catalog'

export type StudentCard = {
  fullName: string | null
  cpf: string | null
  birthDate: string | null
  shift: Shift | null
  campus: { name: string, code: string } | null
  avatarPath: string | null
  // A foto vai como data URL dentro do cache: não depende de URL assinada, que expira.
  avatarUrl: string | null
  enrollment: {
    number: number
    ra: string
    courseName: string
    courseLevel: 'graduacao' | 'pos_graduacao'
    classGroupCode: string | null
    status: EnrollmentStatus
    // Data de ingresso no curso: a data em que a matrícula foi feita.
    startsOn: string
    validUntil: string
    currentSemester: number
    totalSemesters: number
  } | null
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function downloadAvatar(path: string) {
  const { data, error } = await getSupabase().storage.from('avatars').download(path)
  return error ? null : blobToDataUrl(data)
}

// Tudo é lido com a sessão do próprio aluno; a RLS só devolve os dados dele.
async function fetchOwn(userId: string, previous: StudentCard | null): Promise<StudentCard> {
  const supabase = getSupabase()
  const [profileResult, enrollmentResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, cpf, birth_date, shift, avatar_path, campus:campuses(name, code)')
      .eq('id', userId)
      .single(),
    // A matrícula mais recente é a atual (ou a última, se estiver vencida).
    supabase
      .from('enrollment_details')
      .select('number, ra, course_name, course_level, class_group_code, status, starts_on, valid_until, current_semester, total_semesters')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (profileResult.error) throw new Error('Não foi possível carregar seus dados.')
  if (enrollmentResult.error) throw new Error('Não foi possível carregar sua matrícula.')

  const profile = profileResult.data
  const enrollment = enrollmentResult.data
  const campus = Array.isArray(profile.campus) ? profile.campus[0] : profile.campus
  // A foto só é baixada de novo quando o arquivo muda.
  const avatarUrl = !profile.avatar_path
    ? null
    : profile.avatar_path === previous?.avatarPath && previous.avatarUrl
      ? previous.avatarUrl
      : await downloadAvatar(profile.avatar_path)

  return {
    fullName: profile.full_name,
    cpf: profile.cpf,
    birthDate: profile.birth_date,
    shift: profile.shift,
    campus: campus ?? null,
    avatarPath: profile.avatar_path,
    avatarUrl,
    enrollment: enrollment
      ? {
          number: enrollment.number,
          ra: enrollment.ra,
          courseName: enrollment.course_name,
          courseLevel: enrollment.course_level,
          classGroupCode: enrollment.class_group_code,
          status: enrollment.status,
          startsOn: enrollment.starts_on,
          validUntil: enrollment.valid_until,
          currentSemester: enrollment.current_semester,
          totalSemesters: enrollment.total_semesters,
        }
      : null,
  }
}

// O cache vale um dia. Antes disso ele só é refeito quando o perfil ou a matrícula mudam
// (Realtime) ou quando o app abre ou reconecta, para pegar o que mudou com ele fechado.
const resource = createCachedResource<StudentCard>({
  name: 'student-card',
  maxAgeMs: 24 * 60 * 60 * 1000,
  load: fetchOwn,
})

export const studentCardService = {
  peek: resource.peek,
  subscribe: resource.subscribe,
  refresh: resource.refresh,
  // Enquanto o app está aberto, mudanças no perfil ou na matrícula do aluno atualizam o cache sozinhas.
  // Só age se a carteirinha já foi aberta alguma vez: sem cache não há o que manter em dia.
  watch: (userId: string) => {
    const supabase = getSupabase()
    const revalidate = () => resource.revalidate(userId)
    // Nome único por ligação: o cliente reaproveita um canal de mesmo nome que ainda está sendo removido
    // (StrictMode, logout e login rápidos), e esse canal deixa de receber os eventos.
    const channel = supabase
      .channel(`student-card:${userId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, revalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments', filter: `user_id=eq.${userId}` }, revalidate)
      // Ao conectar (abrir o app) ou reconectar, confere o que pode ter mudado enquanto estava desconectado.
      .subscribe((status) => { if (status === 'SUBSCRIBED') revalidate() })
    return () => {
      supabase.removeChannel(channel)
      resource.reset()
    }
  },
}
