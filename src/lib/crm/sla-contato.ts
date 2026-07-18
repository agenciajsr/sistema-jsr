// SLA de 1º contato do CRM — módulo PURO (zero import de db/react/next).
//
// Regra de negócio: todo lead ABERTO precisa receber o 1º contato comercial
// (ligação/WhatsApp/e-mail/reunião, 1ª tarefa concluída ou mudança de etapa)
// em até 1 hora — lead quente esfria em minutos (decisão do usuário, 17/jul).
// O carimbo vive em crm_oportunidades.primeiro_contato_em (migration 0034);
// este módulo só faz a matemática/texto — quem consulta o banco é dados.ts
// e calcular.ts.

/**
 * SLA em HORAS para o 1º contato de um lead aberto.
 * Configurável = editar AQUI (sem UI de configuração por ora — decisão do
 * quick 260717-qq6). Ao estourar: card fica vermelho no kanban + alerta
 * persistido 'sla_primeiro_contato'.
 */
export const SLA_PRIMEIRO_CONTATO_HORAS = 1

const MS_POR_HORA = 60 * 60 * 1000

/** Horas (decimais) desde a criação do lead até `agora`. Nunca negativo. */
export function horasAguardando(criadaEm: Date | string, agora: Date = new Date()): number {
  const criada = criadaEm instanceof Date ? criadaEm : new Date(criadaEm)
  const horas = (agora.getTime() - criada.getTime()) / MS_POR_HORA
  return horas > 0 ? horas : 0
}

/** true quando o lead já aguarda o SLA inteiro — o limite EM PONTO conta como estourado. */
export function estourouSla(criadaEm: Date | string, agora: Date = new Date()): boolean {
  return horasAguardando(criadaEm, agora) >= SLA_PRIMEIRO_CONTATO_HORAS
}

/**
 * Texto pt-BR do indicador do card: "aguardando 1º contato há 3h";
 * a partir de 48h vira dias inteiros: "aguardando 1º contato há 2d".
 */
export function textoAguardando(horas: number): string {
  const inteiras = Math.floor(horas)
  if (inteiras >= 48) {
    return `aguardando 1º contato há ${Math.floor(inteiras / 24)}d`
  }
  return `aguardando 1º contato há ${inteiras}h`
}
