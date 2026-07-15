import { cache } from 'react'

import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'

// v1 SINGLE-TENANT: existe UMA linha em `workspaces` (seed da migration 0019).
// Multi-tenant no futuro = trocar SÓ este helper (resolver por sessão/domínio);
// actions e páginas já recebem o workspace daqui.
//
// cache() do React: dedupe dentro do MESMO render de requisição (mesmo motivo
// do getCurrentUser) — várias actions/queries na mesma página fazem 1 SELECT só.
export const getWorkspaceAtual = cache(async () => {
  try {
    const [ws] = await db.select().from(workspaces).limit(1)
    return ws ?? null
  } catch (e) {
    // Migration 0019 ainda não aplicada (relation does not exist) ou soluço de
    // conexão: devolve null para a página/action degradar graciosamente com a
    // mensagem 'Aplique a migration 0019' em vez de estourar a tela.
    console.error('[getWorkspaceAtual]', e)
    return null
  }
})
