'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/lib/auth/session'
import {
  ehChaveAutomacao,
  getAutomacoes as lerAutomacoes,
  salvarAutomacao as gravarAutomacao,
  type ConfigAutomacao,
} from '@/lib/crm/automacoes'

export async function getAutomacoes() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessao expirada. Faca login novamente.' }
  try {
    return { data: await lerAutomacoes() }
  } catch (e) {
    console.error('[getAutomacoes]', e)
    return { error: 'Nao foi possivel carregar as automacoes (migration 0027 aplicada?).' }
  }
}

export async function salvarAutomacao(chave: string, ativo: boolean, config: ConfigAutomacao) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessao expirada. Faca login novamente.' }
  if (!ehChaveAutomacao(chave)) return { error: 'Automacao desconhecida.' }
  try {
    await gravarAutomacao(chave, ativo, {
      token: config.token?.trim() || undefined,
      numeros: config.numeros?.trim() || undefined,
      mensagem: config.mensagem?.trim() || undefined,
    })
    revalidatePath('/ferramentas')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[salvarAutomacao]', e)
    return { error: 'Nao foi possivel salvar a automacao.' }
  }
}
