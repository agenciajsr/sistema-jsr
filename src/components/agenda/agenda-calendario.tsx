'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'

import { EventoForm } from '@/components/agenda/evento-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { EventoAgenda } from '@/lib/google/calendar'

// Grade de calendário da /agenda (mensal e semanal). A navegação muda a URL
// (?visao=&data=) e o SERVIDOR rebusca os eventos do intervalo visível — este
// componente só desenha e abre a edição.

const TZ = 'America/Sao_Paulo'
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// Chave YYYY-MM-DD (Brasília) do início do evento — mesma lógica da página antiga.
function chaveDia(iso: string): string {
  // Eventos de dia inteiro já vêm como YYYY-MM-DD puro.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'sem-data'
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

function horario(evento: EventoAgenda): string {
  if (evento.diaInteiro) return 'Dia inteiro'
  const d = new Date(evento.inicio)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

// ISO -> 'YYYY-MM-DDTHH:mm' (Brasília) para o input datetime-local do EventoForm.
function paraDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const s = d.toLocaleString('sv-SE', { timeZone: TZ })
  return s.replace(' ', 'T').slice(0, 16)
}

export type Visao = 'mes' | 'semana'

export function AgendaCalendario({
  visao,
  dataAncora, // YYYY-MM-DD
  hoje, // YYYY-MM-DD em Brasília (calculado no servidor)
  eventos,
}: {
  visao: Visao
  dataAncora: string
  hoje: string
  eventos: EventoAgenda[]
}) {
  const router = useRouter()
  // Evento aberto no dialog de detalhes/edição (só eventos com id e horário).
  const [eventoAberto, setEventoAberto] = useState<EventoAgenda | null>(null)

  const ancora = parseISO(dataAncora)

  // Agrupa eventos por dia (chave YYYY-MM-DD).
  const porDia = new Map<string, EventoAgenda[]>()
  for (const ev of eventos) {
    const chave = chaveDia(ev.inicio)
    const lista = porDia.get(chave) ?? []
    lista.push(ev)
    porDia.set(chave, lista)
  }

  function navegar(novaVisao: Visao, novaData: Date) {
    router.push(`/agenda?visao=${novaVisao}&data=${format(novaData, 'yyyy-MM-dd')}`)
  }

  function anterior() {
    navegar(visao, visao === 'mes' ? addMonths(ancora, -1) : addDays(ancora, -7))
  }
  function proximo() {
    navegar(visao, visao === 'mes' ? addMonths(ancora, 1) : addDays(ancora, 7))
  }
  function irParaHoje() {
    navegar(visao, parseISO(hoje))
  }

  // Dias visíveis: grade completa dom→sáb.
  const dias: Date[] = []
  if (visao === 'mes') {
    const primeiroDoMes = new Date(ancora.getFullYear(), ancora.getMonth(), 1)
    const inicioGrade = addDays(primeiroDoMes, -primeiroDoMes.getDay())
    const ultimoDoMes = new Date(ancora.getFullYear(), ancora.getMonth() + 1, 0)
    const fimGrade = addDays(ultimoDoMes, 6 - ultimoDoMes.getDay())
    for (let d = inicioGrade; d <= fimGrade; d = addDays(d, 1)) dias.push(d)
  } else {
    const domingo = addDays(ancora, -ancora.getDay())
    for (let i = 0; i < 7; i++) dias.push(addDays(domingo, i))
  }

  const titulo =
    visao === 'mes'
      ? format(ancora, "MMMM 'de' yyyy", { locale: ptBR })
      : `${format(dias[0], 'd')} – ${format(dias[6], "d 'de' MMMM", { locale: ptBR })}`

  function abrirEvento(ev: EventoAgenda) {
    setEventoAberto(ev)
  }

  return (
    <div className="space-y-3">
      {/* Barra de controles: navegação + título + alternador Mês/Semana. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" onClick={anterior} aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={proximo} aria-label="Próximo">
            <ChevronRight className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={irParaHoje}>
            Hoje
          </Button>
        </div>

        <p className="text-sm font-semibold capitalize">{titulo}</p>

        <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
          <Button
            type="button"
            variant={visao === 'mes' ? 'default' : 'ghost'}
            size="sm"
            className="h-7"
            onClick={() => navegar('mes', ancora)}
          >
            Mês
          </Button>
          <Button
            type="button"
            variant={visao === 'semana' ? 'default' : 'ghost'}
            size="sm"
            className="h-7"
            onClick={() => navegar('semana', ancora)}
          >
            Semana
          </Button>
        </div>
      </div>

      {/* Cabeçalho dom–sáb. */}
      <div className="grid grid-cols-7 gap-px">
        {DIAS_SEMANA.map((dia, i) => (
          <p
            key={dia}
            className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {visao === 'semana' ? `${dia} ${format(dias[i], 'd')}` : dia}
          </p>
        ))}
      </div>

      {/* Grade de dias. */}
      <div
        className={cn(
          'grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border',
        )}
      >
        {dias.map((dia) => {
          const chave = format(dia, 'yyyy-MM-dd')
          const doDia = porDia.get(chave) ?? []
          const ehHoje = chave === hoje
          const foraDoMes = visao === 'mes' && dia.getMonth() !== ancora.getMonth()
          const limite = visao === 'mes' ? 3 : doDia.length
          const visiveis = doDia.slice(0, limite)
          const extras = doDia.length - visiveis.length

          return (
            <div
              key={chave}
              className={cn(
                'flex flex-col gap-1 bg-card p-1.5',
                visao === 'mes' ? 'min-h-24' : 'min-h-48',
                foraDoMes && 'bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'self-start rounded-full px-1.5 text-xs font-medium tabular-nums',
                  ehHoje
                    ? 'bg-primary text-primary-foreground'
                    : foraDoMes
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground',
                )}
              >
                {format(dia, 'd')}
              </span>

              {visiveis.map((ev) => (
                <button
                  key={`${ev.id}-${ev.inicio}`}
                  type="button"
                  onClick={() => abrirEvento(ev)}
                  className="w-full rounded bg-primary/10 px-1 py-0.5 text-left text-xs text-primary transition-colors hover:bg-primary/20"
                  title={ev.titulo}
                >
                  <span className="block truncate">
                    {!ev.diaInteiro && (
                      <span className="mr-1 font-semibold tabular-nums">{horario(ev)}</span>
                    )}
                    {ev.titulo}
                  </span>
                  {visao === 'semana' && ev.local && (
                    <span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                      <MapPin className="size-2.5 shrink-0" />
                      {ev.local}
                    </span>
                  )}
                </button>
              ))}

              {extras > 0 && (
                <span className="px-1 text-[10px] text-muted-foreground">+{extras} mais</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Detalhes + edição do evento clicado. */}
      <Dialog open={!!eventoAberto} onOpenChange={(aberta) => !aberta && setEventoAberto(null)}>
        <DialogContent className="sm:max-w-lg">
          {eventoAberto && (
            <>
              <DialogHeader>
                <DialogTitle>{eventoAberto.titulo}</DialogTitle>
                <DialogDescription className="capitalize">
                  {new Date(eventoAberto.inicio).toLocaleDateString('pt-BR', {
                    timeZone: TZ,
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                  {' · '}
                  {horario(eventoAberto)}
                </DialogDescription>
              </DialogHeader>

              {eventoAberto.local && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" />
                  {eventoAberto.local}
                </p>
              )}
              {eventoAberto.descricao && (
                <p className="text-sm text-muted-foreground">{eventoAberto.descricao}</p>
              )}

              {eventoAberto.id && !eventoAberto.diaInteiro ? (
                <EventoForm
                  eventId={eventoAberto.id}
                  defaultValues={{
                    titulo: eventoAberto.titulo,
                    descricao: eventoAberto.descricao ?? '',
                    local: eventoAberto.local ?? '',
                    inicio: paraDatetimeLocal(eventoAberto.inicio),
                    fim: paraDatetimeLocal(eventoAberto.fim),
                  }}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Eventos de dia inteiro são editados direto no Google Agenda.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
