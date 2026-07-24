'use client'

// Avatar do header da ficha com upload da LOGO do cliente (lápis sobre o
// avatar). O arquivo escolhido abre o CropFotoDialog (zoom + enquadrar); a
// saída é sempre JPEG 512×512, então o limite de 2 MB nunca estoura.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { atualizarLogoCliente } from '@/actions/clientes'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CropFotoDialog } from '@/components/crop-foto-dialog'

export function LogoClienteUpload({
  clienteId,
  nome,
  logoUrl,
  iniciais,
}: {
  clienteId: string
  nome: string
  logoUrl: string | null
  iniciais: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [urlAtual, setUrlAtual] = useState(logoUrl)
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
    fd.set('file', new File([blob], 'logo.jpg', { type: 'image/jpeg' }))
    const result = await atualizarLogoCliente(clienteId, fd)
    setEnviando(false)
    if ('error' in result) {
      toast.error(result.error ?? 'Não foi possível enviar a logo.')
      return
    }
    toast.success('Logo atualizada.')
    if (result.data) setUrlAtual(result.data.logoUrl)
    router.refresh()
  }

  return (
    <div className="relative size-16 shrink-0">
      {urlAtual ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL pública do Supabase Storage; next/image exigiria configurar domínio remoto
        <img
          src={urlAtual}
          alt={`Logo de ${nome}`}
          className="size-16 rounded-full border object-cover"
        />
      ) : (
        <Avatar className="size-16">
          <AvatarFallback className="text-lg font-semibold">{iniciais}</AvatarFallback>
        </Avatar>
      )}
      <button
        type="button"
        title="Trocar logo do cliente"
        aria-label="Trocar logo do cliente"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
        className="absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow transition-colors hover:text-foreground disabled:opacity-50"
      >
        {enviando ? <Loader2 className="size-3 animate-spin" /> : <Pencil className="size-3" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={aoEscolher}
      />

      <CropFotoDialog
        file={arquivoParaCrop}
        titulo="Ajustar logo do cliente"
        onConfirmar={enviarRecortada}
        onCancelar={() => setArquivoParaCrop(null)}
      />
    </div>
  )
}
