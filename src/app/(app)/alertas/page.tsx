import { listarAlertasPersistidos } from '@/actions/alertas'

import { AlertasClient } from './alertas-client'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

// Helper fora do componente: o relógio do request (Date.now() direto no
// render é sinalizado pela regra react-hooks/purity, mesmo no server).
async function timestampDoRequest(): Promise<number> {
  return Date.now()
}

export default async function AlertasPage() {
  const alertas = await listarAlertasPersistidos()
  const agora = await timestampDoRequest()

  return <AlertasClient alertas={alertas} agora={agora} />
}
