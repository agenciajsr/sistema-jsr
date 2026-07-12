import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncMetaAds } from '@/lib/inngest/functions/sync-meta-ads'
import { gerarRelatoriosSemanais } from '@/lib/inngest/functions/gerar-relatorios-semanais'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncMetaAds, gerarRelatoriosSemanais],
})
