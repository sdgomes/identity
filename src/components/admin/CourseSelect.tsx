import { formatDuration, type Course } from '../../services/catalog'

const groups: { level: Course['level'], label: string }[] = [
  { level: 'graduacao', label: 'Graduação' },
  { level: 'pos_graduacao', label: 'Pós-graduação' },
]

type Props = {
  courses: Course[]
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export function CourseSelect({ courses, value, onChange, required }: Props) {
  return (
    <select value={value} required={required} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione o curso</option>
      {groups.map((group) => (
        <optgroup key={group.level} label={group.label}>
          {courses.filter((course) => course.level === group.level).map((course) => (
            <option key={course.id} value={course.id}>
              {course.name} · {formatDuration(course.duration_months)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
