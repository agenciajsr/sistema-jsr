// Serviços contratados ESTRUTURADOS do contrato — módulo PURO (zero import de
// db/react). Decisão travada: checklist de serviços com valor individual
// (NÃO pacotes); plataformas (Meta/Google) só quando o serviço é tráfego pago.
//
// Formato gravado em contratos.servicos (jsonb): ServicoContratado[].
// null na coluna = contrato legado (usa servico + valorMensal como antes).

import { z } from 'zod'

import { SERVICOS_KEYS, type ServicoJsr } from '@/lib/crm/servicos'

export const PLATAFORMAS_TRAFEGO = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
} as const

export type PlataformaTrafego = keyof typeof PLATAFORMAS_TRAFEGO

export const PLATAFORMAS_KEYS = Object.keys(PLATAFORMAS_TRAFEGO) as [
  PlataformaTrafego,
  ...PlataformaTrafego[],
]

export type ServicoContratado = {
  /** Chave de SERVICOS_JSR (src/lib/crm/servicos.ts). */
  servico: ServicoJsr
  /** Valor MENSAL do serviço, em reais (> 0). */
  valor: number
  /** OBRIGATÓRIO (1+) quando servico === 'trafego_pago'; ausente nos demais. */
  plataformas?: PlataformaTrafego[]
}

// Rótulos pt-BR COM acento para a UI (SERVICOS_JSR é sem acento — chaves do
// banco; aqui é só apresentação).
export const ROTULOS_SERVICOS_UI: Record<ServicoJsr, string> = {
  trafego_pago: 'Tráfego Pago',
  landing_page: 'Landing Page e Site',
  crm_automacao: 'CRM e Automação',
  estrategia: 'Estratégia e Estruturação',
}

/** Rótulo pt-BR (com acento) do serviço para a UI e o texto do contrato. */
export function rotuloServicoUi(servico: ServicoJsr): string {
  return ROTULOS_SERVICOS_UI[servico]
}

const itemSchema = z.object({
  servico: z.enum(SERVICOS_KEYS, { message: 'Serviço inválido.' }),
  valor: z
    .number({ message: 'Informe o valor do serviço.' })
    .positive('O valor de cada serviço deve ser maior que zero.'),
  plataformas: z.array(z.enum(PLATAFORMAS_KEYS)).optional(),
})

export const servicosContratadosSchema = z
  .array(itemSchema)
  .min(1, 'Marque pelo menos um serviço.')
  .superRefine((itens, ctx) => {
    const vistos = new Set<string>()
    itens.forEach((item, i) => {
      if (vistos.has(item.servico)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Serviço marcado mais de uma vez.',
          path: [i, 'servico'],
        })
      }
      vistos.add(item.servico)

      if (item.servico === 'trafego_pago') {
        if (!item.plataformas || item.plataformas.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Marque pelo menos uma plataforma (Meta Ads ou Google Ads).',
            path: [i, 'plataformas'],
          })
        }
      } else if (item.plataformas && item.plataformas.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Plataformas só se aplicam ao Tráfego Pago.',
          path: [i, 'plataformas'],
        })
      }
    })
  })

/** Soma dos valores mensais dos serviços, arredondada a 2 casas decimais. */
export function somaServicos(itens: ServicoContratado[]): number {
  const total = itens.reduce((acc, item) => acc + item.valor, 0)
  return Math.round(total * 100) / 100
}

/** 'Meta Ads' | 'Google Ads' | 'Meta Ads e Google Ads' | '' (sem plataformas). */
export function rotuloPlataformas(plataformas?: PlataformaTrafego[]): string {
  if (!plataformas || plataformas.length === 0) return ''
  return plataformas.map((p) => PLATAFORMAS_TRAFEGO[p]).join(' e ')
}

/**
 * Um parágrafo pt-BR por serviço contratado, para a cláusula do OBJETO do
 * contrato. Redação jurídica simples; tráfego pago cita as plataformas.
 */
export function descricaoObjetoServicos(itens: ServicoContratado[]): string[] {
  return itens.map((item) => {
    switch (item.servico) {
      case 'trafego_pago':
        return (
          'Gestão de tráfego pago (criação, gerenciamento e otimização de campanhas de ' +
          `anúncios) nas plataformas ${rotuloPlataformas(item.plataformas)};`
        )
      case 'landing_page':
        return 'Criação e/ou manutenção de landing page e site do(a) CONTRATANTE;'
      case 'crm_automacao':
        return 'Implantação e configuração de CRM e automações de atendimento;'
      case 'estrategia':
        return 'Consultoria de estratégia e estruturação de marketing digital;'
    }
  })
}
