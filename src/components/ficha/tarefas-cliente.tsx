// Seção "Tarefas" da ficha do cliente (quick-260717-i26).
// Server component simples, sem interação — exibe abertas primeiro e o
// histórico de concluídas/não realizadas. Moldes nunca chegam aqui.

import Link from 'next/link'
import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import type { TarefaFicha } from '@/lib/tarefas/ficha-cliente'
import { hojeBrasilia } from '@/lib/date-br'

const PRIORIDADE_LABEL: Record<TarefaFicha['prioridade'], string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

// Cores pastel com variante dark: (memória do projeto sobre dark mode).
const PRIORIDADE_CLASSE: Record<TarefaFicha['prioridade'], string> = {
  baixa: 'bg-muted text-muted-foreground',
  media: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  alta: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  urgente: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

const STATUS_ABERTA_LABEL: Record<string, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
}

function formatarDataCurta(iso: string) {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

export function TarefasCliente({
  abertas,
  historico,
}: {
  abertas: TarefaFicha[]
  historico: TarefaFicha[]
}) {
  const hoje = hojeBrasilia()

  if (abertas.length === 0 && historico.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma tarefa vinculada a este cliente.
        </p>
        <Link href="/tarefas" className="text-sm font-medium text-primary hover:underline">
          Ver em Tarefas →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] leading-tight font-semibold">
            Abertas {abertas.length > 0 && `(${abertas.length})`}
          </h2>
          <Link href="/tarefas" className="text-sm font-medium text-primary hover:underline">
            Ver em Tarefas →
          </Link>
        </div>
        {abertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa aberta para este cliente.</p>
        ) : (
          <ul className="space-y-2">
            {abertas.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t.codigo && (
                      <span className="mr-1.5 text-xs text-muted-foreground">{t.codigo}</span>
                    )}
                    {t.titulo}
                  </p>
                  {t.subtitulo && (
                    <p className="truncate text-xs text-muted-foreground">{t.subtitulo}</p>
                  )}
                  {t.responsavelNome && (
                    <p className="text-xs text-muted-foreground">Resp.: {t.responsavelNome}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary" className={PRIORIDADE_CLASSE[t.prioridade]}>
                    {PRIORIDADE_LABEL[t.prioridade]}
                  </Badge>
                  <Badge variant="outline">{STATUS_ABERTA_LABEL[t.status] ?? t.status}</Badge>
                  <span
                    className={`text-xs tabular-nums ${
                      t.data < hoje ? 'font-medium text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {t.data < hoje ? 'Venceu ' : 'Vence '}
                    {formatarDataCurta(t.data)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {historico.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[20px] leading-tight font-semibold">Histórico</h2>
          <ul className="space-y-2">
            {historico.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-2 rounded-lg border bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {t.codigo && <span className="mr-1.5 text-xs">{t.codigo}</span>}
                    {t.titulo}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {t.status === 'nao_realizada' ? (
                    <Badge
                      variant="secondary"
                      className="bg-muted text-muted-foreground"
                    >
                      Não realizada
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    >
                      Concluída
                    </Badge>
                  )}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t.concluidaEm
                      ? format(t.concluidaEm, 'dd/MM/yyyy')
                      : formatarDataCurta(t.data)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
