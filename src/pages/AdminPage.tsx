import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { Avatar } from '../components/Avatar'
import { EnrollmentPanel } from '../components/admin/EnrollmentPanel'
import { SubjectsPanel } from '../components/admin/SubjectsPanel'
import { UserForm } from '../components/admin/UserForm'
import { FullScreenDialog } from '../components/FullScreenDialog'
import { CloseIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/layout/icons'
import { useConfirm } from '../hooks/useConfirm'
import { cpfDigits } from '../lib/cpf'
import { adminUsersService, statusLabels, type AdminUser } from '../services/admin-users'
import { catalogService, shiftLabels, type Campus, type Course } from '../services/catalog'

type Tab = 'todos' | 'user' | 'admin'

const tabLabels: Record<Tab, string> = { todos: 'Todos', user: 'Alunos', admin: 'Administradores' }

// Modal aberto: cadastro de um usuário novo ou edição de um existente.
type Editor = { mode: 'new' } | { mode: 'edit', id: string }

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Busca por nome, e-mail, RA ou CPF (com ou sem pontuação).
function matches(user: AdminUser, query: string) {
  const text = normalize(query.trim())
  if (!text) return true
  const digits = cpfDigits(query)
  return [user.fullName, user.email, user.enrollment?.ra].some((value) => value && normalize(value).includes(text))
    || (digits.length >= 3 && (user.cpf ?? '').includes(digits))
}

// Validade no formato do documento: MM/AAAA.
function formatValidity(value: string) {
  const [year, month] = value.split('-')
  return `${month}/${year}`
}

export function AdminPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('todos')
  const [confirm, confirmDialog] = useConfirm()
  // O usuário em edição vem da lista para refletir trocas de curso e status na hora.
  const editing = editor?.mode === 'edit' ? users.find((user) => user.id === editor.id) ?? null : null
  const campusById = new Map(campuses.map((campus) => [campus.id, campus]))
  const visible = users.filter((user) => (tab === 'todos' || user.role === tab) && matches(user, query))

  const loadUsers = useCallback(() =>
    adminUsersService.list()
      .then((list) => {
        setUsers(list)
        setError(null)
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false)), [])

  useEffect(() => {
    loadUsers()
    Promise.all([catalogService.courses(), catalogService.campuses()]).then(([coursesResult, campusesResult]) => {
      if (coursesResult.error || campusesResult.error) {
        setError('Não foi possível carregar cursos e polos. Verifique se a migration acadêmica foi aplicada.')
        return
      }
      setCourses(coursesResult.data)
      setCampuses(campusesResult.data)
    })
  }, [loadUsers])

  function openEditor(next: Editor) {
    setEditor(next)
    setError(null)
  }

  function closeEditor() {
    setEditor(null)
    setError(null)
  }

  async function handleSaved() {
    setEditor(null)
    await loadUsers()
  }

  async function handleRemove(user: AdminUser) {
    if (!await confirm({
      title: 'Remover usuário',
      message: `${user.fullName ?? user.email} perderá o acesso, e suas matrículas e foto serão apagadas. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      danger: true,
    })) return
    try {
      await adminUsersService.remove(user.id)
      setEditor(null)
      await loadUsers()
    } catch (removeError) {
      setError((removeError as Error).message)
    }
  }

  const errorAlert = error && <p className="alert" role="alert">{error}</p>

  return (
    <>
      <h1 className="sr-only">Usuários</h1>

      {/* Busca em pílula com botão de limpar (Fanatics). */}
      <label className="search-field">
        <SearchIcon />
        <input type="search" placeholder="Buscar por nome, e-mail, RA ou CPF" aria-label="Buscar usuários"
          value={query} onChange={(event) => setQuery(event.target.value)} />
        {query && (
          <button type="button" className="search-clear" aria-label="Limpar busca" onClick={() => setQuery('')}>
            <CloseIcon />
          </button>
        )}
      </label>

      <div className="underline-tabs" role="tablist" aria-label="Perfil">
        {(Object.keys(tabLabels) as Tab[]).map((option) => (
          <button key={option} type="button" role="tab" aria-selected={tab === option} onClick={() => setTab(option)}>
            {tabLabels[option]}
            {/* A contagem só aparece na aba ativa. */}
            {tab === option && !loading && <span className="tab-count">{visible.length}</span>}
          </button>
        ))}
      </div>

      {!editor && errorAlert}

      <section className="user-results" aria-label={tabLabels[tab]}>
        {loading && <p>Carregando…</p>}
        {!loading && visible.length === 0 && <p className="section-empty">Nenhum usuário encontrado.</p>}
        <ul className="user-cards">
          {visible.map((user) => {
            const enrollment = user.enrollment
            const campus = user.campusId ? campusById.get(user.campusId) : null
            const name = user.fullName ?? user.email ?? ''
            return (
              <li key={user.id} className="user-card">
                <div className="user-card-head">
                  <div>
                    <h3>{user.fullName ?? '—'}</h3>
                    <span>{user.email}{user.role === 'admin' ? ' · Administrador' : ''}</span>
                  </div>
                  {enrollment && <span className={`badge badge-${enrollment.status}`}>{statusLabels[enrollment.status]}</span>}
                </div>
                <div className="user-card-body">
                  <Avatar name={name} url={user.avatarUrl} size={52} />
                  <div className="user-card-info">
                    {enrollment ? (
                      <>
                        <strong>{enrollment.ra}</strong>
                        <span>{enrollment.courseName}</span>
                        <span>
                          {[
                            enrollment.classGroupCode,
                            `${enrollment.currentSemester}º de ${enrollment.totalSemesters}`,
                            `válida até ${formatValidity(enrollment.validUntil)}`,
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>Sem matrícula</strong>
                        <span>Edite para matricular em um curso.</span>
                      </>
                    )}
                    {(campus || user.shift) && (
                      <span>{[campus?.name, user.shift && shiftLabels[user.shift]].filter(Boolean).join(' · ')}</span>
                    )}
                  </div>
                  <div className="user-card-actions">
                    <button type="button" className="user-card-action" onClick={() => openEditor({ mode: 'edit', id: user.id })}>
                      Editar
                    </button>
                    {/* Ninguém remove a si mesmo. */}
                    {user.id !== session?.user.id && (
                      <button type="button" className="user-card-remove" aria-label={`Remover ${name}`} title="Remover usuário"
                        onClick={() => handleRemove(user)}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <button type="button" className="fab" aria-label="Novo usuário" title="Novo usuário"
        onClick={() => openEditor({ mode: 'new' })}>
        <PlusIcon />
      </button>

      {editor && (
        <FullScreenDialog title={editing ? editing.fullName ?? editing.email ?? 'Editar usuário' : 'Novo usuário'}
          onClose={closeEditor}>
          {errorAlert}
          <UserForm key={editing?.id ?? 'new'} editing={editing} selfId={session?.user.id}
            courses={courses} campuses={campuses}
            onSaved={handleSaved} onError={setError} />
          {editing && <EnrollmentPanel user={editing} courses={courses} onChanged={loadUsers} onError={setError} />}
          {editing && <SubjectsPanel user={editing} onError={setError} />}
          {editing && editing.id !== session?.user.id && (
            <button type="button" className="pill-button pill-button-danger user-remove" onClick={() => handleRemove(editing)}>
              Remover usuário
            </button>
          )}
        </FullScreenDialog>
      )}
      {confirmDialog}
    </>
  )
}
