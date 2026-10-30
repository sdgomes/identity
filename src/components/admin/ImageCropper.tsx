import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useFileDataUrl } from '../../hooks/useFileDataUrl'

// Moldura 3x4 (largura x altura), como foto de documento.
const FRAME_WIDTH = 240
const FRAME_HEIGHT = 320
const OUTPUT_WIDTH = 600
const OUTPUT_HEIGHT = 800
const MAX_ZOOM = 3

type View = { zoom: number, x: number, y: number }

type Props = {
  file: File
  onCancel: () => void
  onConfirm: (cropped: File) => void
}

export function ImageCropper({ file, onCancel, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ pointerX: number, pointerY: number, x: number, y: number } | null>(null)
  const [natural, setNatural] = useState<{ width: number, height: number } | null>(null)
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const sourceUrl = useFileDataUrl(file)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // Escala mínima para a imagem cobrir toda a moldura.
  const baseScale = natural ? Math.max(FRAME_WIDTH / natural.width, FRAME_HEIGHT / natural.height) : 1
  const scale = baseScale * view.zoom

  // Mantém a moldura sempre preenchida, sem faixas vazias.
  function clamp(next: View): View {
    if (!natural) return next
    const width = natural.width * baseScale * next.zoom
    const height = natural.height * baseScale * next.zoom
    return {
      zoom: next.zoom,
      x: Math.min(0, Math.max(FRAME_WIDTH - width, next.x)),
      y: Math.min(0, Math.max(FRAME_HEIGHT - height, next.y)),
    }
  }

  function handleLoad() {
    const image = imageRef.current
    if (!image) return
    const size = { width: image.naturalWidth, height: image.naturalHeight }
    const initialScale = Math.max(FRAME_WIDTH / size.width, FRAME_HEIGHT / size.height)
    setNatural(size)
    setView({
      zoom: 1,
      x: (FRAME_WIDTH - size.width * initialScale) / 2,
      y: (FRAME_HEIGHT - size.height * initialScale) / 2,
    })
  }

  // O zoom parte do centro da moldura.
  function handleZoom(zoom: number) {
    const ratio = zoom / view.zoom
    const centerX = FRAME_WIDTH / 2
    const centerY = FRAME_HEIGHT / 2
    setView(clamp({
      zoom,
      x: centerX - (centerX - view.x) * ratio,
      y: centerY - (centerY - view.y) * ratio,
    }))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, x: view.x, y: view.y }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    setView(clamp({
      zoom: view.zoom,
      x: drag.x + event.clientX - drag.pointerX,
      y: drag.y + event.clientY - drag.pointerY,
    }))
  }

  function handleConfirm() {
    const image = imageRef.current
    if (!image || !natural) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_WIDTH
    canvas.height = OUTPUT_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(
      image,
      -view.x / scale, -view.y / scale, FRAME_WIDTH / scale, FRAME_HEIGHT / scale,
      0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT,
    )
    canvas.toBlob((blob) => {
      if (blob) onConfirm(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  }

  return (
    <dialog ref={dialogRef} className="cropper" aria-labelledby="cropper-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}>
      <h2 id="cropper-title">Ajustar foto 3x4</h2>
      <p className="hint">Arraste para posicionar e use o zoom para enquadrar o rosto.</p>
      <div className="cropper-frame" style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}>
        {sourceUrl && <img ref={imageRef} src={sourceUrl} alt="" draggable={false} onLoad={handleLoad}
          style={{
            width: natural ? natural.width * scale : undefined,
            transform: `translate(${view.x}px, ${view.y}px)`,
            visibility: natural ? 'visible' : 'hidden',
          }} />}
      </div>
      <label className="cropper-zoom">
        Zoom
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={view.zoom}
          onChange={(event) => handleZoom(Number(event.target.value))} />
      </label>
      <div className="form-actions">
        <button type="button" onClick={handleConfirm} disabled={!natural}>Usar foto</button>
        <button type="button" className="button-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </dialog>
  )
}
