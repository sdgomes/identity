import { useState, type FormEvent } from 'react'
import { useFileDataUrl } from '../../hooks/useFileDataUrl'
import { cpfDigits, formatCpf, isValidCpf } from '../../lib/cpf'
import { adminUsersService, type AdminUser, type ProfileFields } from '../../services/admin-users'
import { shiftLabels, type Campus, type Course, type Shift } from '../../services/catalog'
import type { Role } from '../../services/profiles'
import { IdCardIcon } from '../layout/icons'
import { CourseSelect } from './CourseSelect'
import { OutlinedField } from './OutlinedField'
import { ImageCropper } from './ImageCropper'

// O original só passa pelo recorte; o arquivo enviado é o JPEG 600x800 gerado nele.
const MAX_SOURCE_SIZE = 10 * 1024 * 1024

type FormState = {
  fullName: string
  cpf: string
  email: string
  password: string
  birthDate: string
  role: Role
  campusId: string
  shift: Shift | ''
  courseId: string
}

const emptyForm: FormState = {
  fullName: '', cpf: '', email: '', password: '', birthDate: '', role: 'user', campusId: '', shift: '', courseId: '',
}

function formFromUser(user: AdminUser): FormState {
  return {
    fullName: user.fullName ?? '',
    cpf: formatCpf(user.cpf ?? ''),
    email: user.email ?? '',
    password: '',
    birthDate: user.birthDate ?? '',
    role: user.role,
    campusId: user.campusId ? String(user.campusId) : '',
    shift: user.shift ?? '',
    courseId: '',
  }
}

type Props = {
  editing: AdminUser | null
  selfId: string | undefined
  courses: Course[]
  campuses: Campus[]
  onSaved: () => Promise<void>
  onError: (message: string) => void
}

export function UserForm({ editing, selfId, courses, campuses, onSaved, onError }: Props) {
  const [form, setForm] = useState<FormState>(editing ? formFromUser(editing) : emptyForm)
  const [photo, setPhoto] = useState<File | null>(null)
  const [cropSource, setCropSource] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const editingSelf = editing !== null && editing.id === selfId
  const [today] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const photoPreview = useFileDataUrl(photo)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidCpf(form.cpf)) {
      onError('Informe um CPF válido.')
      return
    }
    setSubmitting(true)
    const profile: ProfileFields = {
      fullName: form.fullName,
      role: form.role,
      cpf: cpfDigits(form.cpf),
      birthDate: form.birthDate,
      campusId: Number(form.campusId),
      shift: form.shift as Shift,
    }
    try {
      if (editing) {
        const avatarPath = photo ? await adminUsersService.uploadAvatar(editing.id, photo) : undefined
        await adminUsersService.update(editing.id, {
          ...profile, email: form.email, password: form.password || undefined, avatarPath,
        })
      } else {
        const { id } = await adminUsersService.create({
          ...profile, email: form.email, password: form.password, courseId: Number(form.courseId),
        })
        // O caminho da foto usa o id, que só existe depois do cadastro.
        if (photo) {
          try {
            const avatarPath = await adminUsersService.uploadAvatar(id, photo)
            await adminUsersService.update(id, { ...profile, email: form.email, avatarPath })
          } catch {
            onError('Usuário cadastrado, mas a foto não foi salva. Edite o usuário para enviá-la novamente.')
          }
        }
      }
      await onSaved()
    } catch (submitError) {
      onError((submitError as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const previewUrl = photoPreview ?? editing?.avatarUrl ?? null

  return (
    // O título fica no cabeçalho do modal em tela cheia que envolve o formulário.
    // Estilo Shipt/ubank: seções com título e texto de apoio, campos contornados com o rótulo na borda,
    // pares lado a lado e o botão principal preso ao pé da tela.
    <form className="user-form" onSubmit={handleSubmit} aria-label={editing ? 'Dados do usuário' : 'Novo usuário'}>
      {!editing && (
        <div className="form-callout">
          <span className="form-callout-icon"><IdCardIcon /></span>
          <div>
            <strong>Cadastro com matrícula</strong>
            <p>A pessoa entra com o e-mail e a senha inicial, e a matrícula é criada na primeira turma com vaga do curso.</p>
          </div>
        </div>
      )}

      <section className="form-section" aria-labelledby="dados-pessoais">
        <h3 id="dados-pessoais">Dados pessoais</h3>
        <div className="photo-field">
          <span className="photo-preview" aria-hidden="true">
            {previewUrl ? <img src={previewUrl} alt="" /> : 'Sem foto'}
          </span>
          <div>
            <strong>Foto de perfil</strong>
            <p>Formato 3x4, usada na carteirinha. JPEG, PNG ou WebP de até 10 MB.</p>
            <label className="photo-button">
              {previewUrl ? 'Trocar foto' : 'Escolher foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  // Limpa o campo para permitir escolher o mesmo arquivo de novo.
                  event.target.value = ''
                  if (!file) return
                  if (file.size > MAX_SOURCE_SIZE) {
                    onError('A imagem deve ter no máximo 10 MB.')
                    return
                  }
                  setCropSource(file)
                }} />
            </label>
          </div>
        </div>
        {cropSource && (
          <ImageCropper file={cropSource} onCancel={() => setCropSource(null)}
            onConfirm={(cropped) => {
              setPhoto(cropped)
              setCropSource(null)
            }} />
        )}
        <div className="form-fields">
          <OutlinedField label="Nome completo" wide>
            <input required maxLength={120} value={form.fullName}
              onChange={(event) => update('fullName', event.target.value)} />
          </OutlinedField>
          <OutlinedField label="CPF">
            <input required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
              value={form.cpf} onChange={(event) => update('cpf', formatCpf(event.target.value))} />
          </OutlinedField>
          <OutlinedField label="Data de nascimento">
            <input type="date" required max={today} value={form.birthDate}
              onChange={(event) => update('birthDate', event.target.value)} />
          </OutlinedField>
        </div>
      </section>

      <section className="form-section" aria-labelledby="acesso">
        <h3 id="acesso">Acesso</h3>
        <p className="form-section-hint">
          {editing ? 'Deixe a senha em branco para manter a atual.' : 'A pessoa entra no app com este e-mail e esta senha.'}
        </p>
        <div className="form-fields">
          <OutlinedField label="E-mail" wide>
            <input type="email" required value={form.email}
              onChange={(event) => update('email', event.target.value)} />
          </OutlinedField>
          <OutlinedField label={editing ? 'Nova senha (opcional)' : 'Senha inicial'}>
            <input type="password" autoComplete="new-password" required={!editing} minLength={8}
              placeholder="Mín. 8 caracteres"
              value={form.password} onChange={(event) => update('password', event.target.value)} />
          </OutlinedField>
          <OutlinedField label="Perfil">
            <select value={form.role} disabled={editingSelf}
              onChange={(event) => update('role', event.target.value as Role)}>
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </OutlinedField>
        </div>
      </section>

      <section className="form-section" aria-labelledby="academico">
        <h3 id="academico">Acadêmico</h3>
        <p className="form-section-hint">
          {editing ? 'Polo e turno em que a pessoa estuda.' : 'Polo, turno e o curso da primeira matrícula.'}
        </p>
        <div className="form-fields">
          <OutlinedField label="Polo">
            <select required value={form.campusId} onChange={(event) => update('campusId', event.target.value)}>
              <option value="">Selecione</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>{campus.name} · {campus.code}</option>
              ))}
            </select>
          </OutlinedField>
          <OutlinedField label="Turno">
            <select required value={form.shift} onChange={(event) => update('shift', event.target.value as Shift)}>
              <option value="">Selecione</option>
              {Object.entries(shiftLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </OutlinedField>
          {/* Na edição, a matrícula fica num cartão próprio com ações imediatas. */}
          {!editing && (
            <OutlinedField label="Curso" wide>
              <CourseSelect courses={courses} value={form.courseId} required
                onChange={(value) => update('courseId', value)} />
            </OutlinedField>
          )}
        </div>
      </section>

      {/* Preso ao pé da tela enquanto o formulário está à vista; o X do cabeçalho cancela. */}
      <div className="form-submit-bar">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar usuário'}
        </button>
      </div>
    </form>
  )
}
