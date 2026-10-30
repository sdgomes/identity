import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './layout/icons'

// Modal que cobre a tela toda: cabeçalho fixo com o título no centro e o X à direita (estilo Monarch);
// o conteúdo rola por baixo. Esc também fecha.
export function FullScreenDialog({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog ref={dialogRef} className="fullscreen-dialog" aria-labelledby="fullscreen-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}>
      <header className="fullscreen-dialog-header">
        <h2 id="fullscreen-dialog-title">{title}</h2>
        <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="fullscreen-dialog-body">{children}</div>
    </dialog>
  )
}
