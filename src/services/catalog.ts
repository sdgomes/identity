import { getSupabase } from '../lib/supabase'

export type Shift = 'matutino' | 'vespertino' | 'noturno'

export type Course = {
  id: number
  code: string
  name: string
  level: 'graduacao' | 'pos_graduacao'
  degree: 'bacharelado' | 'licenciatura' | 'tecnologo' | 'especializacao' | 'mba'
  duration_months: number
}

export type Campus = {
  id: number
  name: string
  code: string
  kind: 'digital' | 'presencial'
}

export const shiftLabels: Record<Shift, string> = {
  matutino: 'Matutino',
  vespertino: 'Vespertino',
  noturno: 'Noturno',
}

export function formatDuration(months: number) {
  const years = Math.floor(months / 12)
  const rest = months % 12
  const parts = [
    years ? `${years} ${years === 1 ? 'ano' : 'anos'}` : '',
    rest ? `${rest} ${rest === 1 ? 'mês' : 'meses'}` : '',
  ]
  return parts.filter(Boolean).join(' e ')
}

export const catalogService = {
  courses: () => getSupabase().from('courses').select('*').order('name').returns<Course[]>(),
  campuses: () => getSupabase().from('campuses').select('*').order('name').returns<Campus[]>(),
}
