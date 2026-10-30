import { useCallback, useState } from 'react'
import { ConfirmDialog, type ConfirmOptions } from '../components/ConfirmDialog'

type Pending = { options: ConfirmOptions, resolve: (confirmed: boolean) => void }

// Uso: const [confirm, confirmDialog] = useConfirm(); if (await confirm({...})) { ... }
// O componente precisa renderizar confirmDialog.
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  )

  const dialog = pending && (
    <ConfirmDialog options={pending.options} onClose={(confirmed) => {
      pending.resolve(confirmed)
      setPending(null)
    }} />
  )

  return [confirm, dialog] as const
}
