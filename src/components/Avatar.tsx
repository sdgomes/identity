function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)
  return letters.toUpperCase()
}

export function Avatar({ name, url, size = 36 }: { name: string, url?: string | null, size?: number }) {
  return (
    <span className="avatar-image" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : initials(name || '?')}
    </span>
  )
}
