'use server'

import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import {
  crmAtividades,
  crmContatos,
  crmContatoTags,
  crmEmpresas,
  crmEtapas,
  crmOportunidades,
  crmTags,
  crmTarefas,
  profiles,
} from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { getWorkspaceAtual } from '@/lib/crm/workspace'
import { registrarAtividadeCrm } from '@/lib/crm/atividades'
import { normalizarTelefone } from '@/lib/crm/lead'
import { uploadFile } from '@/lib/storage/client'
import { SERVICOS_JSR } from '@/lib/crm/servicos'
import {
  leadSchema,
  leadPerfilSchema,
  type LeadInput,
  type LeadPerfilInput,
} from '@/lib/validations/crm'

// Fluxo LEAD-FIRST do CRM (D-01/D-02): a porta de entrada é o LEAD, não o
// negócio. O lead CHEGA (form Meta, WhatsApp, indicação, prospecção) com
// nome/telefone/email/origem — e a MESMA pessoa pode perder o negócio de
// Tráfego e ganhar o de Landing Page. Por isso: 1 contato → N oportunidades.
//
// Padrão do repo: toda action devolve { data } | { error }, começa por
// getCurrentUser() + getWorkspaceAtual() e termina em revalidatePath('/crm').
//
// ⚠️ QUERIES SEQUENCIAIS (nada de paralelizar com Promise): pool max=3 com
// max_pipeline=0 — ver o comentário longo em src/lib/db/index.ts.

/** Traduz o erro do Zod na primeira mensagem legível. */
// Helper interno NÃO exportado: exportar de um arquivo 'use server' criaria um
// endpoint público (por isso é copiado de crm.ts em vez de importado).
function primeiroErro(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? 'Dados invalidos.'
}

/**
 * Acha o contato do workspace por email (case-insensitive) OU telefone
 * normalizado — MESMA estratégia/índices do processarLead (src/lib/crm/ingest.ts).
 * Queries sequenciais: só consulta por telefone se o email não resolveu.
 */
async function acharContatoExistente(
  workspaceId: string,
  email: string | undefined,
  telefoneNormalizado: string | null
): Promise<string | null> {
  if (email) {
    const [porEmail] = await db
      .select({ id: crmContatos.id })
      .from(crmContatos)
      .where(
        and(
          eq(crmContatos.workspaceId, workspaceId),
          sql`lower(${crmContatos.email}) = lower(${email})`
        )
      )
      .limit(1)
    if (porEmail) return porEmail.id
  }

  if (telefoneNormalizado) {
    const [porTelefone] = await db
      .select({ id: crmContatos.id })
      .from(crmContatos)
      .where(
        and(
          eq(crmContatos.workspaceId, workspaceId),
          eq(crmContatos.telefoneNormalizado, telefoneNormalizado)
        )
      )
      .limit(1)
    if (porTelefone) return porTelefone.id
  }

  return null
}

/**
 * Cadastra um lead e SEMPRE abre um negócio novo para ele (D-01/D-02).
 * Lead repetido (mesmo email OU telefone) reaproveita o contato — o cadastro
 * NÃO duplica — e o retorno avisa `leadExistente: true` para a UI dizer isso
 * ao usuário. O `titulo` da oportunidade é derivado (serviço — nome), nunca
 * digitado: o form de título livre foi rejeitado pelo usuário.
 */
export async function criarLead(input: LeadInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    // (1) A etapa manda: resolve o pipeline a partir dela (evita par
    // etapa/pipeline inconsistente). Mesmo padrão do criarOportunidade.
    const [etapa] = await db
      .select({ id: crmEtapas.id, pipelineId: crmEtapas.pipelineId })
      .from(crmEtapas)
      .where(eq(crmEtapas.id, v.etapaId))

    if (!etapa) return { error: 'Etapa nao encontrada.' }

    // (2) Empresa por nome: acha no workspace ou cria mínima (só quando veio).
    let empresaId: string | null = null
    if (v.empresaNome) {
      const [empresaExistente] = await db
        .select({ id: crmEmpresas.id })
        .from(crmEmpresas)
        .where(and(eq(crmEmpresas.workspaceId, workspace.id), eq(crmEmpresas.nome, v.empresaNome)))
        .limit(1)

      if (empresaExistente) {
        empresaId = empresaExistente.id
      } else {
        const [empresaNova] = await db
          .insert(crmEmpresas)
          .values({ workspaceId: workspace.id, nome: v.empresaNome, donoId: currentUser.id })
          .returning({ id: crmEmpresas.id })
        empresaId = empresaNova.id
      }
    }

    // (3) DEDUP DO CONTATO — o coração da correção de rota (D-02).
    const telefoneNormalizado = normalizarTelefone(v.telefone)
    let contatoId = await acharContatoExistente(workspace.id, v.email, telefoneNormalizado)
    const leadExistente = contatoId !== null

    if (contatoId) {
      // Lead JÁ EXISTE: merge CONSERVADOR — preenche só o que está null hoje e
      // NUNCA sobrescreve dado já preenchido (o cadastro antigo costuma ser o
      // mais curado). O nome nunca é tocado.
      const [atual] = await db
        .select({
          email: crmContatos.email,
          telefone: crmContatos.telefone,
          telefoneNormalizado: crmContatos.telefoneNormalizado,
          documento: crmContatos.documento,
          empresaId: crmContatos.empresaId,
          site: crmContatos.site,
          dataNascimento: crmContatos.dataNascimento,
          pais: crmContatos.pais,
          cep: crmContatos.cep,
          endereco: crmContatos.endereco,
          numero: crmContatos.numero,
          complemento: crmContatos.complemento,
          bairro: crmContatos.bairro,
          cidade: crmContatos.cidade,
          estado: crmContatos.estado,
          notas: crmContatos.notas,
        })
        .from(crmContatos)
        .where(eq(crmContatos.id, contatoId))

      const set: Record<string, unknown> = {}
      if (atual) {
        if (!atual.email && v.email) set.email = v.email
        if (!atual.telefone && v.telefone) set.telefone = v.telefone
        if (!atual.telefoneNormalizado && telefoneNormalizado) {
          set.telefoneNormalizado = telefoneNormalizado
        }
        if (!atual.documento && v.documento) set.documento = v.documento
        if (!atual.empresaId && empresaId) set.empresaId = empresaId
        // Campos do modal novo: mesmo merge conservador — só preenche o que
        // está null hoje, nunca sobrescreve o cadastro curado.
        if (!atual.site && v.site) set.site = v.site
        if (!atual.dataNascimento && v.dataNascimento) set.dataNascimento = v.dataNascimento
        if (!atual.pais && v.pais) set.pais = v.pais
        if (!atual.cep && v.cep) set.cep = v.cep
        if (!atual.endereco && v.endereco) set.endereco = v.endereco
        if (!atual.numero && v.numero) set.numero = v.numero
        if (!atual.complemento && v.complemento) set.complemento = v.complemento
        if (!atual.bairro && v.bairro) set.bairro = v.bairro
        if (!atual.cidade && v.cidade) set.cidade = v.cidade
        if (!atual.estado && v.estado) set.estado = v.estado
        if (!atual.notas && v.notas) set.notas = v.notas
      }

      // Nada novo a acrescentar: pula o UPDATE (uma query a menos).
      if (Object.keys(set).length > 0) {
        set.updatedAt = new Date()
        await db.update(crmContatos).set(set).where(eq(crmContatos.id, contatoId))
      }
    } else {
      // (4) Lead NOVO: nasce o cadastro.
      const [contatoNovo] = await db
        .insert(crmContatos)
        .values({
          workspaceId: workspace.id,
          nome: v.nome,
          email: v.email ?? null,
          telefone: v.telefone ?? null,
          telefoneNormalizado,
          documento: v.documento ?? null,
          site: v.site ?? null,
          dataNascimento: v.dataNascimento ?? null,
          pais: v.pais ?? null,
          cep: v.cep ?? null,
          endereco: v.endereco ?? null,
          numero: v.numero ?? null,
          complemento: v.complemento ?? null,
          bairro: v.bairro ?? null,
          cidade: v.cidade ?? null,
          estado: v.estado ?? null,
          notas: v.notas ?? null,
          empresaId,
          origem: v.origem,
          donoId: currentUser.id,
        })
        .returning({ id: crmContatos.id })
      contatoId = contatoNovo.id

      await registrarAtividadeCrm(workspace.id, currentUser, {
        tipo: 'contato_criado',
        contatoId,
        detalhe: v.nome,
      })
    }

    // (4.5) Tags do modal: vínculos lead↔tag numa query só. onConflictDoNothing
    // cobre o lead existente que já tinha alguma das tags (índice único).
    // O returning devolve SÓ as linhas realmente inseridas — é o que permite
    // registrar 'tag_adicionada' no histórico sem duplicar evento de tag antiga.
    if (v.tagIds.length > 0) {
      const inseridas = await db
        .insert(crmContatoTags)
        .values(v.tagIds.map((tagId) => ({ contatoId: contatoId as string, tagId })))
        .onConflictDoNothing()
        .returning({ tagId: crmContatoTags.tagId })

      if (inseridas.length > 0) {
        const nomes = await db
          .select({ id: crmTags.id, nome: crmTags.nome })
          .from(crmTags)
          .where(
            inArray(
              crmTags.id,
              inseridas.map((i) => i.tagId)
            )
          )
        // Sequencial de propósito (pool max=3) — e o log nunca derruba a mutação.
        for (const tag of nomes) {
          await registrarAtividadeCrm(workspace.id, currentUser, {
            tipo: 'tag_adicionada',
            contatoId,
            detalhe: tag.nome,
          })
        }
      }
    }

    // (5) O NEGÓCIO nasce SEMPRE — inclusive para lead existente (é o que faz
    // "1 lead → N negócios" funcionar).
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmOportunidades)
      .where(and(eq(crmOportunidades.etapaId, etapa.id), eq(crmOportunidades.status, 'aberta')))

    // titulo é NOT NULL e não tem campo no form: derivado de serviço + nome.
    const titulo = `${SERVICOS_JSR[v.servico]} — ${v.nome}`

    const [oportunidade] = await db
      .insert(crmOportunidades)
      .values({
        workspaceId: workspace.id,
        pipelineId: etapa.pipelineId,
        etapaId: etapa.id,
        empresaId,
        contatoId,
        titulo,
        servico: v.servico,
        valor: v.valor !== undefined ? String(v.valor) : null, // dinheiro NUNCA float
        tipoReceita: v.tipoReceita,
        origem: v.origem,
        status: 'aberta',
        donoId: v.donoId ?? currentUser.id,
        ordemNaEtapa: total,
        // servicosInteresse (legado) fica de fora de propósito: quem manda no
        // fluxo novo é `servico`.
      })
      .returning({ id: crmOportunidades.id })

    // contatoId SEMPRE presente: a aba Histórico da ficha depende dele.
    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'criacao',
      oportunidadeId: oportunidade.id,
      contatoId,
      empresaId,
      detalhe: titulo,
    })

    revalidatePath('/crm')
    return { data: { leadExistente, contatoId, oportunidadeId: oportunidade.id } }
  } catch (e) {
    console.error('[criarLead]', e)
    return { error: 'Nao foi possivel cadastrar o lead.' }
  }
}

/**
 * Consulta LEVE para a UI avisar (antes de salvar) que o lead já existe.
 * Mesma ordem de dedup do criarLead. Sem email e sem telefone → contato null.
 */
export async function verificarLeadExistente(email?: string, telefone?: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const emailLimpo = email?.trim() || undefined
  const telefoneNormalizado = normalizarTelefone(telefone)
  if (!emailLimpo && !telefoneNormalizado) return { data: { contato: null } }

  try {
    const contatoId = await acharContatoExistente(workspace.id, emailLimpo, telefoneNormalizado)
    if (!contatoId) return { data: { contato: null } }

    const [contato] = await db
      .select({ id: crmContatos.id, nome: crmContatos.nome })
      .from(crmContatos)
      .where(eq(crmContatos.id, contatoId))

    if (!contato) return { data: { contato: null } }

    // count no banco — nunca contando linhas em memória.
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmOportunidades)
      .where(eq(crmOportunidades.contatoId, contatoId))

    return { data: { contato: { id: contato.id, nome: contato.nome, qtdNegocios: total } } }
  } catch (e) {
    console.error('[verificarLeadExistente]', e)
    return { error: 'Nao foi possivel verificar o lead.' }
  }
}

// Métricas do lead (imagem04): TODAS derivadas dos negócios GANHOS, calculadas
// em TS a partir do que a query de negócios já traz — zeradas sem ganho.
export type MetricasLead = {
  ticketMedio: number
  total: number
  cicloCompraDias: number
  ultimaCompraDias: number
}

const DIA_MS = 24 * 60 * 60 * 1000

/** Ficha do lead: perfil + negócios + histórico + tags + atividades + etapas
 *  do pipeline + métricas. Queries SEQUENCIAIS (pool max=3). */
export async function getFichaLead(contatoId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    // (1) perfil (com foto, dono e nome do atendente via leftJoin)
    const [perfil] = await db
      .select({
        id: crmContatos.id,
        nome: crmContatos.nome,
        email: crmContatos.email,
        telefone: crmContatos.telefone,
        documento: crmContatos.documento,
        site: crmContatos.site,
        cargo: crmContatos.cargo,
        dataNascimento: crmContatos.dataNascimento,
        cep: crmContatos.cep,
        endereco: crmContatos.endereco,
        pais: crmContatos.pais,
        numero: crmContatos.numero,
        complemento: crmContatos.complemento,
        bairro: crmContatos.bairro,
        cidade: crmContatos.cidade,
        estado: crmContatos.estado,
        notas: crmContatos.notas,
        origem: crmContatos.origem,
        fotoUrl: crmContatos.fotoUrl,
        donoId: crmContatos.donoId,
        donoNome: profiles.nome,
        empresaId: crmContatos.empresaId,
        empresaNome: crmEmpresas.nome,
        createdAt: crmContatos.createdAt,
      })
      .from(crmContatos)
      .leftJoin(crmEmpresas, eq(crmContatos.empresaId, crmEmpresas.id))
      .leftJoin(profiles, eq(crmContatos.donoId, profiles.id))
      .where(and(eq(crmContatos.id, contatoId), eq(crmContatos.workspaceId, workspace.id)))

    if (!perfil) return { error: 'Lead nao encontrado.' }

    // (2) TODOS os negócios do lead (D-02) — abertos e fechados. `numero` é o
    // #N global do workspace por ordem de criação (subquery correlacionada:
    // quantas oportunidades nasceram antes desta — mesmo critério do board).
    const negociosRaw = await db
      .select({
        id: crmOportunidades.id,
        titulo: crmOportunidades.titulo,
        servico: crmOportunidades.servico,
        valor: crmOportunidades.valor,
        status: crmOportunidades.status,
        motivoPerda: crmOportunidades.motivoPerda,
        etapaId: crmOportunidades.etapaId,
        pipelineId: crmOportunidades.pipelineId,
        etapaNome: crmEtapas.nome,
        createdAt: crmOportunidades.createdAt,
        ganhaEm: crmOportunidades.ganhaEm,
        perdidaEm: crmOportunidades.perdidaEm,
        numero: sql<number>`(
          select count(*)::int from crm_oportunidades o2
          where o2.workspace_id = ${crmOportunidades.workspaceId}
            and (o2.created_at < ${crmOportunidades.createdAt}
              or (o2.created_at = ${crmOportunidades.createdAt} and o2.id <= ${crmOportunidades.id}))
        )`,
      })
      .from(crmOportunidades)
      .leftJoin(crmEtapas, eq(crmOportunidades.etapaId, crmEtapas.id))
      .where(
        and(
          eq(crmOportunidades.contatoId, contatoId),
          eq(crmOportunidades.workspaceId, workspace.id)
        )
      )
      .orderBy(desc(crmOportunidades.createdAt))

    // O painel é client: numeric → Number e Date → ISO aqui.
    const negocios = negociosRaw.map((n) => ({
      ...n,
      valor: n.valor != null ? Number(n.valor) : null,
      createdAt: n.createdAt.toISOString(),
      ganhaEm: n.ganhaEm?.toISOString() ?? null,
      perdidaEm: n.perdidaEm?.toISOString() ?? null,
    }))

    // (3) etapas dos pipelines dos negócios — desenham a "Pipeline Completa".
    const pipelineIds = [...new Set(negocios.map((n) => n.pipelineId))]
    const etapasRaw =
      pipelineIds.length > 0
        ? await db
            .select({
              id: crmEtapas.id,
              nome: crmEtapas.nome,
              ordem: crmEtapas.ordem,
              pipelineId: crmEtapas.pipelineId,
            })
            .from(crmEtapas)
            .where(inArray(crmEtapas.pipelineId, pipelineIds))
            .orderBy(asc(crmEtapas.ordem))
        : []

    // (4) tags do lead
    const tags = await db
      .select({ id: crmTags.id, nome: crmTags.nome, cor: crmTags.cor })
      .from(crmContatoTags)
      .innerJoin(crmTags, eq(crmContatoTags.tagId, crmTags.id))
      .where(eq(crmContatoTags.contatoId, contatoId))
      .orderBy(asc(crmTags.nome))

    // (5) atendentes disponíveis (Select da ficha e do modal de atividade)
    const atendentes = await db
      .select({ id: profiles.id, nome: profiles.nome })
      .from(profiles)
      .orderBy(asc(profiles.nome))

    // (6) atividades agendadas (crm_tarefas) do lead ou de seus negócios.
    const ids = negocios.map((n) => n.id)
    const atividadesRaw = await db
      .select({
        id: crmTarefas.id,
        titulo: crmTarefas.titulo,
        tipo: crmTarefas.tipo,
        notas: crmTarefas.notas,
        prioridade: crmTarefas.prioridade,
        dataInicio: crmTarefas.dataInicio,
        dataFim: crmTarefas.dataFim,
        dataVencimento: crmTarefas.dataVencimento,
        concluida: crmTarefas.concluida,
        oportunidadeId: crmTarefas.oportunidadeId,
        donoNome: profiles.nome,
      })
      .from(crmTarefas)
      .leftJoin(profiles, eq(crmTarefas.donoId, profiles.id))
      .where(
        and(
          eq(crmTarefas.workspaceId, workspace.id),
          ids.length > 0
            ? or(eq(crmTarefas.contatoId, contatoId), inArray(crmTarefas.oportunidadeId, ids))
            : eq(crmTarefas.contatoId, contatoId)
        )
      )
      // Agenda: as mais próximas do fim da lista pra cima — a UI agrupa por dia.
      .orderBy(desc(sql`coalesce(${crmTarefas.dataInicio}, ${crmTarefas.dataVencimento})`))
      .limit(100)

    const atividades = atividadesRaw.map((a) => ({
      ...a,
      dataInicio: a.dataInicio?.toISOString() ?? null,
      dataFim: a.dataFim?.toISOString() ?? null,
      dataVencimento: a.dataVencimento.toISOString(),
    }))

    // (7) histórico: atividades do contato OU de qualquer negócio dele — o `or`
    // cobre atividades legadas gravadas só com oportunidadeId (sem contatoId).
    const historicoRaw = await db
      .select({
        id: crmAtividades.id,
        tipo: crmAtividades.tipo,
        autorNome: crmAtividades.autorNome,
        campo: crmAtividades.campo,
        de: crmAtividades.de,
        para: crmAtividades.para,
        detalhe: crmAtividades.detalhe,
        createdAt: crmAtividades.createdAt,
      })
      .from(crmAtividades)
      .where(
        and(
          eq(crmAtividades.workspaceId, workspace.id),
          ids.length > 0
            ? or(eq(crmAtividades.contatoId, contatoId), inArray(crmAtividades.oportunidadeId, ids))
            : eq(crmAtividades.contatoId, contatoId)
        )
      )
      .orderBy(desc(crmAtividades.createdAt))
      .limit(50)

    const historico = historicoRaw.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }))

    // Métricas em TS, derivadas dos GANHOS (zeradas quando não há ganho).
    const ganhos = negocios.filter((n) => n.status === 'ganha' && n.ganhaEm)
    const totalGanho = ganhos.reduce((soma, n) => soma + (n.valor ?? 0), 0)
    const ciclos = ganhos.map((n) =>
      Math.max(0, Math.round((Date.parse(n.ganhaEm as string) - Date.parse(n.createdAt)) / DIA_MS))
    )
    const maisRecente = ganhos.reduce(
      (max, n) => Math.max(max, Date.parse(n.ganhaEm as string)),
      0
    )
    const metricas: MetricasLead = {
      ticketMedio: ganhos.length > 0 ? totalGanho / ganhos.length : 0,
      total: totalGanho,
      cicloCompraDias:
        ciclos.length > 0 ? Math.round(ciclos.reduce((s, c) => s + c, 0) / ciclos.length) : 0,
      ultimaCompraDias:
        maisRecente > 0 ? Math.max(0, Math.round((Date.now() - maisRecente) / DIA_MS)) : 0,
    }

    return {
      data: {
        perfil: { ...perfil, createdAt: perfil.createdAt.toISOString() },
        negocios,
        etapas: etapasRaw,
        tags,
        atendentes,
        atividades,
        historico,
        metricas,
      },
    }
  } catch (e) {
    console.error('[getFichaLead]', e)
    return { error: 'Nao foi possivel carregar a ficha do lead.' }
  }
}

/** Salva a aba Perfil da ficha. Recalcula o telefoneNormalizado (dedup futuro). */
export async function atualizarLead(id: string, input: LeadPerfilInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = leadPerfilSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    const [salvo] = await db
      .update(crmContatos)
      .set({
        nome: v.nome,
        email: v.email ?? null,
        telefone: v.telefone ?? null,
        // Sempre derivado do telefone (igual atualizarContato): se o telefone
        // muda, a chave de dedup precisa acompanhar.
        telefoneNormalizado: normalizarTelefone(v.telefone),
        documento: v.documento ?? null,
        site: v.site ?? null,
        cargo: v.cargo ?? null,
        dataNascimento: v.dataNascimento ?? null,
        cep: v.cep ?? null,
        endereco: v.endereco ?? null,
        cidade: v.cidade ?? null,
        estado: v.estado ?? null,
        notas: v.notas ?? null,
        empresaId: v.empresaId ?? null,
        ...(v.origem !== undefined ? { origem: v.origem } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(crmContatos.id, id), eq(crmContatos.workspaceId, workspace.id)))
      .returning({ id: crmContatos.id })

    if (!salvo) return { error: 'Lead nao encontrado.' }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[atualizarLead]', e)
    return { error: 'Nao foi possivel salvar o lead.' }
  }
}

// Limite da FOTO do lead (avatar) — bem menor que documentos (50MB).
const MAX_FOTO_BYTES = 2 * 1024 * 1024 // 2 MB

/**
 * Envia a foto do lead (lápis sobre o avatar da ficha) para o bucket PÚBLICO
 * crm-fotos e grava a URL pública em foto_url. O path é fixo por lead
 * (leads/{id}.{ext}) com upsert: trocar a foto sobrescreve a anterior; o
 * `?v=timestamp` na URL fura o cache do navegador na troca.
 */
export async function atualizarFotoLead(contatoId: string, formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Nenhuma imagem selecionada.' }
  if (!file.type.startsWith('image/')) return { error: 'Envie uma imagem (JPG, PNG ou WebP).' }
  if (file.size > MAX_FOTO_BYTES) return { error: 'Imagem muito grande. Maximo: 2 MB.' }

  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `leads/${contatoId}.${ext}`
    const upload = await uploadFile(file, contatoId, {
      bucket: 'crm-fotos',
      path,
      upsert: true,
    })
    if ('error' in upload) return { error: upload.error }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) return { error: 'NEXT_PUBLIC_SUPABASE_URL nao configurada.' }
    const fotoUrl = `${base}/storage/v1/object/public/crm-fotos/${upload.path}?v=${Date.now()}`

    const [salvo] = await db
      .update(crmContatos)
      .set({ fotoUrl, updatedAt: new Date() })
      .where(and(eq(crmContatos.id, contatoId), eq(crmContatos.workspaceId, workspace.id)))
      .returning({ id: crmContatos.id })

    if (!salvo) return { error: 'Lead nao encontrado.' }

    revalidatePath('/crm')
    return { data: { fotoUrl } }
  } catch (e) {
    console.error('[atualizarFotoLead]', e)
    return { error: 'Nao foi possivel enviar a foto.' }
  }
}

/** Renomeia o lead (edição inline do nome na ficha) — update parcial. */
export async function renomearLead(contatoId: string, nome: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const limpo = nome.trim()
  if (!limpo) return { error: 'Informe o nome do lead.' }

  try {
    const [salvo] = await db
      .update(crmContatos)
      .set({ nome: limpo, updatedAt: new Date() })
      .where(and(eq(crmContatos.id, contatoId), eq(crmContatos.workspaceId, workspace.id)))
      .returning({ id: crmContatos.id })

    if (!salvo) return { error: 'Lead nao encontrado.' }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[renomearLead]', e)
    return { error: 'Nao foi possivel renomear o lead.' }
  }
}

/** Salva as notas do lead (Textarea recolhível da ficha) — update parcial. */
export async function salvarNotasLead(contatoId: string, notas: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const [salvo] = await db
      .update(crmContatos)
      .set({ notas: notas.trim() || null, updatedAt: new Date() })
      .where(and(eq(crmContatos.id, contatoId), eq(crmContatos.workspaceId, workspace.id)))
      .returning({ id: crmContatos.id })

    if (!salvo) return { error: 'Lead nao encontrado.' }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[salvarNotasLead]', e)
    return { error: 'Nao foi possivel salvar as notas.' }
  }
}

/** Troca o atendente do lead (Select da ficha). donoId null = sem atendente. */
export async function atualizarAtendenteLead(contatoId: string, donoId: string | null) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const [salvo] = await db
      .update(crmContatos)
      .set({ donoId, updatedAt: new Date() })
      .where(and(eq(crmContatos.id, contatoId), eq(crmContatos.workspaceId, workspace.id)))
      .returning({ id: crmContatos.id })

    if (!salvo) return { error: 'Lead nao encontrado.' }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[atualizarAtendenteLead]', e)
    return { error: 'Nao foi possivel trocar o atendente.' }
  }
}
