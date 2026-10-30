import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../auth/auth-context'
import { statusLabels } from '../services/admin-users'
import {
  situationOf, subjectsService, subjectStatusLabels, type Subject, type SubjectSituation, type SubjectsOverview,
} from '../services/subjects'

type Tab = 'agora' | 'grade'

const situationLabels: Record<SubjectSituation, string> = {
  ...subjectStatusLabels,
  disponivel: 'Não cursada',
  futura: 'Futura',
}

// Cores das capas da faixa "Próximo semestre", alternadas.
const coverColors = ['cover-red', 'cover-ink', 'cover-amber', 'cover-teal']

type Row = { subject: Subject, situation: SubjectSituation, note: string | null }

function rowsOf(overview: SubjectsOverview): Row[] {
  const currentSemester = overview.enrollment?.currentSemester ?? 0
  return overview.subjects.map((subject) => {
    const { situation, attempts } = situationOf(subject, overview.attempts, currentSemester)
    const last = attempts.at(-1)
    // Só vale mencionar quando foi cursada fora do semestre da grade ou mais de uma vez.
    const note = situation === 'futura'
      ? `A partir do ${subject.semester}º semestre`
      : last && (attempts.length > 1 || last.takenSemester !== subject.semester)
        ? `${situation === 'reprovado' ? 'Reprovada' : 'Cursada'} no ${last.takenSemester}º semestre${attempts.length > 1 ? ` · ${attempts.length}ª vez` : ''}`
        : null
    return { subject, situation, note }
  })
}

// Anel de progresso com o semestre atual no centro.
function ProgressRing({ value, label }: { value: number, label: string }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  return (
    <svg className="progress-ring" viewBox="0 0 64 64" role="img" aria-label={`${Math.round(value * 100)}% concluído`}>
      <circle cx="32" cy="32" r={radius} className="progress-ring-track" />
      <circle cx="32" cy="32" r={radius} className="progress-ring-value"
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value)} />
      <text x="32" y="37" textAnchor="middle">{label}</text>
    </svg>
  )
}

// Card de disciplina em curso: bloco colorido com o nome e, ao lado, os detalhes.
function LessonCard({ row }: { row: Row }) {
  return (
    <article className="lesson-card">
      <div className="lesson-tile">
        <strong>{row.subject.name}</strong>
        <span className="lesson-tile-foot">{row.subject.code}</span>
      </div>
      <div className="lesson-info">
        <span className="lesson-label">Nesta disciplina</span>
        <p>{row.subject.workloadHours} h de carga horária · {row.subject.semester}º semestre da grade</p>
        {row.note && <p className="lesson-note">{row.note}</p>}
        <span className={`badge badge-${row.situation}`}>{situationLabels[row.situation]}</span>
      </div>
    </article>
  )
}

// Card de lista: título, linha de detalhes e selo.
function ListCard({ row }: { row: Row }) {
  return (
    <li className="list-card">
      <div>
        <strong>{row.subject.name}</strong>
        <span>{row.subject.code} · {row.subject.workloadHours} h{row.note && ` · ${row.note}`}</span>
      </div>
      <span className={`badge badge-${row.situation}`}>{situationLabels[row.situation]}</span>
    </li>
  )
}

export function DisciplinasPage() {
  const { session, profile } = useAuth()
  const userId = session?.user.id
  const [tab, setTab] = useState<Tab>('agora')
  const [semesterChoice, setSemesterChoice] = useState<number | null>(null)
  const [failure, setFailure] = useState<{ userId: string, message: string } | null>(null)
  // Disciplinas guardadas no navegador; atualizadas sozinhas quando o administrador muda algo
  // (subjectsService.watch, ligado no AuthProvider).
  const cached = useSyncExternalStore(
    subjectsService.subscribe,
    () => (userId ? subjectsService.peek(userId) : null),
  )

  useEffect(() => {
    if (!userId || subjectsService.peek(userId)) return
    subjectsService.refresh(userId).catch((loadError: Error) => setFailure({ userId, message: loadError.message }))
  }, [userId])

  const overview = cached?.value
  const error = !overview && failure?.userId === userId ? failure.message : null
  const enrollment = overview?.enrollment
  const firstName = profile?.full_name?.split(' ')[0]

  const rows = overview ? rowsOf(overview) : []
  const current = enrollment?.currentSemester ?? 0
  const semesters = [...new Set(rows.map((row) => row.subject.semester))].sort((a, b) => a - b)
  const approved = rows.filter((row) => row.situation === 'aprovado')
  const inProgress = rows.filter((row) => row.situation === 'cursando')
  const pending = rows.filter((row) => row.situation === 'reprovado' || row.situation === 'disponivel')
  const next = rows.filter((row) => row.subject.semester === current + 1)
  const approvedHours = approved.reduce((sum, row) => sum + row.subject.workloadHours, 0)
  const progress = rows.length ? approved.length / rows.length : 0
  // Na grade, começa pelo semestre atual (ou o último da grade, se o curso já passou dele).
  const selectedSemester = semesterChoice ?? (semesters.includes(current) ? current : semesters.at(-1) ?? 1)

  function openGrade(semester?: number) {
    setTab('grade')
    if (semester) setSemesterChoice(semester)
  }

  return (
    <>
      <h1 className="greeting">{firstName ? `Olá, ${firstName}` : 'Disciplinas'}</h1>

      {!overview && !error && <p aria-live="polite">Carregando…</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      {overview && !enrollment && (
        <section className="card">
          <h2>Sem matrícula</h2>
          <p>Você ainda não tem matrícula. Procure a secretaria para começar a cursar as disciplinas.</p>
        </section>
      )}

      {enrollment && (
        <>
          <div className="course-progress">
            <ProgressRing value={progress} label={`${current}º`} />
            <div>
              <strong>{enrollment.courseName}</strong>
              <span>{approved.length}/{rows.length} disciplinas aprovadas</span>
            </div>
          </div>

          {enrollment.status === 'trancado' && (
            <p className="alert alert-warning">Matrícula trancada: suas disciplinas ficam congeladas até a reativação.</p>
          )}
          {(enrollment.status === 'vencida' || enrollment.status === 'substituida') && (
            <p className="alert alert-warning">Matrícula {statusLabels[enrollment.status].toLowerCase()}: as disciplinas abaixo são do histórico dela.</p>
          )}

          <section className="stats-panel" aria-label="Seu progresso">
            <div className="stats-panel-main">
              <div className="stats-panel-lead">
                <span>Semestre</span>
                <strong>{current}º</strong>
                <small>de {semesters.at(-1) ?? current}</small>
              </div>
              <div className="stats-panel-grid">
                <span className="stats-panel-caption">Seu progresso no curso</span>
                <dl>
                  <div className="stat-approved"><dd>{approved.length}</dd><dt>aprovadas</dt></div>
                  <div className="stat-progress"><dd>{inProgress.length}</dd><dt>em curso</dt></div>
                  <div className="stat-hours"><dd>{approvedHours}</dd><dt>horas</dt></div>
                </dl>
              </div>
            </div>
            <button type="button" className="stats-panel-strip" onClick={() => openGrade(current)}>
              <span>Semestre atual · {inProgress.length} {inProgress.length === 1 ? 'disciplina' : 'disciplinas'} em curso</span>
              <span aria-hidden="true">›</span>
            </button>
          </section>

          <div className="underline-tabs" role="tablist" aria-label="Visualização">
            <button type="button" role="tab" aria-selected={tab === 'agora'} onClick={() => setTab('agora')}>Agora</button>
            <button type="button" role="tab" aria-selected={tab === 'grade'} onClick={() => setTab('grade')}>Grade completa</button>
          </div>

          {rows.length === 0 && (
            <section className="card">
              <h2>Grade em preparação</h2>
              <p>As disciplinas deste curso ainda não foram cadastradas.</p>
            </section>
          )}

          {tab === 'agora' && rows.length > 0 && (
            <>
              <section className="section-block" aria-labelledby="em-curso">
                <div className="section-head">
                  <h2 id="em-curso">Em curso</h2>
                  <button type="button" className="section-link" onClick={() => openGrade(current)}>Ver grade ›</button>
                </div>
                {inProgress.length === 0
                  ? <p className="section-empty">Nenhuma disciplina em curso agora.</p>
                  : <div className="lesson-list">{inProgress.map((row) => <LessonCard key={row.subject.id} row={row} />)}</div>}
              </section>

              {pending.length > 0 && (
                <section className="section-block" aria-labelledby="pendencias">
                  <div className="section-head">
                    <h2 id="pendencias">Pendências</h2>
                  </div>
                  <p className="section-subtitle">Reprovadas ou ainda não cursadas, que podem entrar no seu semestre.</p>
                  <ul className="list-cards">{pending.map((row) => <ListCard key={row.subject.id} row={row} />)}</ul>
                </section>
              )}

              {next.length > 0 && (
                <section className="section-block" aria-labelledby="proximo-semestre">
                  <div className="section-head">
                    <h2 id="proximo-semestre">Próximo semestre</h2>
                    <button type="button" className="section-link" onClick={() => openGrade(current + 1)}>Ver todas ›</button>
                  </div>
                  <p className="section-subtitle">O que entra automaticamente no {current + 1}º semestre.</p>
                  <ul className="cover-rail">
                    {next.map((row, index) => (
                      <li key={row.subject.id} className={`cover-card ${coverColors[index % coverColors.length]}`}>
                        <span>{row.subject.code}</span>
                        <strong>{row.subject.name}</strong>
                        <small>{row.subject.workloadHours} h</small>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {tab === 'grade' && rows.length > 0 && (
            <section className="section-block" aria-label="Grade completa">
              <div className="semester-chips" role="group" aria-label="Semestre">
                {semesters.map((semester) => {
                  const done = rows.filter((row) => row.subject.semester === semester).every((row) => row.situation === 'aprovado')
                  return (
                    <button key={semester} type="button" className="semester-chip" aria-pressed={selectedSemester === semester}
                      onClick={(event) => {
                        setSemesterChoice(semester)
                        // A faixa rola para o lado: traz a pílula escolhida inteira para a tela.
                        event.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
                      }}>
                      {semester}º semestre
                      {semester === current && <span className="semester-chip-tag">Atual</span>}
                      {done && <span aria-label="concluído"> ✓</span>}
                    </button>
                  )
                })}
              </div>
              <ul className="list-cards">
                {rows.filter((row) => row.subject.semester === selectedSemester)
                  .map((row) => <ListCard key={row.subject.id} row={row} />)}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
