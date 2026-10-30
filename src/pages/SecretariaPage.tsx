import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  BookIcon, CalendarIcon, ChevronRightIcon, ClockIcon, FileTextIcon, GraduationCapIcon, IdCardIcon, InboxIcon,
  MailIcon, MessageIcon, PauseIcon, PencilIcon, PhoneIcon, RepeatIcon, UserIcon,
} from '../components/layout/icons'
import { SettingsRow } from '../components/SettingsRow'
import { formatDay } from '../lib/format'

// Tela de demonstração: nada aqui é enviado, gravado no banco ou gerado de verdade.
// Os pedidos ficam só na memória da aba e somem ao recarregar a página.

type Field = 'finalidade' | 'entrega' | 'motivo' | 'data'

type Service = {
  id: string
  title: string
  description: string
  deadline: string
  fields: Field[]
  icon: ReactNode
}

type RequestStatus = 'em_analise' | 'concluido'

type ServiceRequest = {
  protocol: string
  serviceTitle: string
  createdOn: string
  status: RequestStatus
  reply?: string
}

const groups: { title: string, services: Service[] }[] = [
  {
    title: 'Documentos',
    services: [
      { id: 'declaracao-matricula', title: 'Declaração de matrícula', description: 'Comprova o vínculo com a instituição e o curso.', deadline: 'Até 1 dia útil', fields: ['finalidade', 'entrega'], icon: <FileTextIcon /> },
      { id: 'historico', title: 'Histórico escolar', description: 'Disciplinas cursadas, situação e carga horária.', deadline: 'Até 3 dias úteis', fields: ['finalidade', 'entrega'], icon: <BookIcon /> },
      { id: 'frequencia', title: 'Atestado de frequência', description: 'Comprova a frequência às aulas no semestre.', deadline: 'Até 2 dias úteis', fields: ['finalidade', 'entrega'], icon: <CalendarIcon /> },
      { id: 'conteudo', title: 'Conteúdo programático', description: 'Ementas e bibliografia das disciplinas cursadas.', deadline: 'Até 5 dias úteis', fields: ['entrega'], icon: <FileTextIcon /> },
      { id: 'conclusao', title: 'Declaração de conclusão', description: 'Para quem já cumpriu todas as disciplinas do curso.', deadline: 'Até 5 dias úteis', fields: ['finalidade', 'entrega'], icon: <GraduationCapIcon /> },
      { id: 'carteirinha', title: '2ª via da carteirinha física', description: 'Em caso de perda, roubo ou dano.', deadline: 'Até 7 dias úteis', fields: ['motivo'], icon: <IdCardIcon /> },
    ],
  },
  {
    title: 'Vida acadêmica',
    services: [
      { id: 'trancamento', title: 'Trancamento de matrícula', description: 'Suspende o curso e congela as disciplinas.', deadline: 'Até 5 dias úteis', fields: ['motivo'], icon: <PauseIcon /> },
      { id: 'revisao', title: 'Revisão de nota', description: 'Pede a revisão da avaliação de uma disciplina.', deadline: 'Até 10 dias úteis', fields: ['motivo'], icon: <PencilIcon /> },
      { id: 'aproveitamento', title: 'Aproveitamento de estudos', description: 'Dispensa de disciplinas cursadas em outra instituição.', deadline: 'Até 15 dias úteis', fields: ['motivo'], icon: <RepeatIcon /> },
      { id: 'turno', title: 'Troca de turno', description: 'Muda o turno das aulas, conforme a disponibilidade de vagas.', deadline: 'Até 5 dias úteis', fields: ['motivo'], icon: <ClockIcon /> },
      { id: 'colacao', title: 'Colação de grau', description: 'Inscrição na cerimônia de colação.', deadline: 'Até 10 dias úteis', fields: [], icon: <GraduationCapIcon /> },
    ],
  },
  {
    title: 'Atendimento',
    services: [
      { id: 'presencial', title: 'Atendimento presencial', description: 'Agende um horário no seu polo.', deadline: 'Confirmação em 1 dia útil', fields: ['data', 'motivo'], icon: <CalendarIcon /> },
      { id: 'cadastro', title: 'Atualização cadastral', description: 'Corrige nome, documento ou dados de contato.', deadline: 'Até 3 dias úteis', fields: ['motivo'], icon: <UserIcon /> },
      { id: 'ouvidoria', title: 'Ouvidoria', description: 'Sugestões, elogios ou reclamações.', deadline: 'Resposta em até 10 dias úteis', fields: ['motivo'], icon: <MessageIcon /> },
    ],
  },
]

const purposes = ['Estágio', 'Emprego', 'Bolsa ou financiamento', 'Transporte', 'Outra']

const requestStatusLabels: Record<RequestStatus, string> = {
  em_analise: 'Em análise',
  concluido: 'Concluído',
}

function today() {
  return new Date().toLocaleDateString('sv-SE')
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toLocaleDateString('sv-SE')
}

// Fica fora do componente para os pedidos sobreviverem à troca de tela (mas não ao recarregar).
let sessionRequests: ServiceRequest[] = [
  { protocol: 'SEC-2026-04502', serviceTitle: 'Histórico escolar', createdOn: daysAgo(2), status: 'em_analise' },
  {
    protocol: 'SEC-2026-04187',
    serviceTitle: 'Declaração de matrícula',
    createdOn: daysAgo(9),
    status: 'concluido',
    reply: 'Documento enviado para o seu e-mail institucional.',
  },
]

function newProtocol() {
  return `SEC-${new Date().getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`
}

function RequestDialog({ service, onSubmit, onClose }: {
  service: Service
  onSubmit: () => ServiceRequest
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [sent, setSent] = useState<ServiceRequest | null>(null)
  const needsReason = service.fields.includes('motivo')

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSent(onSubmit())
  }

  return (
    <dialog ref={dialogRef} className="confirm-dialog request-dialog" aria-labelledby="request-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}>
      <h2 id="request-title">{service.title}</h2>
      {sent ? (
        <>
          <p>Pedido registrado com o protocolo <strong>{sent.protocol}</strong>. Prazo: {service.deadline.toLowerCase()}.</p>
          <p className="hint">Demonstração: o pedido não foi enviado à secretaria.</p>
          <div className="form-actions">
            <button type="button" autoFocus onClick={onClose}>Fechar</button>
          </div>
        </>
      ) : (
        <form className="request-form" onSubmit={handleSubmit}>
          <p>{service.description} Prazo: {service.deadline.toLowerCase()}.</p>
          {service.fields.includes('finalidade') && (
            <label>
              Finalidade
              <select required defaultValue="">
                <option value="" disabled>Selecione</option>
                {purposes.map((purpose) => <option key={purpose}>{purpose}</option>)}
              </select>
            </label>
          )}
          {service.fields.includes('entrega') && (
            <fieldset className="request-options">
              <legend>Entrega</legend>
              <label><input type="radio" name="entrega" value="digital" defaultChecked /> Digital, por e-mail</label>
              <label><input type="radio" name="entrega" value="polo" /> Retirar no polo</label>
            </fieldset>
          )}
          {service.fields.includes('data') && (
            <label>
              Data preferida
              <input type="date" required min={today()} />
            </label>
          )}
          <label>
            {needsReason ? 'Motivo' : 'Observações (opcional)'}
            <textarea rows={3} required={needsReason} maxLength={500} />
          </label>
          <div className="form-actions">
            <button type="submit">Enviar pedido</button>
            <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      )}
    </dialog>
  )
}

export function SecretariaPage() {
  const [requests, setRequests] = useState(sessionRequests)
  const [selected, setSelected] = useState<Service | null>(null)
  const pending = requests.filter((request) => request.status === 'em_analise').length

  function submit(service: Service) {
    const request: ServiceRequest = {
      protocol: newProtocol(),
      serviceTitle: service.title,
      createdOn: today(),
      status: 'em_analise',
    }
    sessionRequests = [request, ...sessionRequests]
    setRequests(sessionRequests)
    return request
  }

  return (
    <>
      <h1 className="settings-title">Secretaria</h1>

      {/* Destaque no topo (Monarch): leva aos pedidos em andamento. */}
      <a className="settings-highlight" href="#meus-pedidos" onClick={(event) => {
        event.preventDefault()
        document.getElementById('meus-pedidos')?.scrollIntoView({ behavior: 'smooth' })
      }}>
        <span className="settings-icon"><InboxIcon /></span>
        <span>{pending ? `${pending} ${pending === 1 ? 'pedido em análise' : 'pedidos em análise'}` : 'Acompanhe seus pedidos'}</span>
        <ChevronRightIcon />
      </a>
      {/* Nota de rodapé do grupo (ubank). */}
      <p className="settings-footnote">Demonstração: os pedidos desta tela não são enviados nem gravados e somem ao recarregar a página.</p>

      {groups.map((group) => (
        <section key={group.title} className="settings-group" aria-labelledby={`grupo-${group.title}`}>
          <h2 id={`grupo-${group.title}`}>{group.title}</h2>
          <ul className="settings-list">
            {group.services.map((service) => (
              <li key={service.id}>
                <button type="button" className="settings-row" onClick={() => setSelected(service)}>
                  <SettingsRow icon={service.icon} title={service.title} detail={service.description}
                    trailing={<span className="settings-chevron"><ChevronRightIcon /></span>} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="settings-group" aria-labelledby="meus-pedidos">
        <h2 id="meus-pedidos">Meus pedidos</h2>
        <ul className="settings-list">
          {requests.map((request) => (
            <li key={request.protocol} className="settings-row">
              <SettingsRow icon={<InboxIcon />} title={request.serviceTitle}
                detail={<>{request.protocol} · {formatDay(request.createdOn)}{request.reply && <><br />{request.reply}</>}</>}
                trailing={<span className={`badge badge-${request.status}`}>{requestStatusLabels[request.status]}</span>} />
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-group" aria-labelledby="contato-secretaria">
        <h2 id="contato-secretaria">Fale com a secretaria</h2>
        <ul className="settings-list">
          <li className="settings-row">
            <SettingsRow icon={<ClockIcon />} title="Horário" detail="Segunda a sexta-feira, das 8h às 21h" />
          </li>
          <li className="settings-row">
            <SettingsRow icon={<MailIcon />} title="E-mail" detail="secretaria@fmu.edu.br" />
          </li>
          <li className="settings-row">
            <SettingsRow icon={<PhoneIcon />} title="Telefone" detail="(11) 96388-1790" />
          </li>
        </ul>
      </section>

      {selected && (
        <RequestDialog key={selected.id} service={selected} onSubmit={() => submit(selected)} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
