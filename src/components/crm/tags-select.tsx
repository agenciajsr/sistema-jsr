'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'

import { criarTag, listarTags } from '@/actions/crm-tags'
import { Input } from '@/components/ui/input'
import { classesCorTag, CORES_TAG_KEYS } from '@/lib/crm/tags'
import { cn } from '@/lib/utils'

// Multi-select de tags do modal "Criar novo Lead" (imagem 08): trigger tipo
// select mostrando as escolhidas como badges, painel com busca "Pesquisar...",
// lista de badges coloridas (clique alterna) e link azul "Criar" no rodapé que
// cria a tag inline com o texto da busca. Sem lib nova: div absoluto + estado
// aberto/fechado + clique-fora (Popover não existe no registry do projeto).

export type TagCrm = { id: string; nome: string; cor: string }

type Props = {
  value: string[]
  onChange: (tagIds: string[]) => void
}

export function TagsSelect({ value, onChange }: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [tags, setTags] = useState<TagCrm[]>([])
  const [carregou, setCarregou] = useState(false)
  const [isPending, startTransition] = useTransition()
  const raizRef = useRef<HTMLDivElement>(null)

  // Carrega as tags do workspace na primeira abertura.
  useEffect(() => {
    if (!aberto || carregou) return
    startTransition(async () => {
      const r = await listarTags()
      if ('data' in r && r.data) {
        setTags(r.data)
        setCarregou(true)
      } else if ('error' in r) {
        toast.error(r.error)
      }
    })
  }, [aberto, carregou])

  // Clique-fora fecha o painel.
  useEffect(() => {
    if (!aberto) return
    function aoClicarFora(e: MouseEvent) {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  const selecionadas = tags.filter((t) => value.includes(t.id))
  const filtradas = busca.trim()
    ? tags.filter((t) => t.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : tags

  function alternar(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  function criarInline() {
    const nome = busca.trim()
    if (!nome) {
      toast.error('Digite o nome da nova tag na busca.')
      return
    }
    // Cor ciclada na paleta: distribui as cores conforme as tags vão nascendo.
    const cor = CORES_TAG_KEYS[tags.length % CORES_TAG_KEYS.length]
    startTransition(async () => {
      const r = await criarTag({ nome, cor })
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      if (r.data) {
        setTags((atuais) => [...atuais, r.data].sort((a, b) => a.nome.localeCompare(b.nome)))
        onChange([...value, r.data.id])
        setBusca('')
      }
    })
  }

  return (
    <div ref={raizRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs transition-colors hover:bg-accent/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {selecionadas.length === 0 ? (
          <span className="text-muted-foreground">Selecione as tags</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {selecionadas.map((t) => (
              <span
                key={t.id}
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-medium',
                  classesCorTag(t.cor)
                )}
              >
                {t.nome}
              </span>
            ))}
          </span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="border-b p-2">
            <Input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar..."
              className="h-8"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {isPending && !carregou ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Carregando tags...</p>
            ) : filtradas.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                {tags.length === 0
                  ? 'Nenhuma tag ainda — crie a primeira abaixo.'
                  : 'Nenhuma tag encontrada.'}
              </p>
            ) : (
              filtradas.map((t) => {
                const marcada = value.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => alternar(t.id)}
                    className={cn(
                      'flex w-full items-center rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-accent',
                      marcada && 'bg-accent'
                    )}
                  >
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        classesCorTag(t.cor)
                      )}
                    >
                      {t.nome}
                    </span>
                  </button>
                )
              })
            )}
          </div>
          <div className="flex justify-end border-t px-3 py-2">
            <button
              type="button"
              onClick={criarInline}
              disabled={isPending}
              className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
            >
              {isPending && carregou ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
