import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncMetaAds } from '@/lib/inngest/functions/sync-meta-ads'

// A função de relatórios semanais foi aposentada daqui: o Inngest nunca rodou
// em produção — os relatórios agora saem do Vercel Cron
// (/api/cron/relatorios-semanais, segunda 07h Brasília).
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncMetaAds],
})
