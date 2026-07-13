import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'

import { getEventosProximos } from '@/actions/agenda'
import { EventoForm } from '@/components/agenda/evento-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { EventoAgenda } from '@/lib/google/calendar'

// Cinto de segurança: teto de execução da função serverless (rede de proteção
// contra 504 em cold start). Agenda soma latência do Google Calendar por cima.
export const maxDuration = 60

const TZ = 'America/Sao_Paulo'

// Rótulo do dia (ex.: "sábado, 12 de julho") a partir do início do evento.
function rotuloDia(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Data indefinida'
  return d.toLocaleDateString('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

// Chave de dia (YYYY-MM-DD em Brasília) para agrupar.
function chaveDia(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'sem-data'
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

function horario(evento: EventoAgenda): string {
  if (evento.diaInteiro) return 'Dia inteiro'
  const d = new Date(evento.inicio)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Converte ISO -> 'YYYY-MM-DDTHH:mm' (Brasília) para pré-preencher o input datetime-local.
function paraDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // sv-SE gera "YYYY-MM-DD HH:mm:ss"; trocamos o espaço por T e cortamos os segundos.
  const s = d.toLocaleString('sv-SE', { timeZone: TZ })
  return s.replace(' ', 'T').slice(0, 16)
}

export default async function AgendaPage() {
  const { conectado, eventos } = await getEventosProximos()

  // Agrupar por dia preservando a ordem (a lista já vem ordenada por início).
  const grupos: { chave: string; rotulo: string; itens: EventoAgenda[] }[] = []
  for (const ev of eventos) {
    const chave = chaveDia(ev.inicio)
    let grupo = grupos.find((g) => g.chave === chave)
    if (!grupo) {
      grupo = { chave, rotulo: rotuloDia(ev.inicio), itens: [] }
      grupos.push(grupo)
    }
    grupo.itens.push(ev)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">Próximos compromissos da sua agenda do Google.</p>
        </div>
        {conectado && <EventoForm />}
      </div>

      {!conectado ? (
        <Card className="border-none shadow-[var(--shadow-sm)]">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Conecte sua agenda do Google</p>
              <p className="text-sm text-muted-foreground">
                Ligue sua conta Google para ver e criar compromissos por aqui.
              </p>
            </div>
            <Button asChild>
              <Link href="/integracoes">Conectar Google Agenda</Link>
            </Button>
          </CardContent>
        </Card>
      ) : grupos.length === 0 ? (
        <Card className="border-none shadow-[var(--shadow-sm)]">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum compromisso nos próximos 14 dias.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <div key={grupo.chave} className="space-y-3">
              <h2 className="text-sm font-semibold capitalize text-muted-foreground">{grupo.rotulo}</h2>
              <div className="space-y-2">
                {grupo.itens.map((ev) => (
                  <Card key={ev.id} className="border-none shadow-[var(--shadow-sm)]">
                    <CardContent className="flex items-start justify-between gap-3 py-3">
                      <div className="flex min-w-0 gap-3">
                        <p className="w-20 shrink-0 text-sm font-semibold tabular-nums text-primary">
                          {horario(ev)}
                        </p>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{ev.titulo}</p>
                          {ev.local && (
                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              {ev.local}
                            </p>
                          )}
                          {ev.descricao && (
                            <p className="truncate text-xs text-muted-foreground">{ev.descricao}</p>
                          )}
                        </div>
                      </div>
                      {ev.id && !ev.diaInteiro && (
                        <EventoForm
                          eventId={ev.id}
                          defaultValues={{
                            titulo: ev.titulo,
                            descricao: ev.descricao ?? '',
                            local: ev.local ?? '',
                            inicio: paraDatetimeLocal(ev.inicio),
                            fim: paraDatetimeLocal(ev.fim),
                          }}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
