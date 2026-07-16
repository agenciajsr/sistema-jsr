// Normaliza o corpo cru de um POST de captação de lead (webhook de landing) para
// o formato do leadEntradaSchema. Módulo PURO (sem db/rede) e testável.
//
// Motivação: o formulário do Elementor (WordPress) NÃO manda JSON — manda
// form-data. Com "Advanced Data" ligado, cada campo vem como um grupo aninhado:
//   fields[<id>][title] = "Seu Nome"     (rótulo/pergunta)
//   fields[<id>][value] = "João"         (resposta)
//   fields[<id>][type]  = "text|tel|email|select|step|hidden"
// Além dos campos, o Elementor manda metadados (form[...], meta[...]) e campos
// ocultos de UTM (utm_source/medium/campaign/content/term). Este módulo:
//   - mapeia nome/telefone/email por heurística de rótulo;
//   - separa UTM em extra.utm (para a aba de Rastreamento);
//   - guarda as demais perguntas em extra.respostas (pergunta→resposta) para o card;
//   - preserva o payload cru em extra.raw.
// Aceita também JSON já no nosso formato ({ fonte, nome, telefone, ... }).

import { FONTES_LEAD } from '@/lib/validations/crm'

export type ParPergunta = { pergunta: string; resposta: string }

export type EntradaNormalizada = {
  fonte: (typeof FONTES_LEAD)[number]
  nome: string
  email?: string
  telefone?: string
  empresa?: string
  extra: {
    respostas: ParPergunta[]
    utm: Record<string, string>
    raw: Record<string, string>
  }
}

type Campo = { id: string; label: string; value: string; type?: string }

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

// Metadados de webhook que NÃO são resposta do lead (para chaves escalares/JSON).
const RUIDO = /^(token|fonte|form_id|form_name|page_url|page_title|remote_ip|user_agent|date|referrer|queried_id)$/i

// Heurísticas de mapeamento por rótulo do campo.
const RE_NOME = /(^|[^a-zà-ú])(nome|name)([^a-zà-ú]|$)/i
const RE_TELEFONE = /(whats|telefone|phone|celular|fone|\btel\b)/i
const RE_EMAIL = /mail/i
// Empresa: conservador de propósito — NÃO casar "clínica" (aparece em várias
// perguntas qualificadoras: "faturamento da sua clínica", "agenda da clínica"...).
const RE_EMPRESA = /(nome da empresa|raz[aã]o social|\bempresa\b|company)/i
const RE_EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ehFonteValida(v: unknown): v is (typeof FONTES_LEAD)[number] {
  return typeof v === 'string' && (FONTES_LEAD as readonly string[]).includes(v)
}

/**
 * Extrai os CAMPOS reais do formulário (ignorando estrutura form[...]/meta[...] e
 * separadores de passo) e coleta os UTM à parte. Entende tanto o Elementor
 * aninhado (fields[id][title|value|type]) quanto o flat (form_fields[id]/fields[id])
 * e chaves escalares de JSON.
 */
function coletarCampos(raw: Record<string, string>): { campos: Campo[]; utm: Record<string, string> } {
  const grupos = new Map<string, { title?: string; value?: string; rawValue?: string; type?: string }>()
  const flat: Campo[] = []
  const utm: Record<string, string> = {}

  const registrarUtmOuFlat = (id: string, valor: string) => {
    if (UTM_KEYS.includes(id)) {
      if (valor.trim() !== '') utm[id] = valor
    } else {
      flat.push({ id, label: id, value: valor })
    }
  }

  for (const [chave, valor] of Object.entries(raw)) {
    // Estrutura/metadados do Elementor — descarta.
    if (chave.startsWith('form[') || chave.startsWith('meta[')) continue

    // Aninhado: fields[<id>][leaf]
    const m = chave.match(/^fields\[([^\]]+)\]\[(title|value|raw_value|type|id|required)\]$/)
    if (m) {
      const [, id, leaf] = m
      const g = grupos.get(id) ?? {}
      if (leaf === 'title') g.title = valor
      else if (leaf === 'value') g.value = valor
      else if (leaf === 'raw_value') g.rawValue = valor
      else if (leaf === 'type') g.type = valor
      grupos.set(id, g)
      continue
    }

    // Flat: form_fields[<id>] ou fields[<id>]
    const f = chave.match(/^(?:form_fields|fields)\[([^\]]+)\]$/)
    if (f) {
      registrarUtmOuFlat(f[1], valor)
      continue
    }

    // JSON/escalar simples (ignora metadados conhecidos).
    if (!RUIDO.test(chave)) registrarUtmOuFlat(chave, valor)
  }

  const campos: Campo[] = [...flat]
  for (const [id, g] of grupos) {
    if (g.type === 'step') continue // separador de multi-step — não é campo
    const value = g.value ?? g.rawValue ?? ''
    if (UTM_KEYS.includes(id)) {
      if (value.trim() !== '') utm[id] = value
      continue
    }
    campos.push({ id, label: (g.title || '').trim() || id, value, type: g.type })
  }

  return { campos, utm }
}

/** Acha o 1º campo cujo rótulo casa a heurística e tem valor; devolve o Campo. */
function acharCampo(campos: Campo[], re: RegExp): Campo | undefined {
  return campos.find((c) => re.test(c.label) && c.value.trim() !== '')
}

/**
 * Normaliza o corpo cru (JSON já parseado OU form-data achatado) para o formato
 * de entrada do leadEntradaSchema. Nunca lança: sempre devolve algo ingerível
 * (nome cai em telefone/email/"Lead sem nome" quando não há campo de nome).
 */
export function normalizarLeadEntrada(raw: Record<string, unknown>): EntradaNormalizada {
  const plano: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) continue
    plano[k] = typeof v === 'string' ? v : String(v)
  }

  const { campos, utm } = coletarCampos(plano)

  const campoNome = acharCampo(campos, RE_NOME)
  const campoTelefone = acharCampo(campos, RE_TELEFONE)
  const campoEmail = acharCampo(campos, RE_EMAIL)
  const campoEmpresa = acharCampo(campos, RE_EMPRESA)

  const emailBruto = campoEmail?.value.trim()
  const email = emailBruto && RE_EMAIL_VALIDO.test(emailBruto) ? emailBruto : undefined
  const telefone = campoTelefone?.value.trim() || undefined
  const empresa = campoEmpresa?.value.trim() || undefined

  // Campos já usados como básicos não repetem nas "respostas".
  const usados = new Set([campoNome, campoTelefone, campoEmail, campoEmpresa].filter(Boolean))
  const respostas: ParPergunta[] = campos
    .filter((c) => !usados.has(c) && c.value.trim() !== '' && c.label.trim() !== '')
    .map((c) => ({ pergunta: c.label, resposta: c.value }))

  const fonte = ehFonteValida(raw.fonte) ? raw.fonte : 'landing_page'

  return {
    fonte,
    nome: campoNome?.value.trim() || telefone || email || 'Lead sem nome',
    email,
    telefone,
    empresa,
    extra: { respostas, utm, raw: plano },
  }
}
