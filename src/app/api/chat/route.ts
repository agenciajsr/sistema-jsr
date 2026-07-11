// Route Handler do Copilot (Chat com IA). App Router, runtime Node.js.
//
// Segurança:
// - A chave da OpenAI é lida SOMENTE de process.env no servidor. NUNCA
//   NEXT_PUBLIC, NUNCA hardcoded.
// - Auth gate: 401 antes de qualquer chamada à OpenAI (evita custo indevido).
// - Sem chave configurada: responde graciosamente com uma mensagem-guia em
//   pt-BR (stream de texto), NUNCA erro 500.
//
// O client (src/app/(app)/chat-ia/page.tsx) consome a resposta como um stream
// de texto simples (toTextStreamResponse), por isso as respostas de fallback
// também são streams de texto — a bolha do assistente aparece igual em todos os
// casos.

import { openai } from '@ai-sdk/openai'
import { streamText, type ModelMessage } from 'ai'

import { getCurrentUser } from '@/lib/auth/session'
import { OPENAI_MODEL, buildSystemMessage } from '@/lib/ai/copilot'

export const runtime = 'nodejs'

// Mensagens cruas vindas do client (formato simplificado role/content).
type MensagemBruta = { role?: unknown; content?: unknown }

// Resposta de texto simples (usada nos fallbacks sem-chave e de erro).
function respostaTexto(texto: string): Response {
  return new Response(texto, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(req: Request): Promise<Response> {
  // 1. AUTH GATE — antes de qualquer chamada à OpenAI.
  const user = await getCurrentUser()
  if (!user) {
    return new Response('Não autorizado', { status: 401 })
  }

  // 2. Ler as mensagens do corpo.
  let mensagensBrutas: MensagemBruta[] = []
  try {
    const body = (await req.json()) as { messages?: unknown }
    if (Array.isArray(body?.messages)) {
      mensagensBrutas = body.messages as MensagemBruta[]
    }
  } catch {
    // Corpo inválido — segue com lista vazia (streamText tratará como sem input).
  }

  // 3. TRATAMENTO SEM CHAVE — degradação graciosa, nunca 500.
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    return respostaTexto(
      'A integração de IA ainda não foi configurada. Para ativar o Copilot, ' +
        'adicione a variável OPENAI_API_KEY no arquivo .env.local e reinicie o ' +
        'servidor. Enquanto isso, o restante do sistema segue funcionando ' +
        'normalmente com os dados de exemplo.',
    )
  }

  // Converte para o formato tipado do AI SDK (apenas user/assistant).
  const messages: ModelMessage[] = mensagensBrutas
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) =>
      m.role === 'user'
        ? { role: 'user' as const, content: String(m.content ?? '') }
        : { role: 'assistant' as const, content: String(m.content ?? '') },
    )

  // 4. COM CHAVE — streaming da OpenAI com persona + snapshot.
  try {
    const result = streamText({
      model: openai(OPENAI_MODEL),
      system: buildSystemMessage(),
      messages,
    })
    // Stream de texto simples, consumido pelo client via fetch + reader.
    return result.toTextStreamResponse()
  } catch {
    // 5. Erro (rede/limite/chave inválida) — resposta amigável, sem vazar
    //    detalhes internos e sem estourar 500 cru.
    return respostaTexto(
      'Não consegui gerar a resposta agora. Verifique se a OPENAI_API_KEY é ' +
        'válida e tente novamente em instantes.',
    )
  }
}
