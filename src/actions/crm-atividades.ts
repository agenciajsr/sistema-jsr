'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/lib/db'
import { crmOportunidades, crmTarefas } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { getWorkspaceAtual } from '@/lib/crm/workspace'
import { registrarAtividadeCrm } from '@/lib/crm/atividades'
import { carimbarPrimeiroContato } from '@/lib/crm/primeiro-contato'
import { criarEvento } from '@/lib/google/calendar'
import { atividadeSchema, type AtividadeInput } from '@/lib/validations/crm'

// Atividades AGENDADAS do CRM (modal "Criar atividade" da ficha do lead).
// Persistem em crm_tarefas (tabela que já existia) com as colunas novas da
// migration 0022: data_inicio, data_fim e prioridade. dataVencimento recebe
// dataFim de propósito — a heurística "sem contato +7d" de getCrmVisaoGeral
// lê dataVencimento/concluida e não pode quebrar.
//
// Padrão do repo: { data } | { error }, getCurrentUser() + getWorkspaceAtual()
// no topo, queries SEQUENCIAIS (pool max=3), revalidatePath('/crm') ao mutar.

/** Traduz o erro do Zod na primeira mensagem legível (copiado, não importado —
 * exportar helper de arquivo 'use server' criaria endpoint público). */
function primeiroErro(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? 'Dados invalidos.'
}

// --- Carimbo do 1º contato (quick-260717-qq6) ---
// carimbarPrimeiroContato mora em @/lib/crm/primeiro-contato (compartilhado
// com moverOportunidade em crm.ts — mover de etapa também conta como contato).

/** Tipos de atividade que representam CONTATO REAL com o lead. */
const TIPOS_CONTATO = new Set(['ligacao', 'whatsapp', 'email', 'reuniao'])

/** Cria uma atividade agendada para o lead (e opcionalmente para um negócio). */
export async function criarAtividadeCrm(input: AtividadeInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = atividadeSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    const dataInicio = new Date(v.dataInicio)
    const dataFim = new Date(v.dataFim)

    const [tarefa] = await db
      .insert(crmTarefas)
      .values({
        workspaceId: workspace.id,
        contatoId: v.contatoId,
        oportunidadeId: v.oportunidadeId ?? null,
        titulo: v.titulo,
        tipo: v.tipo,
        notas: v.descricao ?? null,
        prioridade: v.prioridade ?? null,
        dataInicio,
        dataFim,
        // dataVencimento = dataFim: mantém a heurística "sem contato +7d" viva.
        dataVencimento: dataFim,
        donoId: v.donoId ?? currentUser.id,
      })
      .returning({ id: crmTarefas.id })

    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'tarefa_criada',
      contatoId: v.contatoId,
      oportunidadeId: v.oportunidadeId ?? null,
      detalhe: v.titulo,
    })

    // Carimbo do 1º contato: só quando a atividade é de CONTATO REAL
    // (ligação/whatsapp/e-mail/reunião) e JÁ ACONTECEU (início <= agora) —
    // agendar uma tarefa FUTURA não conta como contato feito.
    if (TIPOS_CONTATO.has(v.tipo) && dataInicio.getTime() <= Date.now()) {
      await carimbarPrimeiroContato(v.oportunidadeId)
    }

    revalidatePath('/crm')
    return { data: { id: tarefa.id } }
  } catch (e) {
    console.error('[criarAtividadeCrm]', e)
    return { error: 'Nao foi possivel criar a atividade.' }
  }
}

// Agendamento de reunião pelo Kanban (quick 260716-kq1): ao mover um card
// para "Reunião agendada", o modal coleta data/horas e esta action cria a
// atividade tipo 'reuniao' em crm_tarefas E o evento no Google Calendar numa
// ação só. A falha do Calendar NUNCA desfaz a atividade — degradação graciosa
// com aviso (avisoCalendar) quando não há conta conectada ou a API falha.

const reuniaoSchema = z
  .object({
    oportunidadeId: z.string().uuid('Negocio invalido.'),
    titulo: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined),
    data: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data da reuniao.'),
    horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Informe a hora de inicio.'),
    horaFim: z.string().regex(/^\d{2}:\d{2}$/, 'Informe a hora de fim.'),
    observacao: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined),
  })
  .refine((v) => v.horaFim > v.horaInicio, {
    message: 'O horario de fim deve ser depois do inicio.',
    path: ['horaFim'],
  })

export type ReuniaoInput = z.input<typeof reuniaoSchema>

/**
 * Cria a atividade de reunião no card do lead + o evento no Google Calendar.
 * NÃO move a oportunidade — quem move é o kanban (moverOportunidade), mesmo
 * desenho do fluxo de perda.
 */
export async function criarReuniaoCrm(input: ReuniaoInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = reuniaoSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    // A oportunidade traz contatoId e o título do negócio (defaults do form).
    // Queries SEQUENCIAIS (pool max=3), nunca Promise.all.
    const [oportunidade] = await db
      .select({
        id: crmOportunidades.id,
        titulo: crmOportunidades.titulo,
        contatoId: crmOportunidades.contatoId,
      })
      .from(crmOportunidades)
      .where(
        and(
          eq(crmOportunidades.id, v.oportunidadeId),
          eq(crmOportunidades.workspaceId, workspace.id),
        ),
      )
      .limit(1)

    if (!oportunidade) return { error: 'Negócio não encontrado.' }

    const titulo = v.titulo ?? `Reunião — ${oportunidade.titulo}`
    const dataInicio = new Date(`${v.data}T${v.horaInicio}`)
    const dataFim = new Date(`${v.data}T${v.horaFim}`)

    const [tarefa] = await db
      .insert(crmTarefas)
      .values({
        workspaceId: workspace.id,
        contatoId: oportunidade.contatoId,
        oportunidadeId: oportunidade.id,
        titulo,
        tipo: 'reuniao',
        notas: v.observacao ?? null,
        dataInicio,
        dataFim,
        // dataVencimento = dataFim: mantém a heurística "sem contato +7d" viva.
        dataVencimento: dataFim,
        donoId: currentUser.id,
      })
      .returning({ id: crmTarefas.id })

    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'tarefa_criada',
      contatoId: oportunidade.contatoId,
      oportunidadeId: oportunidade.id,
      detalhe: titulo,
    })

    // Evento no Google Calendar — try/catch PRÓPRIO: NAO_CONECTADO ou erro da
    // API nunca falham a action (a atividade já está criada e fica).
    let eventoCriado = false
    let avisoCalendar: string | undefined
    try {
      await criarEvento({
        titulo,
        descricao: v.observacao,
        inicio: `${v.data}T${v.horaInicio}:00-03:00`,
        fim: `${v.data}T${v.horaFim}:00-03:00`,
      })
      eventoCriado = true
    } catch (e) {
      console.error('[criarReuniaoCrm] Google Calendar', e)
      avisoCalendar =
        'Reunião criada, mas o evento não foi criado no Google Calendar (conta não conectada ou erro na API).'
    }

    revalidatePath('/crm')
    return { data: { id: tarefa.id, eventoCriado, avisoCalendar } }
  } catch (e) {
    console.error('[criarReuniaoCrm]', e)
    return { error: 'Não foi possível criar a reunião.' }
  }
}

/** Marca a atividade como concluída (checkbox da aba Atividades). */
export async function concluirAtividadeCrm(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const [tarefa] = await db
      .update(crmTarefas)
      .set({ concluida: true, concluidaEm: new Date(), updatedAt: new Date() })
      .where(and(eq(crmTarefas.id, id), eq(crmTarefas.workspaceId, workspace.id)))
      .returning({
        id: crmTarefas.id,
        titulo: crmTarefas.titulo,
        contatoId: crmTarefas.contatoId,
        oportunidadeId: crmTarefas.oportunidadeId,
      })

    if (!tarefa) return { error: 'Atividade nao encontrada.' }

    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'tarefa_concluida',
      contatoId: tarefa.contatoId,
      oportunidadeId: tarefa.oportunidadeId,
      detalhe: tarefa.titulo,
    })

    // Concluir a 1ª atividade comercial do lead carimba o 1º contato
    // (idempotente: o UPDATE só pega quando primeiro_contato_em é null).
    await carimbarPrimeiroContato(tarefa.oportunidadeId)

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[concluirAtividadeCrm]', e)
    return { error: 'Nao foi possivel concluir a atividade.' }
  }
}
