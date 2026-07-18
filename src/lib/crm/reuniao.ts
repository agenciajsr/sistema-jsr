// Helper PURO de detecção da etapa "Reunião agendada" no pipeline do CRM.
// As etapas são linhas de crm_etapas sem chave semântica — a única pista é o
// NOME. Comparação exata após normalizar (acentos, caixa, espaços), para que
// "Reunião realizada" ou "Proposta enviada" nunca disparem o modal.
// Módulo puro: zero imports de db/react/auth.

/** Remove diacríticos (NFD + faixa de combinantes), apara espaços e baixa a caixa. */
function normalizar(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** true somente quando o nome da etapa é "Reunião agendada" (tolerante a acento/caixa/espaços). */
export function ehEtapaReuniaoAgendada(nome: string): boolean {
  return normalizar(nome) === 'reuniao agendada'
}

/**
 * Monta o instante UTC de uma data+hora escolhidas no fuso de Brasília.
 * O offset -03:00 é FIXO e explícito: sem ele, `new Date('YYYY-MM-DDTHH:MM')`
 * usa o fuso do processo — na Vercel (UTC) gravava a reunião 3h adiantada.
 * Mesmo offset que o evento do Google Calendar já usa.
 */
export function montarInstanteBrasilia(data: string, hora: string): Date {
  return new Date(`${data}T${hora}:00-03:00`)
}
