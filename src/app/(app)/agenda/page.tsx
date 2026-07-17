import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

import { getEventosDoPeriodo } from '@/actions/agenda'
import { AgendaCalendario, type Visao } from '@/components/agenda/agenda-calendario'
import { EventoForm } from '@/components/agenda/evento-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// Cinto de segurança: teto de execução da função serverless (rede de proteção
// contra 504 em cold start). Agenda soma latência do Google Calendar por cima.
export const maxDuration = 60

const TZ = 'America/Sao_Paulo'

// YYYY-MM-DD sem depender de fuso do servidor: tudo calculado como string.
function ymd(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; data?: string }>
}) {
  const params = await searchParams
  const visao: Visao = params.visao === 'semana' ? 'semana' : 'mes'

  // Hoje em Brasília (o servidor pode rodar em outro fuso).
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const dataAncora = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? '') ? params.data! : hoje

  // Intervalo VISÍVEL calculado no servidor: grade completa dom→sáb.
  const ancora = new Date(`${dataAncora}T12:00:00`)
  let inicio: Date
  let fim: Date
  if (visao === 'mes') {
    const primeiroDoMes = new Date(ancora.getFullYear(), ancora.getMonth(), 1)
    inicio = new Date(primeiroDoMes)
    inicio.setDate(inicio.getDate() - primeiroDoMes.getDay())
    const ultimoDoMes = new Date(ancora.getFullYear(), ancora.getMonth() + 1, 0)
    fim = new Date(ultimoDoMes)
    fim.setDate(fim.getDate() + (6 - ultimoDoMes.getDay()))
  } else {
    inicio = new Date(ancora)
    inicio.setDate(inicio.getDate() - ancora.getDay())
    fim = new Date(inicio)
    fim.setDate(fim.getDate() + 6)
  }

  const { conectado, eventos } = await getEventosDoPeriodo(ymd(inicio), ymd(fim))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Seus compromissos do Google em formato de calendário.
          </p>
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
      ) : (
        <AgendaCalendario
          visao={visao}
          dataAncora={dataAncora}
          hoje={hoje}
          eventos={eventos}
        />
      )}
    </div>
  )
}
