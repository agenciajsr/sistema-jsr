import { Briefcase, DollarSign, Radar, Target, UserPlus } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiltroFeed } from '@/components/acompanhamento/filtro-feed'
import { getFeedAtividades, type ItemFeed, type JanelaFeed } from '@/lib/acompanhamento/feed'
import { cn } from '@/lib/utils'

// Backstop contra o timeout de 300s da Vercel (padrão das páginas do grupo app).
export const maxDuration = 60

const CONFIG_FONTE: Record<
  ItemFeed['fonte'],
  { rotulo: string; classe: string; icon: React.ComponentType<{ className?: string }> }
> = {
  acompanhamento: { rotulo: 'Cliente', classe: 'bg-chart-purple/10 text-chart-purple', icon: Briefcase },
  crm: { rotulo: 'CRM', classe: 'bg-chart-info/10 text-chart-info', icon: Target },
  financeiro: { rotulo: 'Financeiro', classe: 'bg-chart-success/10 text-chart-success', icon: DollarSign },
  cliente_novo: { rotulo: 'Novo cliente', classe: 'bg-chart-orange/10 text-chart-orange', icon: UserPlus },
}

function rotuloDia(d: Date): string {
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "dd/MM/yyyy (EEEE)", { locale: ptBR })
}

// Resolve o período da URL numa janela [de, ate). Dias no fuso LOCAL do
// servidor (São Paulo na Vercel — memória vercel-regiao-saopaulo).
function resolverJanela(periodo?: string, dia?: string): JanelaFeed {
  const umDia = 24 * 60 * 60 * 1000
  if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    const de = new Date(`${dia}T00:00:00-03:00`)
    return { de, ate: new Date(de.getTime() + umDia) }
  }
  const hoje = new Date()
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const amanha = new Date(inicioHoje.getTime() + umDia)
  if (periodo === 'hoje') return { de: inicioHoje, ate: amanha }
  if (periodo === 'ontem') return { de: new Date(inicioHoje.getTime() - umDia), ate: inicioHoje }
  if (periodo === '30d') return { de: new Date(inicioHoje.getTime() - 29 * umDia), ate: amanha }
  // default: 7 dias
  return { de: new Date(inicioHoje.getTime() - 6 * umDia), ate: amanha }
}

export default async function AcompanhamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; dia?: string }>
}) {
  const sp = await searchParams
  const itens = await getFeedAtividades(resolverJanela(sp.periodo, sp.dia))

  // Agrupa por dia preservando a ordem (mais recente primeiro).
  const grupos: [string, ItemFeed[]][] = []
  for (const item of itens) {
    const dia = rotuloDia(item.quando)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo[0] === dia) ultimo[1].push(item)
    else grupos.push([dia, [item]])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Acompanhamento</h1>
        <p className="text-sm text-muted-foreground">
          Tudo que aconteceu na agência — clientes, CRM e financeiro em ordem cronológica.
        </p>
      </div>

      <FiltroFeed />

      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader className="flex flex-row items-center gap-2">
          <Radar className="size-4 text-primary" />
          <CardTitle className="text-base">Linha do tempo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {grupos.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma atividade registrada ainda.
            </p>
          )}
          {grupos.map(([dia, doDia]) => (
            <div key={dia} className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {dia}
              </p>
              <div className="space-y-1">
                {doDia.map((item) => {
                  const config = CONFIG_FONTE[item.fonte]
                  return (
                    <div key={item.id} className="flex items-start gap-3 rounded-xl p-2">
                      <div
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          config.classe,
                        )}
                      >
                        <config.icon className="size-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{item.titulo}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {config.rotulo}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(item.quando, 'HH:mm')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
