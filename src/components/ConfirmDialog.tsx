import { useEffect, useRef } from 'react'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
}

// Substitui window.confirm, que alguns navegadores e webviews bloqueiam em silêncio.
export function ConfirmDialog({ options, onClose }: { options: ConfirmOptions, onClose: (confirmed: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose(false)
      }}>
      <h2 id="confirm-title">{options.title}</h2>
      <p>{options.message}</p>
      <div className="form-actions">
        <button type="button" className={options.danger ? 'button-danger-solid' : undefined}
          onClick={() => onClose(true)}>
          {options.confirmLabel}
        </button>
        <button type="button" className="button-secondary" autoFocus onClick={() => onClose(false)}>Cancelar</button>
      </div>
    </dialog>
  )
}
