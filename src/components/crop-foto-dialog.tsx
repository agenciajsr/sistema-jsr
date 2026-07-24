'use client'

// Dialog de ajuste de foto (zoom + arrastar para enquadrar) usado pela logo do
// cliente e pela foto de perfil. Saída SEMPRE JPEG 512×512 (~<300KB), o que
// também garante que o limite de 2 MB do upload nunca estoure.

import { useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const TAMANHO_SAIDA = 512

async function recortarParaBlob(imagemUrl: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Falha ao carregar a imagem.'))
    el.src = imagemUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = TAMANHO_SAIDA
  canvas.height = TAMANHO_SAIDA
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível.')
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    TAMANHO_SAIDA,
    TAMANHO_SAIDA,
  )
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))),
      'image/jpeg',
      0.9,
    )
  })
}

export function CropFotoDialog({
  file,
  titulo,
  formatoRedondo = true,
  onConfirmar,
  onCancelar,
}: {
  /** Arquivo escolhido no input; null fecha o dialog. */
  file: File | null
  titulo: string
  /** true = máscara circular (fotos/avatares); false = quadrada. */
  formatoRedondo?: boolean
  onConfirmar: (blob: Blob) => void | Promise<void>
  onCancelar: () => void
}) {
  const [imagemUrl, setImagemUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!file) {
      setImagemUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setImagemUrl(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setAreaPixels(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function confirmar() {
    if (!imagemUrl || !areaPixels) return
    setSalvando(true)
    try {
      const blob = await recortarParaBlob(imagemUrl, areaPixels)
      await onConfirmar(blob)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={file !== null} onOpenChange={(aberto) => !aberto && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted">
          {imagemUrl && (
            <Cropper
              image={imagemUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape={formatoRedondo ? 'round' : 'rect'}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setAreaPixels(px)}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="Zoom da foto"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Arraste a imagem para enquadrar e use o zoom para aproximar.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={salvando || !areaPixels}>
            {salvando ? 'Salvando...' : 'Salvar foto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
