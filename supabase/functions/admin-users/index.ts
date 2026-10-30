// Operações administrativas sobre usuários do Supabase Auth.
// Roda no servidor com a service role, que nunca pode ir para o frontend.
// Toda chamada confere se quem pede é um usuário autenticado com papel admin.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Role = 'user' | 'admin'
type Shift = 'matutino' | 'vespertino' | 'noturno'

type ProfileFields = {
  fullName?: string
  role?: Role
  cpf?: string
  birthDate?: string
  campusId?: number
  shift?: Shift
}

type Payload =
  | { action: 'list' }
  | ({ action: 'create', email: string, password: string, courseId: number } & ProfileFields)
  | ({ action: 'update', userId: string, email?: string, password?: string, avatarPath?: string | null } & ProfileFields)
  | { action: 'enroll', userId: string, courseId: number }
  | { action: 'setStatus', enrollmentId: number, status: 'matriculado' | 'trancado' }
  | { action: 'delete', userId: string }
  | { action: 'subjects', userId: string }
  | { action: 'addSubject', enrollmentId: number, subjectId: number }
  | { action: 'removeSubject', subjectEnrollmentId: number }
  | { action: 'setSubjectStatus', subjectEnrollmentId: number, status: 'cursando' | 'aprovado' | 'reprovado' }

const shifts: Shift[] = ['matutino', 'vespertino', 'noturno']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

async function requireAdmin(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return null

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()
  return profile?.role === 'admin' ? userData.user : null
}

function onlyDigits(value: string | undefined) {
  return (value ?? '').replace(/\D/g, '')
}

// Mesma regra de public.is_valid_cpf: 11 dígitos, não repetidos, dígitos verificadores corretos.
function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const digits = cpf.split('').map(Number)
  for (const position of [9, 10]) {
    const sum = digits.slice(0, position).reduce((total, digit, index) => total + digit * (position + 1 - index), 0)
    if ((sum * 10) % 11 % 10 !== digits[position]) return false
  }
  return true
}

// Erros de unicidade do Postgres viram mensagens legíveis.
function friendlyError(error: { code?: string, message: string }) {
  if (error.code === '23505' && error.message.includes('cpf')) return 'Este CPF já está cadastrado.'
  return error.message
}

// Todo usuário precisa de nome, CPF, nascimento, polo e turno.
function validateProfile(fields: ProfileFields): string | null {
  if (!fields.fullName?.trim()) return 'Informe o nome completo.'
  if (!isValidCpf(onlyDigits(fields.cpf))) return 'Informe um CPF válido.'
  if (!fields.birthDate || Number.isNaN(Date.parse(fields.birthDate)) || new Date(fields.birthDate) > new Date()) {
    return 'Informe uma data de nascimento válida.'
  }
  if (!fields.campusId) return 'Selecione o polo.'
  if (!fields.shift || !shifts.includes(fields.shift)) return 'Selecione o turno.'
  return null
}

function profileColumns(fields: ProfileFields) {
  return {
    full_name: fields.fullName!.trim(),
    cpf: onlyDigits(fields.cpf),
    birth_date: fields.birthDate,
    campus_id: fields.campusId,
    shift: fields.shift,
  }
}

async function listUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return json({ error: error.message }, 500)

  const [profilesResult, enrollmentsResult] = await Promise.all([
    admin.from('profiles').select('id, full_name, role, cpf, birth_date, avatar_path, campus_id, shift'),
    admin.from('enrollment_details').select('*').order('created_at', { ascending: false }),
  ])
  if (profilesResult.error) return json({ error: profilesResult.error.message }, 500)
  if (enrollmentsResult.error) return json({ error: enrollmentsResult.error.message }, 500)

  const profileById = new Map(profilesResult.data.map((profile) => [profile.id, profile]))
  // A lista vem da mais recente para a mais antiga: a primeira de cada usuário é a atual.
  const enrollmentByUser = new Map<string, Record<string, unknown>>()
  for (const enrollment of enrollmentsResult.data) {
    if (!enrollmentByUser.has(enrollment.user_id)) enrollmentByUser.set(enrollment.user_id, enrollment)
  }

  const avatarPaths = profilesResult.data.map((profile) => profile.avatar_path).filter(Boolean) as string[]
  const avatarUrls = new Map<string, string>()
  if (avatarPaths.length) {
    const { data: signed } = await admin.storage.from('avatars').createSignedUrls(avatarPaths, 3600)
    for (const item of signed ?? []) if (item.path && item.signedUrl) avatarUrls.set(item.path, item.signedUrl)
  }

  const users = data.users.map((user) => {
    const profile = profileById.get(user.id)
    const enrollment = enrollmentByUser.get(user.id)
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      role: (profile?.role ?? 'user') as Role,
      cpf: profile?.cpf ?? null,
      birthDate: profile?.birth_date ?? null,
      avatarPath: profile?.avatar_path ?? null,
      avatarUrl: profile?.avatar_path ? avatarUrls.get(profile.avatar_path) ?? null : null,
      campusId: profile?.campus_id ?? null,
      shift: profile?.shift ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      enrollment: enrollment
        ? {
            id: enrollment.id,
            number: enrollment.number,
            ra: enrollment.ra,
            courseId: enrollment.course_id,
            courseCode: enrollment.course_code,
            courseName: enrollment.course_name,
            classGroupCode: enrollment.class_group_code,
            status: enrollment.status,
            startsOn: enrollment.starts_on,
            validUntil: enrollment.valid_until,
            currentSemester: enrollment.current_semester,
            totalSemesters: enrollment.total_semesters,
          }
        : null,
    }
  })
  return json({ users })
}

async function createUser(payload: Extract<Payload, { action: 'create' }>) {
  const email = payload.email?.trim()
  const role: Role = payload.role === 'admin' ? 'admin' : 'user'
  if (!email || !payload.password || payload.password.length < 8) {
    return json({ error: 'Informe e-mail e senha com pelo menos 8 caracteres.' }, 400)
  }
  const invalid = validateProfile(payload)
  if (invalid) return json({ error: invalid }, 400)
  if (!payload.courseId) return json({ error: 'Selecione o curso.' }, 400)

  // O gatilho on_auth_user_created cria o perfil com full_name e papel user.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: payload.password,
    email_confirm: true,
    user_metadata: { full_name: payload.fullName!.trim() },
  })
  if (error) return json({ error: error.message }, 400)
  const userId = data.user.id

  const { error: profileError } = await admin
    .from('profiles')
    .update({ ...profileColumns(payload), role })
    .eq('id', userId)
  const { error: enrollError } = profileError
    ? { error: profileError }
    : await admin.rpc('enroll_user', { p_user_id: userId, p_course_id: payload.courseId })

  // Sem perfil completo ou sem vaga, o cadastro não fica pela metade.
  if (enrollError) {
    await admin.auth.admin.deleteUser(userId)
    return json({ error: friendlyError(enrollError) }, 400)
  }
  return json({ id: userId }, 201)
}

async function updateUser(payload: Extract<Payload, { action: 'update' }>, requesterId: string) {
  if (!payload.userId) return json({ error: 'Informe o usuário.' }, 400)
  const email = payload.email?.trim()
  const role = payload.role === 'admin' || payload.role === 'user' ? payload.role : undefined
  if (payload.password && payload.password.length < 8) {
    return json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' }, 400)
  }
  const invalid = validateProfile(payload)
  if (invalid) return json({ error: invalid }, 400)
  // Evita que o último acesso administrativo seja perdido por engano.
  if (payload.userId === requesterId && role === 'user') {
    return json({ error: 'Você não pode remover o próprio acesso de administrador.' }, 400)
  }

  const { error } = await admin.auth.admin.updateUserById(payload.userId, {
    ...(email ? { email, email_confirm: true } : {}),
    ...(payload.password ? { password: payload.password } : {}),
    user_metadata: { full_name: payload.fullName!.trim() },
  })
  if (error) return json({ error: error.message }, 400)

  const { data: current } = await admin.from('profiles').select('avatar_path').eq('id', payload.userId).single()
  const avatarChanged = payload.avatarPath !== undefined && payload.avatarPath !== current?.avatar_path
  if (avatarChanged && payload.avatarPath && !payload.avatarPath.startsWith(`${payload.userId}/`)) {
    return json({ error: 'Foto inválida para este usuário.' }, 400)
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      ...profileColumns(payload),
      ...(role ? { role } : {}),
      ...(avatarChanged ? { avatar_path: payload.avatarPath } : {}),
    })
    .eq('id', payload.userId)
  if (profileError) return json({ error: friendlyError(profileError) }, 400)

  // A foto anterior deixa de ser usada; removê-la evita guardar imagem pessoal sem necessidade.
  if (avatarChanged && current?.avatar_path) {
    await admin.storage.from('avatars').remove([current.avatar_path])
  }
  return json({ ok: true })
}

async function enrollUser(payload: Extract<Payload, { action: 'enroll' }>) {
  if (!payload.userId || !payload.courseId) return json({ error: 'Informe o usuário e o curso.' }, 400)
  const { data, error } = await admin.rpc('enroll_user', { p_user_id: payload.userId, p_course_id: payload.courseId })
  if (error) return json({ error: error.message }, 400)
  return json({ number: data.number }, 201)
}

async function setStatus(payload: Extract<Payload, { action: 'setStatus' }>) {
  const { error } = await admin.rpc('set_enrollment_status', {
    p_enrollment_id: payload.enrollmentId,
    p_status: payload.status,
  })
  if (error) return json({ error: error.message }, 400)
  return json({ ok: true })
}

async function deleteUser(payload: Extract<Payload, { action: 'delete' }>, requesterId: string) {
  if (!payload.userId) return json({ error: 'Informe o usuário.' }, 400)
  if (payload.userId === requesterId) {
    return json({ error: 'Você não pode remover o próprio usuário.' }, 400)
  }

  const { data: profile } = await admin.from('profiles').select('avatar_path').eq('id', payload.userId).single()
  // O perfil e as matrículas são removidos em cascata junto com auth.users.
  const { error } = await admin.auth.admin.deleteUser(payload.userId)
  if (error) return json({ error: error.message }, 400)
  if (profile?.avatar_path) await admin.storage.from('avatars').remove([profile.avatar_path])
  return json({ ok: true })
}

// Grade do curso da matrícula mais recente e tudo o que o aluno já cursou nela.
async function listSubjects(payload: Extract<Payload, { action: 'subjects' }>) {
  if (!payload.userId) return json({ error: 'Informe o usuário.' }, 400)
  const { data: enrollment, error } = await admin
    .from('enrollment_details')
    .select('id, course_id, course_name, status, current_semester')
    .eq('user_id', payload.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!enrollment) return json({ enrollment: null, subjects: [], attempts: [] })

  const [subjectsResult, attemptsResult] = await Promise.all([
    admin.from('subjects').select('id, code, name, semester, workload_hours')
      .eq('course_id', enrollment.course_id).order('semester').order('code'),
    admin.from('subject_enrollments').select('id, subject_id, taken_semester, status')
      .eq('enrollment_id', enrollment.id).order('taken_semester').order('id'),
  ])
  if (subjectsResult.error) return json({ error: subjectsResult.error.message }, 500)
  if (attemptsResult.error) return json({ error: attemptsResult.error.message }, 500)

  return json({
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
  })
}

async function addSubject(payload: Extract<Payload, { action: 'addSubject' }>) {
  const { error } = await admin.rpc('add_subject_enrollment', {
    p_enrollment_id: payload.enrollmentId,
    p_subject_id: payload.subjectId,
  })
  if (error) return json({ error: error.message }, 400)
  return json({ ok: true }, 201)
}

async function removeSubject(payload: Extract<Payload, { action: 'removeSubject' }>) {
  const { error } = await admin.rpc('remove_subject_enrollment', { p_id: payload.subjectEnrollmentId })
  if (error) return json({ error: error.message }, 400)
  return json({ ok: true })
}

async function setSubjectStatus(payload: Extract<Payload, { action: 'setSubjectStatus' }>) {
  const { error } = await admin.rpc('set_subject_status', {
    p_id: payload.subjectEnrollmentId,
    p_status: payload.status,
  })
  if (error) return json({ error: error.message }, 400)
  return json({ ok: true })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const requester = await requireAdmin(request)
  if (!requester) return json({ error: 'Acesso restrito a administradores.' }, 403)

  let payload: Payload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Corpo da requisição inválido.' }, 400)
  }

  // Matrículas que passaram da vigência viram vencidas e liberam a vaga antes de qualquer operação.
  const { error: expireError } = await admin.rpc('expire_enrollments')
  if (expireError) return json({ error: expireError.message }, 500)
  // Virada de semestre nas disciplinas: inclui as do semestre novo e aprova as do semestre encerrado.
  const { error: syncError } = await admin.rpc('sync_subject_enrollments')
  if (syncError) return json({ error: syncError.message }, 500)

  switch (payload.action) {
    case 'list': return listUsers()
    case 'create': return createUser(payload)
    case 'update': return updateUser(payload, requester.id)
    case 'enroll': return enrollUser(payload)
    case 'setStatus': return setStatus(payload)
    case 'delete': return deleteUser(payload, requester.id)
    case 'subjects': return listSubjects(payload)
    case 'addSubject': return addSubject(payload)
    case 'removeSubject': return removeSubject(payload)
    case 'setSubjectStatus': return setSubjectStatus(payload)
    default: return json({ error: 'Ação desconhecida.' }, 400)
  }
})
