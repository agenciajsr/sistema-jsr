'use server'

import { and, asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { crmEmpresas, crmContatos, crmTarefas } from '@/lib/db/schema'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { getWorkspaceAtual } from '@/lib/crm/workspace'
import { registrarAtividadeCrm } from '@/lib/crm/atividades'
import { normalizarTelefone } from '@/lib/crm/lead'
import {
  empresaSchema,
  contatoSchema,
  crmTarefaSchema,
  type EmpresaInput,
  type ContatoInput,
  type CrmTarefaInput,
} from '@/lib/validations/crm'

// Cadastros básicos do CRM: empresas, contatos e tarefas comerciais.
// Padrão do repo: toda action devolve { data } | { error } e começa pelo
// getCurrentUser(). Mutação termina em revalidatePath('/crm').
//
// ⚠️ QUERIES SEQUENCIAIS (nada de paralelizar com Promise): pool max=3 com
// max_pipeline=0 — ver o comentário longo em src/lib/db/index.ts.

/** Traduz o erro do Zod na primeira mensagem legível. */
function primeiroErro(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? 'Dados invalidos.'
}

// --- Empresas ---

export async function criarEmpresa(input: EmpresaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = empresaSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    const [empresa] = await db
      .insert(crmEmpresas)
      .values({
        workspaceId: workspace.id,
        nome: v.nome,
        cnpj: v.cnpj ?? null,
        segmento: v.segmento ?? null,
        site: v.site ?? null,
        instagram: v.instagram ?? null,
        telefone: v.telefone ?? null,
        cidade: v.cidade ?? null,
        estado: v.estado ?? null,
        notas: v.notas ?? null,
        donoId: v.donoId ?? currentUser.id,
      })
      .returning({ id: crmEmpresas.id })

    revalidatePath('/crm')
    return { data: { id: empresa.id } }
  } catch (e) {
    console.error('[criarEmpresa]', e)
    return { error: 'Nao foi possivel criar a empresa.' }
  }
}

export async function atualizarEmpresa(id: string, input: EmpresaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = empresaSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    await db
      .update(crmEmpresas)
      .set({
        nome: v.nome,
        cnpj: v.cnpj ?? null,
        segmento: v.segmento ?? null,
        site: v.site ?? null,
        instagram: v.instagram ?? null,
        telefone: v.telefone ?? null,
        cidade: v.cidade ?? null,
        estado: v.estado ?? null,
        notas: v.notas ?? null,
        ...(v.donoId !== undefined ? { donoId: v.donoId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(crmEmpresas.id, id), eq(crmEmpresas.workspaceId, workspace.id)))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[atualizarEmpresa]', e)
    return { error: 'Nao foi possivel salvar a empresa.' }
  }
}

export async function deletarEmpresa(id: string) {
  const admin = await requireAdmin()
  if ('error' in admin) return { error: 'Apenas administradores podem excluir empresas.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    await db
      .delete(crmEmpresas)
      .where(and(eq(crmEmpresas.id, id), eq(crmEmpresas.workspaceId, workspace.id)))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[deletarEmpresa]', e)
    return { error: 'Nao foi possivel excluir a empresa.' }
  }
}

export async function getEmpresas() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const empresas = await db
      .select({
        id: crmEmpresas.id,
        nome: crmEmpresas.nome,
        segmento: crmEmpresas.segmento,
        cidade: crmEmpresas.cidade,
        estado: crmEmpresas.estado,
        clienteId: crmEmpresas.clienteId,
      })
      .from(crmEmpresas)
      .where(eq(crmEmpresas.workspaceId, workspace.id))
      .orderBy(asc(crmEmpresas.nome))

    return { data: empresas }
  } catch (e) {
    console.error('[getEmpresas]', e)
    return { error: 'Nao foi possivel carregar as empresas.' }
  }
}

// --- Contatos ---

export async function criarContato(input: ContatoInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = contatoSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    const [contato] = await db
      .insert(crmContatos)
      .values({
        workspaceId: workspace.id,
        nome: v.nome,
        email: v.email ?? null,
        telefone: v.telefone ?? null,
        telefoneNormalizado: normalizarTelefone(v.telefone),
        cargo: v.cargo ?? null,
        empresaId: v.empresaId ?? null,
        origem: v.origem,
        donoId: v.donoId ?? currentUser.id,
      })
      .returning({ id: crmContatos.id })

    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'contato_criado',
      contatoId: contato.id,
      detalhe: v.nome,
    })

    revalidatePath('/crm')
    return { data: { id: contato.id } }
  } catch (e) {
    console.error('[criarContato]', e)
    return { error: 'Nao foi possivel criar o contato.' }
  }
}

export async function atualizarContato(id: string, input: ContatoInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = contatoSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    await db
      .update(crmContatos)
      .set({
        nome: v.nome,
        email: v.email ?? null,
        telefone: v.telefone ?? null,
        telefoneNormalizado: normalizarTelefone(v.telefone),
        cargo: v.cargo ?? null,
        empresaId: v.empresaId ?? null,
        origem: v.origem,
        ...(v.donoId !== undefined ? { donoId: v.donoId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(crmContatos.id, id), eq(crmContatos.workspaceId, workspace.id)))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[atualizarContato]', e)
    return { error: 'Nao foi possivel salvar o contato.' }
  }
}

export async function deletarContato(id: string) {
  const admin = await requireAdmin()
  if ('error' in admin) return { error: 'Apenas administradores podem excluir contatos.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    await db
      .delete(crmContatos)
      .where(and(eq(crmContatos.id, id), eq(crmContatos.workspaceId, workspace.id)))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[deletarContato]', e)
    return { error: 'Nao foi possivel excluir o contato.' }
  }
}

export async function getContatos() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const contatos = await db
      .select({
        id: crmContatos.id,
        nome: crmContatos.nome,
        email: crmContatos.email,
        telefone: crmContatos.telefone,
        cargo: crmContatos.cargo,
        empresaId: crmContatos.empresaId,
        origem: crmContatos.origem,
      })
      .from(crmContatos)
      .where(eq(crmContatos.workspaceId, workspace.id))
      .orderBy(asc(crmContatos.nome))

    return { data: contatos }
  } catch (e) {
    console.error('[getContatos]', e)
    return { error: 'Nao foi possivel carregar os contatos.' }
  }
}

// --- Tarefas comerciais (crm_tarefas — NADA a ver com o módulo /tarefas) ---

export async function criarTarefaCrm(input: CrmTarefaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = crmTarefaSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    const [tarefa] = await db
      .insert(crmTarefas)
      .values({
        workspaceId: workspace.id,
        titulo: v.titulo,
        tipo: v.tipo,
        notas: v.notas ?? null,
        dataVencimento: new Date(v.dataVencimento),
        oportunidadeId: v.oportunidadeId ?? null,
        contatoId: v.contatoId ?? null,
        donoId: v.donoId ?? currentUser.id,
      })
      .returning({ id: crmTarefas.id })

    if (v.oportunidadeId) {
      await registrarAtividadeCrm(workspace.id, currentUser, {
        tipo: 'tarefa_criada',
        oportunidadeId: v.oportunidadeId,
        detalhe: v.titulo,
      })
    }

    revalidatePath('/crm')
    return { data: { id: tarefa.id } }
  } catch (e) {
    console.error('[criarTarefaCrm]', e)
    return { error: 'Nao foi possivel criar a tarefa.' }
  }
}

export async function concluirTarefaCrm(id: string, concluida: boolean) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const [tarefa] = await db
      .update(crmTarefas)
      .set({
        concluida,
        concluidaEm: concluida ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(crmTarefas.id, id), eq(crmTarefas.workspaceId, workspace.id)))
      .returning({ oportunidadeId: crmTarefas.oportunidadeId, titulo: crmTarefas.titulo })

    if (tarefa?.oportunidadeId && concluida) {
      await registrarAtividadeCrm(workspace.id, currentUser, {
        tipo: 'tarefa_concluida',
        oportunidadeId: tarefa.oportunidadeId,
        detalhe: tarefa.titulo,
      })
    }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[concluirTarefaCrm]', e)
    return { error: 'Nao foi possivel atualizar a tarefa.' }
  }
}

export async function deletarTarefaCrm(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    await db
      .delete(crmTarefas)
      .where(and(eq(crmTarefas.id, id), eq(crmTarefas.workspaceId, workspace.id)))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[deletarTarefaCrm]', e)
    return { error: 'Nao foi possivel excluir a tarefa.' }
  }
}
