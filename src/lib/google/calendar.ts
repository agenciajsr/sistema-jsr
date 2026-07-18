import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'

import { getValidAccessToken } from './credentials'
import {
  googleEventSchema,
  googleEventsListSchema,
  type GoogleEvent,
} from './schemas'

// Client REST do Google Calendar (server-only). Usa getValidAccessToken (refresh
// automático). TODA resposta é validada por Zod. Datas calculadas no fuso de Brasília.

const CALENDAR_BASE =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events'

const TZ_BRASILIA = 'America/Sao_Paulo'
const OFFSET_BRASILIA = '-03:00' // Brasil não adota mais horário de verão desde 2019

// Erro sentinela: nenhuma conta Google conectada. As leituras defensivas
// (card do painel, página /agenda) tratam este caso mostrando "conecte sua agenda".
export const NAO_CONECTADO = 'NAO_CONECTADO'

export type EventoAgenda = {
  id: string
  titulo: string
  inicio: string // ISO/RFC3339 (ou YYYY-MM-DD em eventos de dia inteiro)
  fim: string | null
  diaInteiro: boolean
  local?: string
  descricao?: string
  link?: string
  meetLink?: string
}

/** Chamada autenticada ao Calendar. Lança NAO_CONECTADO quando não há token. */
async function calendarFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = await getValidAccessToken()
  if (!token) throw new Error(NAO_CONECTADO)

  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const texto = await res.text()
    throw new Error(`[Google Calendar] Erro ${res.status} em ${path}: ${texto}`)
  }

  return res.json()
}

/** Converte um evento cru do Google no formato interno EventoAgenda. */
function mapEvento(ev: GoogleEvent): EventoAgenda {
  const diaInteiro = Boolean(ev.start?.date)
  const inicio = ev.start?.dateTime ?? ev.start?.date ?? ''
  const fim = ev.end?.dateTime ?? ev.end?.date ?? null
  return {
    id: ev.id ?? '',
    titulo: ev.summary ?? '(sem título)',
    inicio,
    fim,
    diaInteiro,
    local: ev.location,
    descricao: ev.description,
    link: ev.htmlLink,
    meetLink: ev.hangoutLink,
  }
}

type ListarParams = { timeMin: string; timeMax: string; maxResults?: number }

/** Lista eventos num intervalo (RFC3339), ordenados por horário de início. */
export async function listarEventos({
  timeMin,
  timeMax,
  maxResults = 20,
}: ListarParams): Promise<EventoAgenda[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: TZ_BRASILIA,
    maxResults: String(maxResults),
  })
  const raw = await calendarFetch(`?${params.toString()}`)
  const parsed = googleEventsListSchema.parse(raw)
  return parsed.items.map(mapEvento)
}

/** Eventos de HOJE (00:00–23:59 no fuso de Brasília). */
export async function listarEventosDeHoje(): Promise<EventoAgenda[]> {
  const hoje = hojeBrasilia()
  return listarEventos({
    timeMin: `${hoje}T00:00:00${OFFSET_BRASILIA}`,
    timeMax: `${hoje}T23:59:59${OFFSET_BRASILIA}`,
    maxResults: 20,
  })
}

/**
 * Eventos de um intervalo de DIAS fechado (YYYY-MM-DD, fuso de Brasília) —
 * alimenta a grade de calendário da /agenda (mês ou semana visível).
 */
export async function listarEventosPeriodo(
  inicio: string,
  fim: string,
): Promise<EventoAgenda[]> {
  return listarEventos({
    timeMin: `${inicio}T00:00:00${OFFSET_BRASILIA}`,
    timeMax: `${fim}T23:59:59${OFFSET_BRASILIA}`,
    maxResults: 250,
  })
}

/** Próximos compromissos: de agora até o fim do dia daqui a `dias` (Brasília). */
export async function listarProximos(dias = 14): Promise<EventoAgenda[]> {
  const timeMin = new Date().toISOString()
  const ate = dataMenosDias(-dias, hojeBrasilia()) // hoje + dias
  return listarEventos({
    timeMin,
    timeMax: `${ate}T23:59:59${OFFSET_BRASILIA}`,
    maxResults: 50,
  })
}

type CriarInput = {
  titulo: string
  descricao?: string
  local?: string
  inicio: string // RFC3339 com offset de Brasília
  fim: string // RFC3339 com offset de Brasília
  /** E-mails convidados — o Google envia o convite (sendUpdates=all). */
  convidados?: string[]
  /** true = evento nasce com sala do Google Meet (conferenceDataVersion=1). */
  criarMeet?: boolean
}

/** Cria um evento no Google Calendar (opcionalmente com Meet + convidados). */
export async function criarEvento(input: CriarInput): Promise<EventoAgenda> {
  const convidados = (input.convidados ?? []).filter(Boolean)
  const body: Record<string, unknown> = {
    summary: input.titulo,
    description: input.descricao,
    location: input.local,
    start: { dateTime: input.inicio, timeZone: TZ_BRASILIA },
    end: { dateTime: input.fim, timeZone: TZ_BRASILIA },
  }
  if (convidados.length > 0) {
    body.attendees = convidados.map((email) => ({ email }))
  }
  if (input.criarMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  const params = new URLSearchParams()
  if (input.criarMeet) params.set('conferenceDataVersion', '1')
  if (convidados.length > 0) params.set('sendUpdates', 'all')
  const query = params.size > 0 ? `?${params.toString()}` : ''

  const raw = await calendarFetch(query, { method: 'POST', body: JSON.stringify(body) })
  return mapEvento(googleEventSchema.parse(raw))
}

type EditarPatch = Partial<CriarInput>

/** Edita um evento existente (PATCH parcial). */
export async function editarEvento(
  eventId: string,
  patch: EditarPatch,
): Promise<EventoAgenda> {
  const body: Record<string, unknown> = {}
  if (patch.titulo !== undefined) body.summary = patch.titulo
  if (patch.descricao !== undefined) body.description = patch.descricao
  if (patch.local !== undefined) body.location = patch.local
  if (patch.inicio !== undefined) body.start = { dateTime: patch.inicio, timeZone: TZ_BRASILIA }
  if (patch.fim !== undefined) body.end = { dateTime: patch.fim, timeZone: TZ_BRASILIA }

  const raw = await calendarFetch(`/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return mapEvento(googleEventSchema.parse(raw))
}
