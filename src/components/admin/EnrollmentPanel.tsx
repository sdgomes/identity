import { useState } from 'react'
import { useConfirm } from '../../hooks/useConfirm'
import { formatDay } from '../../lib/format'
import { adminUsersService, isCurrent, statusLabels, type AdminUser } from '../../services/admin-users'
import type { Course } from '../../services/catalog'
import { CourseSelect } from './CourseSelect'
import { OutlinedField } from './OutlinedField'

type Props = {
  user: AdminUser
  courses: Course[]
  onChanged: () => Promise<void>
  onError: (message: string) => void
}

export function EnrollmentPanel({ user, courses, onChanged, onError }: Props) {
  const [courseId, setCourseId] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, confirmDialog] = useConfirm()
  const enrollment = user.enrollment
  const current = isCurrent(enrollment)

  async function run(operation: () => Promise<unknown>) {
    setBusy(true)
    try {
      await operation()
      setCourseId('')
      await onChanged()
    } catch (operationError) {
      onError((operationError as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const enrollLabel = !enrollment ? 'Matricular' : current ? 'Trocar de curso' : 'Renovar matrícula'

  async function handleEnroll() {
    if (!courseId) return
    const course = courses.find((item) => String(item.id) === courseId)
    if (current && course?.id === enrollment.courseId) {
      onError(`O usuário já está matriculado em ${course.name}.`)
      return
    }
    if (current && !await confirm({
      title: 'Trocar de curso',
      message: `A matrícula ${enrollment.number} em ${enrollment.courseName} será substituída por uma nova em ${course?.name}, e a vaga na turma ${enrollment.classGroupCode ?? ''} será liberada.`,
      confirmLabel: 'Trocar de curso',
    })) return
    run(() => adminUsersService.enroll(user.id, Number(courseId)))
  }

  return (
    // Mesmo estilo das seções do formulário: título, texto de apoio, dados num cartão branco e ações em pílula.
    <section className="form-section" aria-labelledby="enrollment-title">
      {confirmDialog}
      <h3 id="enrollment-title">Matrícula</h3>
      <p className="form-section-hint">Alterações de matrícula são aplicadas na hora, sem precisar salvar.</p>
      {enrollment ? (
        <div className="data-card">
          <div className="data-card-head">
            <div>
              <strong>{enrollment.courseName}</strong>
              <span>RA {enrollment.ra} · nº {enrollment.number}</span>
            </div>
            <span className={`badge badge-${enrollment.status}`}>{statusLabels[enrollment.status]}</span>
          </div>
          <dl className="data-card-fields">
            <div><dt>Turma</dt><dd>{enrollment.classGroupCode ?? '—'}</dd></div>
            <div><dt>Semestre</dt><dd>{enrollment.currentSemester}º de {enrollment.totalSemesters}</dd></div>
            <div><dt>Início</dt><dd>{formatDay(enrollment.startsOn)}</dd></div>
            <div><dt>Válida até</dt><dd>{formatDay(enrollment.validUntil)}</dd></div>
          </dl>
          {current && (
            <div className="data-card-foot">
              <span>Dentro da vigência, o status pode ser alterado livremente.</span>
              <button type="button" className="pill-button" disabled={busy}
                onClick={() => run(() => adminUsersService.setStatus(
                  enrollment.id, enrollment.status === 'matriculado' ? 'trancado' : 'matriculado',
                ))}>
                {enrollment.status === 'matriculado' ? 'Trancar matrícula' : 'Reativar matrícula'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="section-empty">Este usuário ainda não tem matrícula.</p>
      )}
      {enrollment && !current && (
        <p className="alert alert-warning panel-alert">Matrícula vencida. Renove para voltar a ocupar uma turma; é possível escolher outro curso.</p>
      )}

      <div className="field-with-action">
        <OutlinedField label={current ? 'Novo curso' : 'Curso'}>
          <CourseSelect courses={courses} value={courseId} onChange={setCourseId} />
        </OutlinedField>
        <button type="button" className="pill-button pill-button-primary" disabled={busy || !courseId} onClick={handleEnroll}>
          {enrollLabel}
        </button>
      </div>
    </section>
  )
}
