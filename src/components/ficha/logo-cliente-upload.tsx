'use client'

// Avatar do header da ficha com upload da LOGO do cliente (lápis sobre o
// avatar). Espelha a UX da foto do lead (crm/ficha-lead.tsx): input file
// escondido + botão-lápis; ao escolher, envia via server action e atualiza.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { atualizarLogoCliente } from '@/actions/clientes'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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
  // Otimista: mostra a nova logo assim que o servidor confirma, sem esperar o
  // refresh completo repintar o header.
  const [urlAtual, setUrlAtual] = useState(logoUrl)

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo
    if (!file) return
    setEnviando(true)
    const fd = new FormData()
    fd.set('file', file)
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
    </div>
  )
}
