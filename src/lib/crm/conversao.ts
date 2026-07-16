// Conversão Ganho → Cliente (Fase 3 do funil da agência) — lógica PURA.
// Zero import de db/auth/react: a action converterOportunidadeEmCliente
// (src/actions/crm.ts) busca contato/empresa no banco e delega a DECISÃO aqui.
//
// O CRM é LEAD-FIRST: a maioria das oportunidades tem só contato (sem empresa),
// então tanto a detecção de cliente existente quanto a montagem do payload
// precisam funcionar com contato sozinho.

export type ContatoConversao = {
  nome: string
  telefone: string | null
  email: string | null
  // Preenchido quando o lead já virou cliente antes (idempotência).
  clienteId: string | null
}

export type EmpresaConversao = {
  nome: string
  clienteId: string | null
}

export type DadosClienteNovo = {
  nome: string
  status: 'aguardando_inicio'
  nicho: 'negocio_local'
  contatoNome: string | null
  contatoTelefone: string | null
  contatoEmail: string | null
}

/**
 * Cliente já existente para este lead? Prioridade: contato.clienteId (o lead
 * em si já converteu) e só depois empresa.clienteId (a empresa já é cliente).
 * Retorna o id existente ou null (pode criar um novo).
 */
export function clienteExistenteDe({
  contato,
  empresa,
}: {
  contato?: ContatoConversao | null
  empresa?: EmpresaConversao | null
}): string | null {
  return contato?.clienteId ?? empresa?.clienteId ?? null
}

/**
 * Payload do cliente novo a partir do lead ganho: nome vem da empresa quando
 * houver (senão do contato); os campos de contato vêm sempre do contato.
 * Defaults do v1: entra como 'aguardando_inicio' (onboarding) e nicho
 * 'negocio_local' — ajustados depois na ficha do cliente.
 * Retorna null quando não há contato nem empresa (conversão inválida).
 */
export function dadosClienteDe({
  contato,
  empresa,
}: {
  contato?: ContatoConversao | null
  empresa?: EmpresaConversao | null
}): DadosClienteNovo | null {
  const nome = empresa?.nome ?? contato?.nome
  if (!nome) return null

  return {
    nome,
    status: 'aguardando_inicio',
    nicho: 'negocio_local',
    contatoNome: contato?.nome ?? null,
    contatoTelefone: contato?.telefone ?? null,
    contatoEmail: contato?.email ?? null,
  }
}
