// Tela inicial de /campanhas (nenhum cliente selecionado): grade de cards por
// cliente com nome, objetivo, investido nos últimos 30d e um mini-sinal de saúde.
// Clicar leva para o painel do cliente (?cliente=). Decisão do usuário (15/jul/2026):
// cards em vez de auto-selecionar — casa com a visão futura de "portal do cliente".

import Link from 'next/link'
import { ArrowRight, Target } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { classificarObjetivo, type ClasseObjetivo, type Nicho } from '@/lib/trafego/aggregate'

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
}

export function LandingClientes({ clientes, investido30d, periodo }: LandingClientesProps) {
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

          return (
            <Link
              key={c.id}
              href={`/campanhas?cliente=${c.id}&periodo=${periodo}`}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full gap-3 border-none p-5 shadow-[var(--shadow-sm)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-md)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        ativo ? 'bg-chart-success' : 'bg-muted-foreground/40',
                      )}
                      title={ativo ? 'Ativo nos últimos 30 dias' : 'Sem gasto nos últimos 30 dias'}
                    />
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

                <div className="mt-auto">
                  <p className="text-xs text-muted-foreground">Investido (30 dias)</p>
                  <p className="text-xl font-semibold tracking-tight tabular-nums">
                    {formatadorMoeda.format(investido)}
                  </p>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
