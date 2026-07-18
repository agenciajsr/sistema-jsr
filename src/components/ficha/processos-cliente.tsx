'use client'

// Abas Onboarding e Retenção da ficha do cliente (Fase 6 do funil).
// (gp5): o processo agora É uma tarefa — o checklist exibido/operado aqui é o
// checklist da TAREFA do processo (tarefa_checklist_items), fonte única.
// O modelo editável (processo_modelo_itens) continua sendo a origem dos itens
// ao gerar; a gestão de atenção (crise) do cliente segue igual.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, ExternalLink, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  alternarItemProcesso,
  colocarClienteEmAtencao,
  criarModeloItem,
  excluirModeloItem,
  atualizarModeloItem,
  gerarChecklistProcesso,
  listarModeloProcesso,
  removerClienteDaAtencao,
} from '@/actions/processos'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

// (gp5): item do checklist da TAREFA do processo — binário (feito/não feito).
// Itens opcionais já vêm com o sufixo ' (opcional)' no texto.
export type ItemProcesso = {
  id: string
  texto: string
  concluido: boolean
  ordem: number
}

/** A tarefa do processo do cliente, com seu checklist (montada na page). */
export type ProcessoDaFicha = {
  tarefaId: string
  data: string
  status: string
  itens: ItemProcesso[]
}

type ItemModelo = {
  id: string
  titulo: string
  ordem: number
  opcional: boolean
  ativo: boolean
}

function calcularProgresso(itens: ItemProcesso[]): { feitos: number; total: number; pct: number } {
  const feitos = itens.filter((i) => i.concluido).length
  const total = itens.length
  return { feitos, total, pct: total === 0 ? 0 : Math.round((feitos / total) * 100) }
}

// --- Checklist genérico (usado pelo onboarding, retenção e saída) ---

type TipoProcessoUi = 'onboarding' | 'retencao' | 'saida'

function ChecklistProcesso({
  clienteId,
  tipo,
  processo,
  vazioTexto,
}: {
  clienteId: string
  tipo: TipoProcessoUi
  processo: ProcessoDaFicha | null
  vazioTexto: string
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function alternar(itemId: string, concluido: boolean) {
    startTransition(async () => {
      const r = await alternarItemProcesso(itemId, concluido, clienteId)
      if (r.error) toast.error(r.error)
      else router.refresh()
    })
  }

  function gerar() {
    startTransition(async () => {
      const r = await gerarChecklistProcesso(clienteId, tipo)
      if (r.error) toast.error(r.error)
      else {
        toast.success('Tarefa do processo criada a partir do modelo.')
        router.refresh()
      }
    })
  }

  if (!processo || processo.itens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
        <ListChecks className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{vazioTexto}</p>
        <Button onClick={gerar} disabled={pendente}>
          Gerar checklist do modelo
        </Button>
      </div>
    )
  }

  const { feitos, total, pct } = calcularProgresso(processo.itens)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">
            Progresso: {feitos}/{total} {pct === 100 && '🎉'}
          </span>
          <span className="flex items-center gap-3">
            <span className="text-muted-foreground">{pct}%</span>
            <Button asChild variant="outline" size="sm">
              <Link href={`/tarefas/${processo.tarefaId}`}>
                <ExternalLink className="size-3.5" /> Abrir tarefa
              </Link>
            </Button>
          </span>
        </div>
        <Progress value={pct} />
      </div>

      <ul className="space-y-2">
        {processo.itens.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <button
              type="button"
              aria-label={item.concluido ? 'Reabrir item' : 'Concluir item'}
              disabled={pendente}
              onClick={() => alternar(item.id, !item.concluido)}
              className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                item.concluido
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input hover:border-primary'
              }`}
            >
              {item.concluido && <Check className="size-3.5" />}
            </button>
            <span
              className={`min-w-0 flex-1 text-sm ${item.concluido ? 'text-muted-foreground line-through' : ''}`}
            >
              {item.texto}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- Dialog de edição do modelo ---

const NOME_MODELO: Record<TipoProcessoUi, string> = {
  onboarding: 'onboarding',
  retencao: 'retenção',
  saida: 'saída do cliente',
}

function ModeloDialog({ tipo }: { tipo: TipoProcessoUi }) {
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState<ItemModelo[] | null>(null)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [pendente, startTransition] = useTransition()

  async function carregar() {
    const r = await listarModeloProcesso(tipo)
    if (r.error || !r.data) toast.error(r.error ?? 'Falha ao carregar o modelo.')
    else setItens(r.data)
  }

  function abrir(v: boolean) {
    setAberto(v)
    if (v) void carregar()
  }

  function adicionar() {
    if (!novoTitulo.trim()) return
    startTransition(async () => {
      const r = await criarModeloItem(tipo, novoTitulo, false)
      if (r.error) toast.error(r.error)
      else {
        setNovoTitulo('')
        await carregar()
      }
    })
  }

  function alternar(item: ItemModelo, campos: { opcional?: boolean; ativo?: boolean }) {
    startTransition(async () => {
      const r = await atualizarModeloItem(item.id, campos)
      if (r.error) toast.error(r.error)
      else await carregar()
    })
  }

  function excluir(itemId: string) {
    startTransition(async () => {
      const r = await excluirModeloItem(itemId)
      if (r.error) toast.error(r.error)
      else await carregar()
    })
  }

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" /> Editar modelo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modelo de {NOME_MODELO[tipo]}</DialogTitle>
          <DialogDescription>
            Clientes novos nascem com os itens ATIVOS deste modelo. Mudanças aqui não
            alteram checklists já criados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {itens === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {itens?.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
              <span className={`min-w-0 flex-1 text-sm ${item.ativo ? '' : 'text-muted-foreground line-through'}`}>
                {item.titulo}
              </span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Opcional
                <Switch
                  checked={item.opcional}
                  disabled={pendente}
                  onCheckedChange={(v) => alternar(item, { opcional: v })}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Ativo
                <Switch
                  checked={item.ativo}
                  disabled={pendente}
                  onCheckedChange={(v) => alternar(item, { ativo: v })}
                />
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                disabled={pendente}
                onClick={() => excluir(item.id)}
                aria-label="Excluir item do modelo"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            placeholder="Novo item do modelo…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                adicionar()
              }
            }}
          />
          <Button onClick={adicionar} disabled={pendente || !novoTitulo.trim()}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Aba Onboarding ---

export function OnboardingCliente({
  clienteId,
  processo,
}: {
  clienteId: string
  processo: ProcessoDaFicha | null
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-secondary/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[20px] leading-tight font-semibold">Onboarding do cliente</h2>
        <ModeloDialog tipo="onboarding" />
      </div>
      <ChecklistProcesso
        clienteId={clienteId}
        tipo="onboarding"
        processo={processo}
        vazioTexto="Este cliente ainda não tem checklist de onboarding. Ele é criado automaticamente quando o cliente vira ativo — ou gere agora a partir do modelo."
      />
    </section>
  )
}

// --- Saída do cliente (offboarding) ---
// Aparece na aba Retenção quando o cliente foi encerrado OU quando já existe
// checklist de saída. O checklist nasce automático ao mudar o status para
// "Encerrado" (updateCliente) — aqui também dá pra gerar na mão.

export function SaidaCliente({
  clienteId,
  encerrado,
  motivoEncerramento,
  processo,
}: {
  clienteId: string
  encerrado: boolean
  motivoEncerramento: string | null
  processo: ProcessoDaFicha | null
}) {
  if (!encerrado && (!processo || processo.itens.length === 0)) return null

  return (
    <section className="space-y-4 rounded-xl border bg-secondary/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[20px] leading-tight font-semibold">Saída do cliente</h2>
        <ModeloDialog tipo="saida" />
      </div>
      {motivoEncerramento && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">Motivo do encerramento</p>
          <p className="text-muted-foreground">{motivoEncerramento}</p>
        </div>
      )}
      <ChecklistProcesso
        clienteId={clienteId}
        tipo="saida"
        processo={processo}
        vazioTexto="Cliente encerrado sem checklist de saída — gere a partir do modelo para encerrar tudo direitinho (campanhas, acessos, cobranças)."
      />
    </section>
  )
}

// --- Aba Retenção / Gestão de crise ---

export function RetencaoCliente({
  clienteId,
  clienteNome,
  emAtencao,
  motivoAtencao,
  processo,
}: {
  clienteId: string
  clienteNome: string
  emAtencao: boolean
  motivoAtencao: string | null
  processo: ProcessoDaFicha | null
}) {
  const router = useRouter()
  const [motivo, setMotivo] = useState('')
  const [dialogAberto, setDialogAberto] = useState(false)
  const [pendente, startTransition] = useTransition()

  function marcar() {
    startTransition(async () => {
      const r = await colocarClienteEmAtencao(clienteId, motivo)
      if (r.error) toast.error(r.error)
      else {
        toast.success('Cliente em atenção — checklist de retenção criado.')
        setDialogAberto(false)
        setMotivo('')
        router.refresh()
      }
    })
  }

  function remover() {
    startTransition(async () => {
      const r = await removerClienteDaAtencao(clienteId)
      if (r.error) toast.error(r.error)
      else {
        toast.success('Cliente voltou ao status ativo.')
        router.refresh()
      }
    })
  }

  return (
    <section className="space-y-4 rounded-xl border bg-secondary/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[20px] leading-tight font-semibold">Retenção &amp; gestão de crise</h2>
        {emAtencao ? (
          <div className="flex items-center gap-2">
            <ModeloDialog tipo="retencao" />
            <Button variant="outline" size="sm" onClick={remover} disabled={pendente}>
              Remover atenção
            </Button>
          </div>
        ) : (
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <AlertTriangle className="size-3.5" /> Colocar em atenção
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Colocar {clienteNome} em atenção</DialogTitle>
                <DialogDescription>
                  O cliente entra no status &quot;Em Aviso&quot; e ganha o checklist de
                  retenção para reverter a situação.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="motivo-atencao">Motivo da atenção</Label>
                <Textarea
                  id="motivo-atencao"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: insatisfeito com resultados, ameaçou cancelar, fatura em atraso…"
                />
              </div>
              <Button onClick={marcar} disabled={pendente || !motivo.trim()}>
                Confirmar atenção
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {emAtencao ? (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-chart-warning/40 bg-chart-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-chart-warning" />
            <div>
              <p className="font-medium">Cliente em atenção</p>
              <p className="text-muted-foreground">{motivoAtencao ?? 'Motivo não informado.'}</p>
            </div>
          </div>
          <ChecklistProcesso
            clienteId={clienteId}
            tipo="retencao"
            processo={processo}
            vazioTexto="Sem checklist de retenção ainda — gere a partir do modelo para estruturar o plano de reversão."
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Cliente sem sinal de crise no momento. Quando algo preocupar (risco de churn,
          insatisfação, inadimplência), use &quot;Colocar em atenção&quot; para ativar o plano
          de retenção.
        </p>
      )}
    </section>
  )
}
