// Feed REAL de atividade da agência — substitui o mock de /acompanhamento.
// Junta 4 fontes em ordem cronológica: acompanhamentos dos clientes,
// timeline do CRM, transações financeiras e clientes novos.
// Queries SEQUENCIAIS (pool max=3, memória do projeto), cada uma com LIMIT.

import { and, desc, eq, gte, lt } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  acompanhamentos,
  clientes,
  crmAtividades,
  crmContatos,
  transacoes,
} from '@/lib/db/schema'

export type ItemFeed = {
  id: string
  fonte: 'acompanhamento' | 'crm' | 'financeiro' | 'cliente_novo'
  titulo: string
  sub: string
  quando: Date
}

const LIMITE_POR_FONTE = 60

export type JanelaFeed = { de: Date; ate: Date }

// Rótulos pt-BR dos tipos da timeline do CRM (os mais comuns; desconhecido
// cai no próprio tipo com underscores trocados por espaço).
const ROTULO_CRM: Record<string, string> = {
  lead_recebido: 'Lead recebido',
  criacao: 'Negócio criado',
  contato_criado: 'Lead cadastrado',
  mudanca_etapa: 'Lead mudou de etapa',
  ganho: 'Negócio ganho',
  perda: 'Negócio perdido',
  reaberto: 'Negócio reaberto',
  tarefa_criada: 'Atividade criada',
  tarefa_concluida: 'Atividade concluída',
  nota: 'Nota adicionada',
  tag_adicionada: 'Tag adicionada',
  tag_removida: 'Tag removida',
  conversao_cliente: 'Lead convertido em cliente',
}

function rotuloCrm(tipo: string): string {
  return ROTULO_CRM[tipo] ?? tipo.replaceAll('_', ' ')
}

export async function getFeedAtividades(janela: JanelaFeed): Promise<ItemFeed[]> {
  const itens: ItemFeed[] = []
  const { de, ate } = janela

  // (1) Acompanhamentos por cliente.
  try {
    const rows = await db
      .select({
        id: acompanhamentos.id,
        autorNome: acompanhamentos.autorNome,
        nota: acompanhamentos.nota,
        clienteNome: clientes.nome,
        createdAt: acompanhamentos.createdAt,
      })
      .from(acompanhamentos)
      .innerJoin(clientes, eq(acompanhamentos.clienteId, clientes.id))
      .where(and(gte(acompanhamentos.createdAt, de), lt(acompanhamentos.createdAt, ate)))
      .orderBy(desc(acompanhamentos.createdAt))
      .limit(LIMITE_POR_FONTE)
    for (const r of rows) {
      itens.push({
        id: `acomp-${r.id}`,
        fonte: 'acompanhamento',
        titulo: `Acompanhamento — ${r.clienteNome}`,
        sub: `${r.autorNome}: ${r.nota}`,
        quando: r.createdAt,
      })
    }
  } catch (e) {
    console.error('[feed] acompanhamentos indisponiveis', e)
  }

  // (2) Timeline do CRM.
  try {
    const rows = await db
      .select({
        id: crmAtividades.id,
        tipo: crmAtividades.tipo,
        autorNome: crmAtividades.autorNome,
        detalhe: crmAtividades.detalhe,
        de: crmAtividades.de,
        para: crmAtividades.para,
        contatoNome: crmContatos.nome,
        createdAt: crmAtividades.createdAt,
      })
      .from(crmAtividades)
      .leftJoin(crmContatos, eq(crmAtividades.contatoId, crmContatos.id))
      .where(and(gte(crmAtividades.createdAt, de), lt(crmAtividades.createdAt, ate)))
      .orderBy(desc(crmAtividades.createdAt))
      .limit(LIMITE_POR_FONTE)
    for (const r of rows) {
      const mudanca = r.de && r.para ? `${r.de} → ${r.para}` : null
      const partes = [r.contatoNome, mudanca ?? r.detalhe, `por ${r.autorNome}`].filter(Boolean)
      itens.push({
        id: `crm-${r.id}`,
        fonte: 'crm',
        titulo: rotuloCrm(r.tipo),
        sub: partes.join(' · '),
        quando: r.createdAt,
      })
    }
  } catch (e) {
    console.error('[feed] timeline do CRM indisponivel', e)
  }

  // (3) Transações financeiras.
  try {
    const rows = await db
      .select({
        id: transacoes.id,
        tipo: transacoes.tipo,
        descricao: transacoes.descricao,
        valor: transacoes.valor,
        createdAt: transacoes.createdAt,
      })
      .from(transacoes)
      .where(and(gte(transacoes.createdAt, de), lt(transacoes.createdAt, ate)))
      .orderBy(desc(transacoes.createdAt))
      .limit(LIMITE_POR_FONTE)
    for (const r of rows) {
      const valor = Number(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      itens.push({
        id: `fin-${r.id}`,
        fonte: 'financeiro',
        titulo: r.tipo === 'receita' ? 'Receita registrada' : 'Despesa registrada',
        sub: `${r.descricao} — ${valor}`,
        quando: r.createdAt,
      })
    }
  } catch (e) {
    console.error('[feed] transacoes indisponiveis', e)
  }

  // (4) Clientes novos.
  try {
    const rows = await db
      .select({ id: clientes.id, nome: clientes.nome, createdAt: clientes.createdAt })
      .from(clientes)
      .where(and(gte(clientes.createdAt, de), lt(clientes.createdAt, ate)))
      .orderBy(desc(clientes.createdAt))
      .limit(LIMITE_POR_FONTE)
    for (const r of rows) {
      itens.push({
        id: `cli-${r.id}`,
        fonte: 'cliente_novo',
        titulo: 'Novo cliente cadastrado',
        sub: r.nome,
        quando: r.createdAt,
      })
    }
  } catch (e) {
    console.error('[feed] clientes indisponiveis', e)
  }

  return itens.sort((a, b) => b.quando.getTime() - a.quando.getTime()).slice(0, 150)
}
