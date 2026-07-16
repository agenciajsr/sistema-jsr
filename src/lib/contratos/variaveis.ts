// Variáveis do contrato — módulo PURO (zero import de db/auth/react).
// Recebe o registro do contrato + o jsonb dadosContratante e devolve as
// variáveis prontas para interpolar no template (template-trafego.ts).
//
// Decisão v1: valor mensal SÓ em formato numérico BRL ("R$ 1.500,00"),
// SEM valor por extenso — o texto dos DOCX de referência também não usa.

import { contratanteSchema, type ContratanteInput } from '@/lib/validations/contratante'
import {
  servicosContratadosSchema,
  rotuloPlataformas,
  rotuloServicoUi,
  type ServicoContratado,
} from './servicos-contratados'

export type VariaveisContrato = {
  /** Parágrafo de qualificação completa do CONTRATANTE (PJ ou PF). */
  qualificacaoContratante: string
  /** Quem assina: representante legal (PJ) ou a própria pessoa (PF). */
  nomeSignatario: string
  cpfSignatario: string
  emailSignatario: string
  valorMensalFormatado: string
  duracaoMeses: 3 | 6
  dataInicioFormatada: string
  dataVencimentoFormatada: string
  /** Serviços estruturados (quick-260716-ky2); null = contrato legado. */
  servicos: ServicoContratado[] | null
  /** Ex.: "Tráfego Pago (Meta Ads e Google Ads): R$ 1.500,00" — p/ cláusula de valor. */
  linhasValorPorServico: string[]
}

export type ResultadoVariaveis = { data: VariaveisContrato } | { error: string }

/** Formata CPF (11 dígitos) como 000.000.000-00; aceita cru ou mascarado. */
export function formatarCpf(valor: string): string {
  const d = valor.replace(/\D/g, '')
  if (d.length !== 11) return valor
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Formata CNPJ (14 dígitos) como 00.000.000/0000-00; aceita cru ou mascarado. */
export function formatarCnpj(valor: string): string {
  const d = valor.replace(/\D/g, '')
  if (d.length !== 14) return valor
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

// Intl usa espaço não separável entre "R$" e o número — normalizamos para
// espaço comum (consistência entre HTML, PDF e testes).
const formatadorBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function formatarBrl(valor: number): string {
  return formatadorBrl.format(valor).replace(/\u00A0/g, ' ')
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' por split de string (nunca Date — fuso). */
function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function qualificacao(dados: ContratanteInput): string {
  if (dados.tipo === 'pj') {
    return (
      `${dados.razaoSocial}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ` +
      `${formatarCnpj(dados.cnpj)}, com sede na ${dados.enderecoSede}, telefone ${dados.telefone}, ` +
      `neste ato representada por ${dados.nomeRepresentante}, ${dados.nacionalidade}, ` +
      `${dados.estadoCivil}, ${dados.profissao}, inscrito(a) no CPF sob o nº ${formatarCpf(dados.cpf)}, ` +
      `residente e domiciliado(a) em ${dados.enderecoRepresentante}, doravante nominada ` +
      `simplesmente de CONTRATANTE.`
    )
  }
  return (
    `${dados.nomeCompleto}, ${dados.nacionalidade}, ${dados.estadoCivil}, ${dados.profissao}, ` +
    `inscrito(a) no CPF sob o nº ${formatarCpf(dados.cpf)}, residente e domiciliado(a) em ` +
    `${dados.endereco}, telefone ${dados.telefone}, doravante nominado(a) simplesmente de CONTRATANTE.`
  )
}

export function montarVariaveisContrato({
  contrato,
  dadosContratante,
}: {
  contrato: {
    dataInicio: string
    dataVencimento: string
    valorMensal: string
    duracaoMeses: number | null
    /** jsonb cru de contratos.servicos; inválido/ausente → contrato legado. */
    servicos?: unknown
  }
  dadosContratante: unknown
}): ResultadoVariaveis {
  if (!dadosContratante) {
    return { error: 'O contratante ainda não preencheu os dados pelo link público.' }
  }

  const parsed = contratanteSchema.safeParse(dadosContratante)
  if (!parsed.success) {
    return { error: 'Os dados do contratante estão incompletos — peça o preenchimento novamente.' }
  }

  if (contrato.duracaoMeses !== 3 && contrato.duracaoMeses !== 6) {
    return {
      error:
        'Duração do contrato inválida — só há template para 3 ou 6 meses. Edite o contrato e informe a duração.',
    }
  }

  const valor = Number(contrato.valorMensal)
  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: 'Valor mensal do contrato inválido.' }
  }

  // Serviços estruturados: parse defensivo — jsonb inválido/ausente vira null
  // (contrato legado, texto exatamente como antes).
  const servicosParsed = servicosContratadosSchema.safeParse(contrato.servicos)
  const servicos = servicosParsed.success ? servicosParsed.data : null
  const linhasValorPorServico = (servicos ?? []).map((s) => {
    const plataformas = s.plataformas?.length ? ` (${rotuloPlataformas(s.plataformas)})` : ''
    return `${rotuloServicoUi(s.servico)}${plataformas}: ${formatarBrl(s.valor)}`
  })

  const dados = parsed.data
  return {
    data: {
      qualificacaoContratante: qualificacao(dados),
      nomeSignatario: dados.tipo === 'pj' ? dados.nomeRepresentante : dados.nomeCompleto,
      cpfSignatario: formatarCpf(dados.cpf),
      emailSignatario: dados.email,
      valorMensalFormatado: formatarBrl(valor),
      duracaoMeses: contrato.duracaoMeses,
      dataInicioFormatada: formatarDataBr(contrato.dataInicio),
      dataVencimentoFormatada: formatarDataBr(contrato.dataVencimento),
      servicos,
      linhasValorPorServico,
    },
  }
}
