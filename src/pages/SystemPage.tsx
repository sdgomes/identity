import { useEffect, useState, version as reactVersion, type ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import {
  CalendarIcon, ClockIcon, CodeIcon, DatabaseIcon, ExternalLinkIcon, GitBranchIcon, GitCommitIcon, GlobeIcon,
  KeyIcon, LockIcon, MailIcon, MonitorIcon, PackageIcon, RefreshIcon, ServerIcon, ShieldIcon, SmartphoneIcon,
  TagIcon, UserIcon, WifiIcon,
} from '../components/layout/icons'
import { SettingsRow } from '../components/SettingsRow'
import { systemInfoService, type AuthHealth, type DatabaseHealth } from '../services/system-info'

const app = __APP_INFO__

function formatDate(value: string | number | null | undefined) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—'
}

type Row = {
  icon: ReactNode
  label: string
  value: ReactNode
  // Linha que abre outra página (commit, workflow): ganha o ícone de link externo à direita.
  href?: string | null
  trailing?: ReactNode
}

// Grupo da lista (estilo Monarch): rótulo cinza e cartão branco com as linhas.
function Group({ title, rows }: { title: string, rows: Row[] }) {
  const id = `sistema-${title.toLowerCase()}`
  return (
    <section className="settings-group" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ul className="settings-list">
        {rows.map((row) => (
          <li key={row.label}>
            {row.href ? (
              <a className="settings-row" href={row.href} target="_blank" rel="noreferrer">
                <SettingsRow icon={row.icon} title={row.label} detail={row.value}
                  trailing={<span className="settings-chevron"><ExternalLinkIcon /></span>} />
              </a>
            ) : (
              <div className="settings-row">
                <SettingsRow icon={row.icon} title={row.label} detail={row.value ?? '—'} trailing={row.trailing} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Health({ result }: { result: { ok: boolean } | null }) {
  if (!result) return <span className="badge badge-checking">Verificando</span>
  return <span className={result.ok ? 'badge badge-ok' : 'badge badge-error'}>{result.ok ? 'Disponível' : 'Indisponível'}</span>
}

export function SystemPage() {
  const { session, profile } = useAuth()
  const [auth, setAuth] = useState<AuthHealth | null>(null)
  const [database, setDatabase] = useState<DatabaseHealth | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    let active = true
    systemInfoService.checkAuth().then((result) => { if (active) setAuth(result) })
    if (userId) systemInfoService.checkDatabase(userId).then((result) => { if (active) setDatabase(result) })
    return () => { active = false }
  }, [userId])

  const supabaseHost = (() => {
    try {
      return new URL(import.meta.env.VITE_SUPABASE_URL ?? '').host
    } catch {
      return null
    }
  })()
  const checking = !auth || (userId && !database)
  const healthy = auth?.ok && (!userId || database?.ok)

  return (
    <>
      <h1 className="settings-title">Sistema</h1>

      {/* Destaque no topo: a saúde dos serviços do Supabase de um relance. */}
      <div className={checking ? 'settings-highlight settings-highlight-muted' : healthy ? 'settings-highlight settings-highlight-ok' : 'settings-highlight'}
        role="status">
        <span className="settings-icon"><ShieldIcon /></span>
        <span>{checking ? 'Verificando os serviços…' : healthy ? 'Todos os serviços disponíveis' : 'Há serviços indisponíveis'}</span>
      </div>
      <p className="settings-footnote">Informações técnicas desta publicação e do ambiente em uso.</p>

      <Group title="Aplicação" rows={[
        { icon: <TagIcon />, label: 'Versão', value: app.version },
        { icon: <ServerIcon />, label: 'Ambiente', value: import.meta.env.PROD ? 'Produção' : 'Desenvolvimento' },
        { icon: <CalendarIcon />, label: 'Publicado em', value: formatDate(app.buildTime) },
        {
          icon: <GitCommitIcon />, label: 'Commit', value: app.commit?.slice(0, 7),
          href: app.commit && app.repository ? `https://github.com/${app.repository}/commit/${app.commit}` : null,
        },
        { icon: <GitBranchIcon />, label: 'Branch', value: app.branch },
        {
          icon: <RefreshIcon />, label: 'Execução do workflow', value: app.runNumber && `#${app.runNumber}`,
          href: app.runNumber && app.repository ? `https://github.com/${app.repository}/actions` : null,
        },
        { icon: <GlobeIcon />, label: 'Caminho base', value: import.meta.env.BASE_URL },
      ]} />

      <Group title="Supabase" rows={[
        { icon: <ServerIcon />, label: 'Projeto', value: supabaseHost },
        {
          icon: <ShieldIcon />, label: 'Autenticação', value: auth?.ok ? `${auth.latencyMs} ms` : auth ? 'Sem resposta' : 'Verificando…',
          trailing: <Health result={auth} />,
        },
        { icon: <TagIcon />, label: 'Versão do Auth', value: auth?.version },
        {
          icon: <DatabaseIcon />, label: 'Banco de dados',
          value: database?.ok ? `${database.latencyMs} ms` : database ? 'Sem resposta' : 'Verificando…',
          trailing: <Health result={database} />,
        },
      ]} />

      <Group title="Sessão" rows={[
        { icon: <MailIcon />, label: 'Usuário', value: session?.user.email },
        { icon: <KeyIcon />, label: 'ID', value: <code>{session?.user.id}</code> },
        { icon: <UserIcon />, label: 'Perfil', value: profile?.role === 'admin' ? 'Administrador' : 'Usuário' },
        { icon: <ClockIcon />, label: 'Último login', value: formatDate(session?.user.last_sign_in_at) },
        { icon: <LockIcon />, label: 'Token expira em', value: formatDate(session?.expires_at ? session.expires_at * 1000 : null) },
        { icon: <ShieldIcon />, label: 'Provedor', value: session?.user.app_metadata.provider },
      ]} />

      <Group title="Dependências" rows={[
        { icon: <PackageIcon />, label: 'React', value: reactVersion },
        { icon: <PackageIcon />, label: 'Supabase JS', value: app.dependencies.supabase },
        { icon: <PackageIcon />, label: 'Vite', value: app.dependencies.vite },
      ]} />

      <Group title="Navegador" rows={[
        { icon: <GlobeIcon />, label: 'Idioma', value: navigator.language },
        { icon: <ClockIcon />, label: 'Fuso horário', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
        { icon: <MonitorIcon />, label: 'Tela', value: `${window.screen.width} × ${window.screen.height}` },
        { icon: <SmartphoneIcon />, label: 'Janela', value: `${window.innerWidth} × ${window.innerHeight}` },
        { icon: <WifiIcon />, label: 'Conexão', value: navigator.onLine ? 'Online' : 'Offline' },
        { icon: <CodeIcon />, label: 'User agent', value: <code>{navigator.userAgent}</code> },
      ]} />
    </>
  )
}
