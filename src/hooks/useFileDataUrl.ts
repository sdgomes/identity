import { useEffect, useState } from 'react'

// Lê o arquivo como data URL. Diferente de URL.createObjectURL, não há URL a revogar,
// então a montagem dupla do StrictMode não invalida a imagem.
export function useFileDataUrl(file: File | null) {
  const [result, setResult] = useState<{ file: File, url: string } | null>(null)

  useEffect(() => {
    if (!file) return
    let active = true
    const reader = new FileReader()
    reader.onload = () => {
      if (active && typeof reader.result === 'string') setResult({ file, url: reader.result })
    }
    reader.readAsDataURL(file)
    return () => {
      active = false
      reader.abort()
    }
  }, [file])

  return file && result?.file === file ? result.url : null
}
