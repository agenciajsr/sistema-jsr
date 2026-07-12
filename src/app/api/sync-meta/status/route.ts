import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { campaignInsights } from '@/lib/db/schema'

/**
 * Retorna se a sync mais recente é posterior ao timestamp fornecido.
 * Usado pelo SyncButton para detectar quando a sync terminou.
 */
export async function GET(request: NextRequest) {
  const after = request.nextUrl.searchParams.get('after')

  if (!after) {
    return NextResponse.json({ done: false })
  }

  const [result] = await db
    .select({
      max: sql<string | null>`max(${campaignInsights.syncedAt})`,
      cnt: sql<number>`count(*)`,
    })
    .from(campaignInsights)

  const lastSync = result.max ? new Date(result.max) : null
  const afterDate = new Date(after)

  const done = lastSync ? lastSync > afterDate : false

  return NextResponse.json({
    done,
    lastSync: lastSync?.toISOString() ?? null,
    insights: result.cnt,
  })
}
