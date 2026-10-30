// Datas sem horário (YYYY-MM-DD) são lidas no fuso local para não voltar um dia.
export function formatDay(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

// "há 5 minutos", "ontem"; passada uma semana, mostra a data.
export function formatRelative(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const minutes = Math.round((date.getTime() - Date.now()) / 60000)
  if (minutes >= 0) return 'agora'
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 7) return relative.format(days, 'day')
  return date.toLocaleDateString('pt-BR')
}
