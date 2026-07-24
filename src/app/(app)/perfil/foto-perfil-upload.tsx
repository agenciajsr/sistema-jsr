'use client'

// Avatar do /perfil com upload da própria foto (lápis sobre o avatar).
// O arquivo escolhido abre o CropFotoDialog (zoom + enquadrar); a saída é
// sempre JPEG 512×512, então o limite de 2 MB nunca estoura.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { atualizarMinhaFoto } from '@/actions/perfil'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CropFotoDialog } from '@/components/crop-foto-dialog'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return [partes[0], partes[partes.length - 1]]
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

export function FotoPerfilUpload({
  nome,
  fotoUrl,
}: {
  nome: string
  fotoUrl: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [urlAtual, setUrlAtual] = useState(fotoUrl)
  const [arquivoParaCrop, setArquivoParaCrop] = useState<File | null>(null)

  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Envie uma imagem (JPG, PNG ou WebP).')
      return
    }
    setArquivoParaCrop(file)
  }

  async function enviarRecortada(blob: Blob) {
    setArquivoParaCrop(null)
    setEnviando(true)
    const fd = new FormData()
    fd.set('file', new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
    const result = await atualizarMinhaFoto(fd)
    setEnviando(false)
    if ('error' in result) {
      toast.error(result.error ?? 'Não foi possível enviar a foto.')
      return
    }
    toast.success('Foto atualizada.')
    setUrlAtual(result.data.fotoUrl)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0">
        {urlAtual ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL pública do Supabase Storage
          <img
            src={urlAtual}
            alt={`Foto de ${nome}`}
            className="size-20 rounded-full border object-cover"
          />
        ) : (
          <Avatar className="size-20">
            <AvatarFallback className="text-xl font-semibold">{iniciais(nome)}</AvatarFallback>
          </Avatar>
        )}
        <button
          type="button"
          title="Trocar foto"
          aria-label="Trocar foto"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow transition-colors hover:text-foreground disabled:opacity-50"
        >
          {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={aoEscolher}
        />
      </div>
      <div>
        <p className="text-sm font-medium">{nome}</p>
        <p className="text-xs text-muted-foreground">Clique no lápis para trocar sua foto</p>
      </div>

      <CropFotoDialog
        file={arquivoParaCrop}
        titulo="Ajustar foto de perfil"
        onConfirmar={enviarRecortada}
        onCancelar={() => setArquivoParaCrop(null)}
      />
    </div>
  )
}
