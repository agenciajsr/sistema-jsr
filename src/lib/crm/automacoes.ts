// Automações de lead novo (aba Ferramentas): aviso ao SDR e primeira mensagem
// automática ao lead, via API da extensão WaScript (WhatsApp).
// O disparo NUNCA pode derrubar a ingestão do lead: erros só logam.

import { db } from '@/lib/db'
import { automacoes } from '@/lib/db/schema'
import type { EntradaNormalizada } from '@/lib/crm/normalizar-entrada'
import { nomeOrigem } from '@/lib/crm/origem'

export const CHAVES_AUTOMACAO = ['aviso_lead_novo', 'mensagem_lead_novo'] as const
export type ChaveAutomacao = (typeof CHAVES_AUTOMACAO)[number]

export type ConfigAutomacao = {
  /** Token da API WaScript. */
  token?: string
  /** Números destino separados por vírgula (só no aviso ao SDR). */
  numeros?: string
  /** Template da mensagem, com variáveis {nome} {telefone} {origem} {respostas}. */
  mensagem?: string
}

/**
 * Substitui as variáveis do template pelos dados do lead. PURO (testável).
 * Variáveis: {nome}, {telefone}, {origem}, {respostas} (lista pergunta→resposta).
 */
export function renderizarTemplate(template: string, lead: EntradaNormalizada): string {
  const respostas = lead.extra.respostas
    .map((r) => `${r.pergunta}: ${r.resposta}`)
    .join('\n')
  return template
    .replaceAll('{nome}', lead.nome)
    .replaceAll('{telefone}', lead.telefone ?? '—')
    .replaceAll('{origem}', nomeOrigem(lead.fonte))
    .replaceAll('{respostas}', respostas)
    .trim()
}

/** Envia um texto pelo WaScript. Lança em falha de rede; o chamador decide. */
async function enviarTextoWascript(token: string, phone: string, message: string) {
  const url = new URL(`https://api-whatsapp.wascript.com.br/api/enviar-texto/${token}`)
  url.searchParams.set('phone', phone)
  url.searchParams.set('message', message)
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`WaScript HTTP ${res.status}`)
}

/**
 * Dispara as automações de LEAD NOVO (se ativas): aviso ao SDR e mensagem
 * automática ao lead. Chamado após o processarLead com sucesso (não duplicado).
 * Nunca lança — falha de envio não pode impedir o lead de entrar no CRM.
 */
export async function dispararAutomacoesLeadNovo(lead: EntradaNormalizada): Promise<void> {
  try {
    const linhas = await db.select().from(automacoes)
    const porChave = new Map(linhas.map((l) => [l.chave, l]))

    // (1) Aviso ao SDR: manda para cada número configurado.
    const aviso = porChave.get('aviso_lead_novo')
    const avisoCfg = (aviso?.config ?? {}) as ConfigAutomacao
    if (aviso?.ativo && avisoCfg.token && avisoCfg.numeros && avisoCfg.mensagem) {
      const texto = renderizarTemplate(avisoCfg.mensagem, lead)
      for (const numero of avisoCfg.numeros.split(',').map((n) => n.trim()).filter(Boolean)) {
        try {
          await enviarTextoWascript(avisoCfg.token, numero.replace(/\D/g, ''), texto)
        } catch (e) {
          console.error('[automacao aviso_lead_novo]', numero, e)
        }
      }
    }

    // (2) Mensagem automática ao lead (precisa do telefone do lead).
    const msg = porChave.get('mensagem_lead_novo')
    const msgCfg = (msg?.config ?? {}) as ConfigAutomacao
    if (msg?.ativo && msgCfg.token && msgCfg.mensagem && lead.telefone) {
      try {
        await enviarTextoWascript(
          msgCfg.token,
          lead.telefone.replace(/\D/g, ''),
          renderizarTemplate(msgCfg.mensagem, lead),
        )
      } catch (e) {
        console.error('[automacao mensagem_lead_novo]', e)
      }
    }
  } catch (e) {
    console.error('[dispararAutomacoesLeadNovo]', e)
  }
}

/** Lê as automações (para a aba Ferramentas). */
export async function getAutomacoes() {
  const linhas = await db.select().from(automacoes)
  return CHAVES_AUTOMACAO.map((chave) => {
    const l = linhas.find((x) => x.chave === chave)
    return { chave, ativo: l?.ativo ?? false, config: (l?.config ?? {}) as ConfigAutomacao }
  })
}

/** Grava (upsert) uma automação. */
export async function salvarAutomacao(chave: ChaveAutomacao, ativo: boolean, config: ConfigAutomacao) {
  await db
    .insert(automacoes)
    .values({ chave, ativo, config, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: automacoes.chave,
      set: { ativo, config, updatedAt: new Date() },
    })
}

/** Garante que a chave é válida antes de gravar (usado pela action). */
export function ehChaveAutomacao(v: string): v is ChaveAutomacao {
  return (CHAVES_AUTOMACAO as readonly string[]).includes(v)
}
