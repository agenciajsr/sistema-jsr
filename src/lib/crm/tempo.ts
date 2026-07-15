import {
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
} from 'date-fns'

// Rotulo CURTO de tempo relativo em pt-BR (agora / 5min / 3h / 15d / 2m / 2a).
// Usado nos cards do CRM para mostrar ha quanto tempo a oportunidade existe.
// `agora` e injetavel para permitir testes deterministicos (sem depender do relogio).
export function tempoRelativoCurto(date: Date | string, agora: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date

  const segundos = differenceInSeconds(agora, d)
  if (segundos < 60) return 'agora'

  const minutos = differenceInMinutes(agora, d)
  if (minutos < 60) return `${minutos}min`

  const horas = differenceInHours(agora, d)
  if (horas < 24) return `${horas}h`

  const dias = differenceInDays(agora, d)
  if (dias < 30) return `${dias}d`

  const meses = differenceInMonths(agora, d)
  if (meses < 12) return `${meses}m` // m = meses

  const anos = differenceInYears(agora, d)
  return `${anos}a` // a = anos
}
