import { useEffect, useState, useSyncExternalStore } from 'react'
import QRCode from 'qrcode'
import brandLogo from '../assets/logo-fmu.svg'
import footerLogo from '../assets/logo-fmu-fiam.png'
import institutionLogo from '../assets/logo-fiam-levelup.svg'
import { useAuth } from '../auth/auth-context'
import { ShieldIcon } from '../components/layout/icons'
import { formatCpf } from '../lib/cpf'
import { formatDay } from '../lib/format'
import { statusLabels } from '../services/admin-users'
import { shiftLabels } from '../services/catalog'
import { studentCardService, type StudentCard } from '../services/student-card'

type Enrollment = NonNullable<StudentCard['enrollment']>

const levelLabels: Record<Enrollment['courseLevel'], string> = {
  graduacao: 'Graduação',
  pos_graduacao: 'Pós-graduação',
}

// Validade no formato do documento: MM/AAAA.
function formatValidity(value: string) {
  const [year, month] = value.split('-')
  return `${month}/${year}`
}

// Código de uso: número da matrícula e ano da validade (ex.: 001.007/26). Só identifica a carteirinha.
function usageCodeOf(enrollment: Enrollment) {
  const number = String(enrollment.number).padStart(6, '0')
  return `${number.slice(0, 3)}.${number.slice(3)}/${enrollment.validUntil.slice(2, 4)}`
}

// QR Code gerado no navegador. É representativo: não há serviço de validação por trás.
function useQrCode(text: string | null) {
  const [image, setImage] = useState<{ text: string, url: string } | null>(null)
  useEffect(() => {
    if (!text) return
    let current = true
    QRCode.toDataURL(text, { margin: 0, width: 320, errorCorrectionLevel: 'M', color: { dark: '#172b3a' } })
      .then((url) => { if (current) setImage({ text, url }) })
      .catch(() => {})
    return () => { current = false }
  }, [text])
  return image?.text === text ? image.url : null
}

function Field({ label, value, wide, mono }: { label: string, value: string, wide?: boolean, mono?: boolean }) {
  return (
    <div className={wide ? 'student-field student-field-wide' : 'student-field'}>
      <dt>{label}</dt>
      <dd className={mono ? 'student-mono' : undefined}>{value}</dd>
    </div>
  )
}

export function CarteirinhaPage() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [failure, setFailure] = useState<{ userId: string, message: string } | null>(null)
  // Carteirinha guardada no navegador. Ela se atualiza sozinha quando o perfil ou a matrícula mudam
  // (studentCardService.watch, ligado no AuthProvider), e a tela redesenha junto.
  const cached = useSyncExternalStore(
    studentCardService.subscribe,
    () => (userId ? studentCardService.peek(userId) : null),
  )

  useEffect(() => {
    // Só vai ao banco se ainda não houver carteirinha guardada.
    if (!userId || studentCardService.peek(userId)) return
    studentCardService.refresh(userId).catch((loadError: Error) => setFailure({ userId, message: loadError.message }))
  }, [userId])

  const error = !cached && failure?.userId === userId ? failure.message : null
  const card = cached?.value
  const enrollment = card?.enrollment
  const name = card?.fullName ?? session?.user.email ?? ''
  const active = enrollment?.status === 'matriculado'
  const usageCode = enrollment ? usageCodeOf(enrollment) : null
  // O QR Code leva exatamente o código de uso mostrado abaixo dele.
  const qrCode = useQrCode(usageCode)

  return (
    <>
      {!card && !error && <p aria-live="polite">Carregando…</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      {card && !enrollment && (
        <>
          <h1>Carteirinha</h1>
          <section className="card">
            <h2>Sem matrícula</h2>
            <p>Você ainda não tem matrícula. Procure a secretaria para emitir sua carteirinha.</p>
          </section>
        </>
      )}

      {card && enrollment && usageCode && (
        <article className="student-id" aria-label={`Carteirinha de ${name}`}>
          {/* Cabeçalho do documento: marca à esquerda, tipo do documento à direita. */}
          <header className="student-id-header">
            <img className="student-id-brand" src={brandLogo} alt="FMU Centro Universitário" />
            <span className="student-id-kind">Carteira digital de identificação estudantil</span>
          </header>

          {/* Foto 3x4 ao lado do QR Code com o código de uso. */}
          <div className="student-id-top">
            <div className="student-photo">
              {card.avatarUrl ? <img src={card.avatarUrl} alt={`Foto de ${name}`} /> : <span>Sem foto</span>}
            </div>
            <div className="student-qr">
              {qrCode ? <img src={qrCode} alt={`QR Code com o código de uso ${usageCode}`} /> : <span className="student-qr-placeholder" />}
              <span className="student-qr-label">Código de uso</span>
              <strong className="student-mono">{usageCode}</strong>
            </div>
          </div>

          {/* Bloco branco com os dados, como o verso do documento. */}
          <section className="student-sheet">
            <h1>{name}</h1>
            <p className="student-course">{enrollment.courseName}</p>
            <p className="student-level">
              {/* Carteirinha guardada antes destes campos existirem mostra "—" até a próxima atualização. */}
              {enrollment.courseLevel ? levelLabels[enrollment.courseLevel] : '—'}
              {card.campus && ` · ${card.campus.name}`}
            </p>

            <dl className="student-fields">
              <Field label="CPF" value={card.cpf ? formatCpf(card.cpf) : '—'} />
              <Field label="Data de nasc." value={formatDay(card.birthDate)} />
              <Field label="RA" value={enrollment.ra} mono />
              <Field label="Matrícula" value={String(enrollment.number)} />
              <Field label="Ingresso" value={formatDay(enrollment.startsOn)} />
              <Field label="Semestre" value={`${enrollment.currentSemester}º de ${enrollment.totalSemesters}`} />
              <Field label="Turma" value={enrollment.classGroupCode ?? '—'} />
              <Field label="Turno" value={card.shift ? shiftLabels[card.shift] : '—'} />
            </dl>

            <div className="student-validity">
              <span>Válida até <strong>{formatValidity(enrollment.validUntil)}</strong></span>
              <img className="student-logo" src={institutionLogo} alt="FIAM-FAAM Centro Universitário" />
            </div>
          </section>

          {/* Só vale como comprovante com a matrícula ativa. */}
          {!active && (
            <p className="alert alert-warning student-warning">
              Com a matrícula {statusLabels[enrollment.status].toLowerCase()}, esta carteirinha não comprova vínculo
              com a instituição. Procure a secretaria para regularizar.
            </p>
          )}

          <footer className="student-id-footer">
            <span className="student-id-origin">
              <img src={footerLogo} alt="FMU | FIAM-FAAM" />
              {card.campus && <span>Polo {card.campus.code}</span>}
            </span>
            <span className={active ? 'student-status' : 'student-status student-status-inactive'}>
              <ShieldIcon />
              {active ? 'Matrícula ativa' : statusLabels[enrollment.status]}
            </span>
          </footer>
        </article>
      )}
    </>
  )
}
