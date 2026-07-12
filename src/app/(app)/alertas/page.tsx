import { getAlertas } from '@/actions/alertas'

import { AlertasClient } from './alertas-client'

export default async function AlertasPage() {
  const alertas = await getAlertas()

  return <AlertasClient alertas={alertas} />
}
