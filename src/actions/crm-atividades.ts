'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { crmTarefas } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { getWorkspaceAtual } from '@/lib/crm/workspace'
import { registrarAtividadeCrm } from '@/lib/crm/atividades'
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

    revalidatePath('/crm')
    return { data: { id: tarefa.id } }
  } catch (e) {
    console.error('[criarAtividadeCrm]', e)
    return { error: 'Nao foi possivel criar a atividade.' }
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

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[concluirAtividadeCrm]', e)
    return { error: 'Nao foi possivel concluir a atividade.' }
  }
}
