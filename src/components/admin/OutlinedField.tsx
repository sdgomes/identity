import type { ReactNode } from 'react'

// Campo contornado com o rótulo sobre a borda (Shipt). Os largos ocupam a linha toda; os outros vão em pares.
export function OutlinedField({ label, wide, children }: { label: string, wide?: boolean, children: ReactNode }) {
  return (
    <label className={wide ? 'outlined-field outlined-field-wide' : 'outlined-field'}>
      <span>{label}</span>
      {children}
    </label>
  )
}
