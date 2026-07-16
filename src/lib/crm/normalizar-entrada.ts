// Normaliza o corpo cru de um POST de captação de lead (webhook de landing) para
// o formato do leadEntradaSchema. Módulo PURO (sem db/rede) e testável.
//
// Motivação: o formulário do Elementor (WordPress) NÃO manda JSON — manda
// form-data com nomes de campo próprios (e, com "Advanced Data" ligado, uma
// estrutura aninhada com título + valor de cada campo). Este módulo aceita:
//   - JSON já no nosso formato ({ fonte, nome, telefone, ... })
//   - Elementor "Advanced Data OFF": form_fields[<id>] / fields[<id>]
//   - Elementor "Advanced Data ON": fields[<id>][title] + fields[<id>][value]
// e sempre preserva TUDO em `extra.respostas` (pergunta→resposta) + `extra.raw`,
// pra nada se perder (respostas qualificadoras aparecem no card depois).

import { FONTES_LEAD } from '@/lib/validations/crm'

export type ParPergunta = { pergunta: string; resposta: string }

export type EntradaNormalizada = {
  fonte: (typeof FONTES_LEAD)[number]
  nome: string
  email?: string
  telefone?: string
  empresa?: string
  extra: { respostas: ParPergunta[]; raw: Record<string, string> }
}

// Chaves de metadados do Elementor/webhook que NÃO são respostas do lead.
const RUIDO = /^(form_id|form_name|form|page_url|page_title|remote_ip|user_agent|date|referrer|queried_id|meta|token|fonte|_.*)$|url$|_id$|_ip$|agent$/i

// Heurísticas de mapeamento por rótulo/chave do campo.
const RE_NOME = /(^|[^a-z])(nome|name)([^a-z]|$)/i
const RE_TELEFONE = /(whats|telefone|phone|celular|fone|tel)/i
const RE_EMAIL = /(mail)/i
const RE_EMPRESA = /(empresa|clinica|clínica|negocio|negócio|company)/i
const RE_EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ehFonteValida(v: unknown): v is (typeof FONTES_LEAD)[number] {
  return typeof v === 'string' && (FONTES_LEAD as readonly string[]).includes(v)
}

/**
 * Extrai pares pergunta→resposta de um mapa cru de chaves/valores, entendendo as
 * três formas (JSON simples, Elementor flat e Elementor aninhado com título).
 */
function extrairPares(raw: Record<string, string>): ParPergunta[] {
  const grupos = new Map<string, { title?: string; value?: string }>()
  const pares: ParPergunta[] = []

  for (const [chave, valor] of Object.entries(raw)) {
    // Elementor "Advanced Data": <prefixo>[title] / <prefixo>[value] / <prefixo>[raw_value]
    const m = chave.match(/^(.*)\[(title|value|raw_value)\]$/)
    if (m) {
      const [, prefixo, leaf] = m
      const g = grupos.get(prefixo) ?? {}
      if (leaf === 'title') g.title = valor
      else if (g.value === undefined) g.value = valor // value tem prioridade sobre raw_value
      grupos.set(prefixo, g)
      continue
    }

    // Elementor flat: form_fields[<id>] / fields[<id>]  -> rótulo = id
    const f = chave.match(/^(?:form_fields|fields)\[([^\]]+)\]$/)
    if (f) {
      pares.push({ pergunta: f[1], resposta: valor })
      continue
    }

    // JSON simples / chave escalar comum (ignora metadados de webhook).
    if (!RUIDO.test(chave)) {
      pares.push({ pergunta: chave, resposta: valor })
    }
  }

  for (const [prefixo, g] of grupos) {
    // rótulo legível: título do campo (Advanced Data) ou o id extraído do prefixo.
    const idBracket = prefixo.match(/\[([^\]]+)\]\s*$/)?.[1]
    const rotulo = g.title || idBracket || prefixo
    if (RUIDO.test(rotulo)) continue
    pares.push({ pergunta: rotulo, resposta: g.value ?? '' })
  }

  return pares
}

/** Acha o primeiro par cujo rótulo casa a heurística; remove-o dos "restantes". */
function acharPorRotulo(pares: ParPergunta[], re: RegExp): string | undefined {
  const p = pares.find((x) => re.test(x.pergunta) && x.resposta.trim() !== '')
  return p?.resposta.trim() || undefined
}

/**
 * Normaliza o corpo cru (JSON já parseado OU form-data achatado) para o formato
 * de entrada do leadEntradaSchema. Nunca lança: sempre devolve algo ingerível
 * (nome cai em telefone/email/"Lead sem nome" quando não há campo de nome).
 */
export function normalizarLeadEntrada(raw: Record<string, unknown>): EntradaNormalizada {
  // Achata tudo para string (form-data já é string; JSON pode ter números/bools).
  const plano: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) continue
    plano[k] = typeof v === 'string' ? v : String(v)
  }

  const pares = extrairPares(plano)

  const nome = acharPorRotulo(pares, RE_NOME)
  const telefone = acharPorRotulo(pares, RE_TELEFONE)
  const emailBruto = acharPorRotulo(pares, RE_EMAIL)
  const email = emailBruto && RE_EMAIL_VALIDO.test(emailBruto) ? emailBruto : undefined
  const empresa = acharPorRotulo(pares, RE_EMPRESA)

  // fonte: respeita a explícita (se válida), senão assume landing_page (é uma landing).
  const fonte = ehFonteValida(raw.fonte) ? raw.fonte : 'landing_page'

  return {
    fonte,
    nome: nome || telefone || email || 'Lead sem nome',
    email,
    telefone,
    empresa,
    extra: { respostas: pares, raw: plano },
  }
}
