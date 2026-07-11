import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncMetaAds } from '@/lib/inngest/functions/sync-meta-ads'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncMetaAds],
})
