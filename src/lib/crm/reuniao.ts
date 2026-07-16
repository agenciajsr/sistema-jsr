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
