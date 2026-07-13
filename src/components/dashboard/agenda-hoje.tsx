import Link from 'next/link'
import { Clock, CalendarPlus } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { listarEventosDeHoje, type EventoAgenda } from '@/lib/google/calendar'

// Formata o horário de um evento no fuso de Brasília (ex.: "14:30").
function formatarHorario(evento: EventoAgenda): string {
  if (evento.diaInteiro) return 'Dia inteiro'
  const d = new Date(evento.inicio)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Timeline da agenda do dia. Server component — busca eventos REAIS do Google.
// Nunca deixa exceção escapar (mesmo padrão de getDashboardData): se a leitura
// falhar (sem conexão / erro), cai no estado "Conecte sua agenda" sem derrubar o painel.
export async function AgendaHoje() {
  let eventos: EventoAgenda[] = []
  let conectado = true
  try {
    eventos = await listarEventosDeHoje()
  } catch {
    conectado = false
  }

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Agenda de Hoje</CardTitle>
        <Link href="/agenda" className="text-xs font-medium text-primary hover:underline">
          Ver agenda
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {!conectado ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CalendarPlus className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Conecte sua agenda do Google</p>
            <Link
              href="/integracoes"
              className="text-xs font-medium text-primary hover:underline"
            >
              Conectar agora
            </Link>
          </div>
        ) : eventos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum compromisso para hoje.
          </p>
        ) : (
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {eventos.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-r-xl border-l-4 border-l-primary bg-background py-2.5 pl-3 pr-3"
              >
                <div className="min-w-0">
                  <p className={cn('text-sm font-semibold tabular-nums text-primary')}>
                    {formatarHorario(item)}
                  </p>
                  <p className="truncate text-sm font-medium">{item.titulo}</p>
                  {item.local && (
                    <p className="truncate text-xs text-muted-foreground">{item.local}</p>
                  )}
                </div>
                <Clock className="size-4 shrink-0 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
