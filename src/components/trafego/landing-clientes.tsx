// Tela inicial de /campanhas (nenhum cliente selecionado): grade de cards por
// cliente com nome, objetivo, investido nos últimos 30d e um mini-sinal de saúde.
// Clicar leva para o painel do cliente (?cliente=). Decisão do usuário (15/jul/2026):
// cards em vez de auto-selecionar — casa com a visão futura de "portal do cliente".

import Link from 'next/link'
import { ArrowRight, Target } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { classificarObjetivo, type ClasseObjetivo, type Nicho } from '@/lib/trafego/aggregate'
import type { ResumoLandingCliente } from '@/lib/trafego/painel'
import type { StatusMeta } from '@/lib/trafego/semaforo'

// Anel de status do semáforo no "avatar" do cliente (Feature 1, item 3):
// cor do PIOR status entre as métricas monitoradas — verde se tudo ok.
const ANEL_STATUS: Record<StatusMeta, string> = {
  bom: 'ring-chart-success bg-chart-success/10 text-chart-success',
  atencao: 'ring-chart-warning bg-chart-warning/10 text-chart-warning',
  ruim: 'ring-destructive bg-destructive/10 text-destructive',
  sem_dados: 'ring-muted-foreground/40 bg-muted text-muted-foreground',
}

const TITULO_STATUS: Record<StatusMeta, string> = {
  bom: 'Métricas dentro da meta',
  atencao: 'Alguma métrica em atenção',
  ruim: 'Métrica fora da meta',
  sem_dados: 'Sem dados suficientes no período',
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const LABEL_CLASSE: Record<ClasseObjetivo, string> = {
  vendas: 'Vendas',
  leads: 'Leads',
  conversas: 'Conversas',
  engajamento: 'Engajamento',
  trafego: 'Tráfego',
}

const LABEL_NICHO: Record<Nicho, string> = {
  ecommerce: 'E-commerce',
  negocio_local: 'Negócio local',
  infoproduto: 'Infoproduto',
}

export type ClienteCard = {
  id: string
  nome: string
  nicho: Nicho
  objetivoPrincipal: string | null
}

type LandingClientesProps = {
  clientes: ClienteCard[]
  investido30d: Map<string, number>
  periodo: string
  /** Resumo do semáforo por cliente (resultado, custo/resultado, pior status). */
  resumo?: Map<string, ResumoLandingCliente>
}

export function LandingClientes({ clientes, investido30d, periodo, resumo }: LandingClientesProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Seus clientes</h2>
        <p className="text-sm text-muted-foreground">
          Escolha um cliente para ver a performance unificada de todas as contas dele.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clientes.map((c) => {
          const classe = classificarObjetivo(c.objetivoPrincipal)
          const objetivoLabel = classe ? LABEL_CLASSE[classe] : LABEL_NICHO[c.nicho]
          const investido = investido30d.get(c.id) ?? 0
          const ativo = investido > 0
          const r = resumo?.get(c.id)
          const status: StatusMeta | null = r?.statusPior ?? null
          const iniciais = c.nome
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? '')
            .join('')

          return (
            <Link
              key={c.id}
              href={`/campanhas?cliente=${c.id}&periodo=${periodo}`}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full gap-3 border-none p-5 shadow-[var(--shadow-sm)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-md)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {/* Avatar com ANEL do pior status do semáforo (verde se tudo ok). */}
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2',
                        status
                          ? ANEL_STATUS[status]
                          : ativo
                            ? ANEL_STATUS.bom
                            : 'bg-muted text-muted-foreground ring-muted-foreground/30',
                      )}
                      title={status ? TITULO_STATUS[status] : ativo ? 'Ativo no período' : 'Sem gasto no período'}
                    >
                      {iniciais}
                    </span>
                    <span className="truncate font-medium" title={c.nome}>
                      {c.nome}
                    </span>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
                    <Target className="size-3" />
                    {objetivoLabel}
                  </span>
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Investido</p>
                    <p className="text-base font-semibold tracking-tight tabular-nums">
                      {formatadorMoeda.format(r?.spend ?? investido)}
                    </p>
                  </div>
                  <div>
                    <p className="truncate text-xs text-muted-foreground" title={r?.heroiLabel ?? 'Resultado'}>
                      {r?.heroiLabel ?? 'Resultado'}
                    </p>
                    <p className="text-base font-semibold tracking-tight tabular-nums">
                      {r ? new Intl.NumberFormat('pt-BR').format(r.resultado) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo/result.</p>
                    <p className="text-base font-semibold tracking-tight tabular-nums">
                      {r?.custoPorResultado != null ? formatadorMoeda.format(r.custoPorResultado) : '—'}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
