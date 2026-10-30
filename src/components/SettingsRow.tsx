import type { ReactNode } from 'react'

// Conteúdo de uma linha de lista agrupada (estilo Monarch): ícone em quadradinho, título com uma linha
// de apoio e, à direita, um selo, um valor ou a seta. Quem usa decide se a linha é <li>, <button> ou <a>.
export function SettingsRow({ icon, title, detail, trailing }: {
  icon: ReactNode
  title: string
  detail?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <>
      <span className="settings-icon">{icon}</span>
      <span className="settings-text">
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </span>
      {trailing}
    </>
  )
}
