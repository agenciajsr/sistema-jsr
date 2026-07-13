'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import {
  criarEvento,
  editarEvento,
  listarProximos,
  NAO_CONECTADO,
  type EventoAgenda,
} from '@/lib/google/calendar'

// Offset fixo de Brasília (sem horário de verão desde 2019).
const OFFSET_BRASILIA = '-03:00'

// Schema do formulário de evento. inicio/fim vêm do input datetime-local
// no formato 'YYYY-MM-DDTHH:mm' (hora local, interpretada como Brasília).
export const eventoSchema = z
  .object({
    titulo: z.string().min(1, 'Título é obrigatório'),
    descricao: z.string().optional(),
    local: z.string().optional(),
    inicio: z.string().min(1, 'Início é obrigatório'),
    fim: z.string().min(1, 'Fim é obrigatório'),
  })
  .refine((v) => v.fim > v.inicio, {
    message: 'O fim deve ser depois do início.',
    path: ['fim'],
  })

export type EventoInput = z.infer<typeof eventoSchema>

/** Converte 'YYYY-MM-DDTHH:mm' (datetime-local) em RFC3339 com offset de Brasília. */
function paraRfc3339(valor: string): string {
  // valor: 2026-07-12T14:30 -> 2026-07-12T14:30:00-03:00
  const comSegundos = valor.length === 16 ? `${valor}:00` : valor
  return `${comSegundos}${OFFSET_BRASILIA}`
}

type Resultado = { ok: true } | { error: string }

export async function criarEventoAction(input: EventoInput): Promise<Resultado> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessão expirada. Faça login novamente.' }

  const parsed = eventoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  try {
    await criarEvento({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || undefined,
      local: parsed.data.local || undefined,
      inicio: paraRfc3339(parsed.data.inicio),
      fim: paraRfc3339(parsed.data.fim),
    })
    revalidatePath('/agenda')
    revalidatePath('/painel')
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === NAO_CONECTADO) {
      return { error: 'Conecte sua agenda do Google antes de criar eventos.' }
    }
    console.error('[criarEventoAction] Falha ao criar evento:', e)
    return { error: 'Não foi possível criar o evento. Tente novamente.' }
  }
}

export async function editarEventoAction(
  eventId: string,
  input: EventoInput,
): Promise<Resultado> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessão expirada. Faça login novamente.' }

  const parsed = eventoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  try {
    await editarEvento(eventId, {
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || undefined,
      local: parsed.data.local || undefined,
      inicio: paraRfc3339(parsed.data.inicio),
      fim: paraRfc3339(parsed.data.fim),
    })
    revalidatePath('/agenda')
    revalidatePath('/painel')
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === NAO_CONECTADO) {
      return { error: 'Conecte sua agenda do Google antes de editar eventos.' }
    }
    console.error('[editarEventoAction] Falha ao editar evento:', e)
    return { error: 'Não foi possível editar o evento. Tente novamente.' }
  }
}

export type ProximosResult = {
  conectado: boolean
  eventos: EventoAgenda[]
}

/** Próximos compromissos. Nunca lança: conectado=false quando não há conexão. */
export async function getEventosProximos(): Promise<ProximosResult> {
  const user = await getCurrentUser()
  if (!user) return { conectado: false, eventos: [] }

  try {
    const eventos = await listarProximos(14)
    return { conectado: true, eventos }
  } catch (e) {
    if (e instanceof Error && e.message === NAO_CONECTADO) {
      return { conectado: false, eventos: [] }
    }
    console.error('[getEventosProximos] Falha ao listar eventos:', e)
    return { conectado: false, eventos: [] }
  }
}
