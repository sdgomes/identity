import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'
import { authService } from './auth'
import type { Shift } from './catalog'
import type { Role } from './profiles'
import type { SubjectsOverview, SubjectStatus } from './subjects'

export type EnrollmentStatus = 'matriculado' | 'trancado' | 'vencida' | 'substituida'

export type Enrollment = {
  id: number
  number: number
  ra: string
  courseId: number
  courseCode: string
  courseName: string
  classGroupCode: string | null
  status: EnrollmentStatus
  startsOn: string
  validUntil: string
  currentSemester: number
  totalSemesters: number
}

export type AdminUser = {
  id: string
  email: string | null
  fullName: string | null
  role: Role
  cpf: string | null
  birthDate: string | null
  avatarPath: string | null
  avatarUrl: string | null
  campusId: number | null
  shift: Shift | null
  createdAt: string
  lastSignInAt: string | null
  enrollment: Enrollment | null
}

export type ProfileFields = {
  fullName: string
  role: Role
  cpf: string
  birthDate: string
  campusId: number
  shift: Shift
}

export type NewUser = ProfileFields & {
  email: string
  password: string
  courseId: number
}

// Senha vazia mantém a atual; avatarPath ausente mantém a foto.
export type UserChanges = ProfileFields & {
  email: string
  password?: string
  avatarPath?: string | null
}

export const statusLabels: Record<EnrollmentStatus, string> = {
  matriculado: 'Matriculado',
  trancado: 'Trancado',
  vencida: 'Vencida',
  substituida: 'Substituída',
}

export function isCurrent(enrollment: Enrollment | null): enrollment is Enrollment {
  return enrollment?.status === 'matriculado' || enrollment?.status === 'trancado'
}

// Criar e remover usuários exige a service role, por isso passa pela Edge Function admin-users.
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke<T>('admin-users', { body })
  if (error) {
    // Sem resposta legível (função não publicada, CORS, rede), o navegador não expõe o motivo.
    if (error instanceof FunctionsFetchError) {
      throw new Error('Não foi possível acessar o serviço de administração. Verifique se a função admin-users está publicada.')
    }
    // 401/403: pode ser sessão revogada, e não falta de permissão. verifySession leva ao login nesse caso.
    if (error instanceof FunctionsHttpError && [401, 403].includes(error.context.status) && !await authService.verifySession()) {
      throw new Error('Sua sessão terminou. Entre novamente.')
    }
    // A função responde { error }; o gateway do Supabase responde { message }.
    const body = error instanceof FunctionsHttpError
      ? await error.context.json().catch(() => null)
      : null
    throw new Error(body?.error ?? body?.message ?? 'Não foi possível concluir a operação.')
  }
  return data as T
}

export const adminUsersService = {
  list: () => invoke<{ users: AdminUser[] }>({ action: 'list' }).then((result) => result.users),
  create: (user: NewUser) => invoke<{ id: string }>({ action: 'create', ...user }),
  update: (userId: string, changes: UserChanges) =>
    invoke<{ ok: true }>({ action: 'update', userId, ...changes }),
  // Matricula, renova ou troca de curso; a matrícula vigente é substituída.
  enroll: (userId: string, courseId: number) =>
    invoke<{ number: number }>({ action: 'enroll', userId, courseId }),
  setStatus: (enrollmentId: number, status: 'matriculado' | 'trancado') =>
    invoke<{ ok: true }>({ action: 'setStatus', enrollmentId, status }),
  remove: (userId: string) => invoke<{ ok: true }>({ action: 'delete', userId }),
  // Grade do curso da matrícula mais recente e o que o aluno cursou nela.
  subjects: (userId: string) => invoke<SubjectsOverview>({ action: 'subjects', userId }),
  addSubject: (enrollmentId: number, subjectId: number) =>
    invoke<{ ok: true }>({ action: 'addSubject', enrollmentId, subjectId }),
  removeSubject: (subjectEnrollmentId: number) =>
    invoke<{ ok: true }>({ action: 'removeSubject', subjectEnrollmentId }),
  setSubjectStatus: (subjectEnrollmentId: number, status: SubjectStatus) =>
    invoke<{ ok: true }>({ action: 'setSubjectStatus', subjectEnrollmentId, status }),
  // Upload direto no Storage; a política do bucket só aceita administradores.
  uploadAvatar: async (userId: string, file: File) => {
    const extension = file.type.split('/')[1] ?? 'jpg'
    const path = `${userId}/${Date.now()}.${extension}`
    const { error } = await getSupabase().storage.from('avatars').upload(path, file, { contentType: file.type })
    if (error) throw new Error('Não foi possível enviar a foto.')
    return path
  },
}
