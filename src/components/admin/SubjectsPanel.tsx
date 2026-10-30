import { useCallback, useEffect, useState } from 'react'
import { useConfirm } from '../../hooks/useConfirm'
import { OutlinedField } from './OutlinedField'
import { adminUsersService, type AdminUser } from '../../services/admin-users'
import { subjectStatusLabels, type SubjectAttempt, type SubjectsOverview, type SubjectStatus } from '../../services/subjects'

type Props = {
  user: AdminUser
  onError: (message: string) => void
}

export function SubjectsPanel({ user, onError }: Props) {
  const [loaded, setLoaded] = useState<{ key: string, overview: SubjectsOverview } | null>(null)
  const [subjectId, setSubjectId] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, confirmDialog] = useConfirm()
  // Troca de curso ou de status muda a matrícula: recarrega a grade.
  const key = `${user.id}:${user.enrollment?.id ?? ''}:${user.enrollment?.status ?? ''}`

  const load = useCallback(() => adminUsersService.subjects(user.id)
    .then((overview) => setLoaded({ key, overview }))
    .catch((loadError: Error) => onError(loadError.message)), [user.id, key, onError])

  useEffect(() => { load() }, [load])

  const overview = loaded?.key === key ? loaded.overview : null
  const enrollment = overview?.enrollment
  if (!user.enrollment) return null

  const subjectById = new Map(overview?.subjects.map((subject) => [subject.id, subject]))
  const active = enrollment?.status === 'matriculado'
  const currentSemester = enrollment?.currentSemester ?? 0
  // Pode entrar: semestre da grade até o atual e sem tentativa em curso ou aprovada.
  const blocked = new Set(overview?.attempts
    .filter((attempt) => attempt.status !== 'reprovado').map((attempt) => attempt.subjectId))
  const eligible = overview?.subjects.filter((subject) => subject.semester <= currentSemester && !blocked.has(subject.id)) ?? []
  const attempts = [...overview?.attempts ?? []].sort((a, b) =>
    b.takenSemester - a.takenSemester
    || (subjectById.get(a.subjectId)?.code ?? '').localeCompare(subjectById.get(b.subjectId)?.code ?? ''))

  async function run(operation: () => Promise<unknown>) {
    setBusy(true)
    try {
      await operation()
      setSubjectId('')
      await load()
    } catch (operationError) {
      onError((operationError as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function setStatus(attempt: SubjectAttempt, status: SubjectStatus) {
    run(() => adminUsersService.setSubjectStatus(attempt.id, status))
  }

  async function remove(attempt: SubjectAttempt) {
    const subject = subjectById.get(attempt.subjectId)
    if (!await confirm({
      title: 'Remover disciplina',
      message: `${user.fullName ?? user.email} deixará de cursar ${subject?.name ?? 'a disciplina'} neste semestre.`,
      confirmLabel: 'Remover',
      danger: true,
    })) return
    run(() => adminUsersService.removeSubject(attempt.id))
  }

  return (
    // Mesmo estilo das seções do formulário: cada disciplina vira uma linha do cartão branco, com as ações em pílula.
    <section className="form-section" aria-labelledby="subjects-title">
      {confirmDialog}
      <h3 id="subjects-title">Disciplinas</h3>
      {!overview && <p className="form-section-hint" aria-live="polite">Carregando disciplinas…</p>}
      {enrollment && (
        <>
          <p className="form-section-hint">
            {currentSemester}º semestre de {enrollment.courseName}. Quando o semestre vira, as disciplinas em curso
            são aprovadas automaticamente; marque reprovado quando for o caso.
          </p>
          {enrollment.status === 'trancado' && (
            <p className="alert alert-warning panel-alert">Matrícula trancada: as disciplinas ficam congeladas e não é possível incluir novas até reativar.</p>
          )}
          {(enrollment.status === 'vencida' || enrollment.status === 'substituida') && (
            <p className="alert alert-warning panel-alert">Matrícula sem vigência: só é possível corrigir aprovações e reprovações do histórico.</p>
          )}

          {attempts.length === 0 ? <p className="section-empty">Nenhuma disciplina cursada nesta matrícula.</p> : (
            <ul className="data-card attempt-list">
              {attempts.map((attempt) => {
                const subject = subjectById.get(attempt.subjectId)
                const canResume = active && attempt.status === 'reprovado' && attempt.takenSemester === currentSemester
                return (
                  <li key={attempt.id} className="attempt-row">
                    <div className="data-card-head">
                      <div>
                        <strong>{subject?.name}</strong>
                        <span>{subject?.code} · {subject?.semester}º da grade · cursada no {attempt.takenSemester}º</span>
                      </div>
                      <span className={`badge badge-${attempt.status}`}>{subjectStatusLabels[attempt.status]}</span>
                    </div>
                    <div className="attempt-actions">
                      {attempt.status !== 'aprovado' && (
                        <button type="button" className="pill-button" disabled={busy}
                          onClick={() => setStatus(attempt, 'aprovado')}>Aprovar</button>
                      )}
                      {attempt.status !== 'reprovado' && (
                        <button type="button" className="pill-button pill-button-danger" disabled={busy}
                          onClick={() => setStatus(attempt, 'reprovado')}>Reprovar</button>
                      )}
                      {canResume && (
                        <button type="button" className="pill-button" disabled={busy}
                          onClick={() => setStatus(attempt, 'cursando')}>Voltar a cursar</button>
                      )}
                      {attempt.status === 'cursando' && (
                        <button type="button" className="pill-button" disabled={busy}
                          onClick={() => remove(attempt)}>Remover</button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {active && (
            <div className="field-with-action">
              <OutlinedField label="Incluir disciplina">
                <select value={subjectId} disabled={busy || eligible.length === 0}
                  onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">
                    {eligible.length ? 'Até o semestre atual…' : 'Nenhuma disponível'}
                  </option>
                  {eligible.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.semester}º sem. · {subject.code} · {subject.name}
                    </option>
                  ))}
                </select>
              </OutlinedField>
              <button type="button" className="pill-button pill-button-primary" disabled={busy || !subjectId}
                onClick={() => run(() => adminUsersService.addSubject(enrollment.id, Number(subjectId)))}>
                Incluir
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
