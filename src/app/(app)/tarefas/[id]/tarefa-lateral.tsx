'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download,
  File,
  FileSpreadsheet,
  FileText,
  History,
  Image as ImageIcon,
  Maximize2,
  MoreHorizontal,
  Paperclip,
  Play,
  Plus,
  Presentation,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditorNotas } from '@/components/tarefas/editor-notas'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TarefaDetalhe as TarefaDetalheTipo, AnexoTarefa, AtividadeTarefa } from '@/lib/tarefas/dados'
import {
  STATUS_CLASSE,
  corDoAvatar,
  formatarTamanho,
  iniciais,
  tempoRelativo,
  textoAtividade,
  tipoDeArquivo,
} from '@/lib/tarefas/quadro'
import type { TarefaStatus } from '@/lib/tarefas/recorrencia'
import { atualizarTarefa } from '@/actions/tarefas'

// Zero cálculo solto aqui: rótulo, classe, tamanho e "há X" vêm todos de
// quadro.ts (puro e testado). Os componentes só exibem.

/** Ícone lucide por rótulo devolvido por tipoDeArquivo(). */
const ICONE_ARQUIVO: Record<string, LucideIcon> = {
  Planilha: FileSpreadsheet,
  PDF: FileText,
  Apresentação: Presentation,
  Imagem: ImageIcon,
  Documento: FileText,
  Arquivo: File,
}

/** Uma linha de anexo — reusada no card lateral e na aba Anexos. */
export function AnexoLinha({
  anexo,
  onBaixar,
  onRemover,
}: {
  anexo: AnexoTarefa
  onBaixar: (id: string) => void
  onRemover: (id: string) => void
}) {
  const info = tipoDeArquivo(anexo.nome, anexo.mimeType)
  const Icone = ICONE_ARQUIVO[info.rotulo] ?? File

  return (
    <div className="flex items-center gap-3">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${info.classe}`}>
        <Icone className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{anexo.nome}</p>
        <p className="text-xs text-muted-foreground">
          {info.rotulo} • {formatarTamanho(anexo.tamanhoBytes)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => onBaixar(anexo.id)}
        aria-label={`Baixar ${anexo.nome}`}
      >
        <Download className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Mais ações do anexo">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onRemover(anexo.id)}
          >
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Uma linha de atividade — reusada no card lateral e no painel Atividade.
 *  `compacta` (painel qr2): sem avatar, texto xs discreto — evento não disputa
 *  atenção com os cards de comentário. */
export function AtividadeLinha({
  atv,
  agora,
  compacta = false,
}: {
  atv: AtividadeTarefa
  agora: string
  compacta?: boolean
}) {
  const { frase, valor } = textoAtividade(atv)
  const ehBadge =
    atv.tipo === 'campo_alterado' && (atv.campo === 'status' || atv.campo === 'prioridade')
  // O badge de status na atividade usa a mesma cor do chip da grade (mockup).
  const badgeClasse =
    atv.campo === 'status' && atv.para
      ? (STATUS_CLASSE[atv.para as TarefaStatus] ?? '')
      : ''

  if (compacta) {
    return (
      <div className="flex flex-wrap items-center gap-1 px-1 text-xs text-muted-foreground">
        <b className="text-foreground">{atv.autorNome}</b>
        <span>{frase}</span>
        {valor &&
          atv.tipo !== 'comentou' &&
          (ehBadge ? (
            <Badge variant="outline" className={badgeClasse}>
              {atv.campo === 'status' && atv.para === 'em_andamento' && (
                <Play className="size-3 fill-current" />
              )}
              {valor}
            </Badge>
          ) : (
            <span className="font-medium text-foreground">{valor}</span>
          ))}
        <span className="ml-auto">{tempoRelativo(atv.createdAt, agora)}</span>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Avatar size="sm">
        <AvatarFallback className={`text-[10px] font-semibold ${corDoAvatar(atv.autorId)}`}>
          {iniciais(atv.autorNome)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-sm">
        <span className="flex flex-wrap items-center gap-1">
          <b>{atv.autorNome}</b>
          <span className="text-muted-foreground">{frase}</span>
          {valor &&
            atv.tipo !== 'comentou' &&
            (ehBadge ? (
              <Badge variant="outline" className={badgeClasse}>
                {atv.campo === 'status' && atv.para === 'em_andamento' && (
                  <Play className="size-3 fill-current" />
                )}
                {valor}
              </Badge>
            ) : (
              <span className="font-medium">{valor}</span>
            ))}
        </span>
        {/* Mockup: o trecho do comentário vai na linha de baixo, como citação. */}
        {atv.tipo === 'comentou' && valor && (
          <p className="truncate text-sm">&ldquo;{valor}&rdquo;</p>
        )}
        <p className="text-xs text-muted-foreground">{tempoRelativo(atv.createdAt, agora)}</p>
      </div>
    </div>
  )
}

export function TarefaLateral({
  tarefa,
  agora,
  onIrParaAba,
  onArquivoEscolhido,
  onBaixarAnexo,
  onRemoverAnexo,
  enviandoAnexo,
}: {
  tarefa: TarefaDetalheTipo
  agora: string
  onIrParaAba: (aba: string) => void
  onArquivoEscolhido: (file: File) => void
  onBaixarAnexo: (id: string) => void
  onRemoverAnexo: (id: string) => void
  enviandoAnexo: boolean
}) {
  const router = useRouter()
  const [salvando, startSalvar] = useTransition()
  // `notas` guarda o HTML atual do editor (atualizado no onChange). O editor é
  // NÃO-controlado, então este estado só alimenta o guard de igualdade e o salvar.
  const [notas, setNotas] = useState(tarefa.notas ?? '')
  const [ultimoSave, setUltimoSave] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(false)
  // Editor não-controlado: para "Limpar notas" refletir na tela, forçamos o
  // remount trocando a key.
  const [resetKey, setResetKey] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function salvarNotas(valor: string) {
    if (valor === (tarefa.notas ?? '')) return
    startSalvar(async () => {
      const res = await atualizarTarefa(tarefa.id, { notas: valor })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setUltimoSave(new Date().toISOString())
      router.refresh()
    })
  }

  const anexosCard = tarefa.anexos.slice(0, 4)
  const atividadesCard = tarefa.atividades.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Notas */}
      <Card>
        <CardHeader className="flex items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <StickyNote className="size-4 text-muted-foreground" />
            Notas
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setExpandido((v) => !v)}
              aria-label={expandido ? 'Recolher notas' : 'Expandir notas'}
            >
              <Maximize2 className="size-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Ações das notas">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={notas.trim().length === 0}
                  onClick={() => {
                    setNotas('')
                    salvarNotas('')
                    setResetKey((k) => k + 1)
                  }}
                >
                  Limpar notas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Mockup: toolbar e texto DENTRO da mesma caixa com borda. */}
          <EditorNotas
            key={resetKey}
            valorInicial={tarefa.notas ?? ''}
            expandido={expandido}
            onChange={setNotas}
            onBlur={(html) => salvarNotas(html)}
            placeholder="Anotações rápidas..."
            aria-label="Notas da tarefa"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {salvando
                ? 'Salvando...'
                : ultimoSave
                  ? `Salvo ${tempoRelativo(ultimoSave, agora)}`
                  : 'As notas salvam ao sair do campo'}
            </span>
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => setExpandido((v) => !v)}
            >
              {expandido ? 'Recolher' : 'Mostrar tudo'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Anexos */}
      <Card>
        <CardHeader className="flex items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Paperclip className="size-4 text-muted-foreground" />
            Anexos
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={enviandoAnexo}
            onClick={() => fileRef.current?.click()}
          >
            <Plus className="size-4" />
            {enviandoAnexo ? 'Enviando...' : 'Adicionar'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onArquivoEscolhido(f)
              e.target.value = ''
            }}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {anexosCard.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo anexado ainda.</p>
          ) : (
            anexosCard.map((a) => (
              <AnexoLinha key={a.id} anexo={a} onBaixar={onBaixarAnexo} onRemover={onRemoverAnexo} />
            ))
          )}
          {tarefa.anexos.length > 0 && (
            <button
              type="button"
              className="w-full pt-1 text-center text-xs text-primary hover:underline"
              onClick={() => onIrParaAba('anexos')}
            >
              Ver todos anexos
            </button>
          )}
        </CardContent>
      </Card>

      {/* Atividade Recente */}
      <Card>
        <CardHeader className="flex items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="size-4 text-muted-foreground" />
            Atividade Recente
          </CardTitle>
          {tarefa.atividades.length > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => onIrParaAba('atividade')}
            >
              Ver tudo
            </button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {atividadesCard.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
          ) : (
            atividadesCard.map((a) => <AtividadeLinha key={a.id} atv={a} agora={agora} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}
