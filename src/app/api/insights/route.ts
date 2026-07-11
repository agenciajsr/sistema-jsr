// Route Handler de Insights proativos da IA. App Router, runtime Node.js.
//
// Segurança:
// - A chave da OpenAI é lida SOMENTE de process.env no servidor. NUNCA
//   NEXT_PUBLIC, NUNCA hardcoded.
// - Auth gate: 401 antes de qualquer chamada à OpenAI (evita custo indevido).
// - Sem chave configurada: responde graciosamente com mensagem-guia em
//   pt-BR (stream de texto), NUNCA erro 500.
//
// O client (src/components/dashboard/ai-insight-float.tsx) consome a resposta
// como um stream de texto simples (toTextStreamResponse), via fetch + reader.
// As respostas de fallback também são streams de texto — o card renderiza igual
// em todos os casos.

import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

import { getCurrentUser } from '@/lib/auth/session'
import { OPENAI_MODEL, buildSystemMessage } from '@/lib/ai/copilot'

export const runtime = 'nodejs'

// Resposta de texto simples (usada nos fallbacks sem-chave e de erro).
function respostaTexto(texto: string): Response {
  return new Response(texto, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function GET(): Promise<Response> {
  // 1. AUTH GATE — antes de qualquer chamada à OpenAI.
  const user = await getCurrentUser()
  if (!user) {
    return new Response('Não autorizado', { status: 401 })
  }

  // 2. TRATAMENTO SEM CHAVE — degradação graciosa, nunca 500.
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    return respostaTexto(
      'A integração de IA ainda não foi configurada. Para ativar os insights ' +
        'automáticos, adicione a variável OPENAI_API_KEY no arquivo .env.local ' +
        'e reinicie o servidor.',
    )
  }

  // 3. COM CHAVE — streaming da OpenAI com persona + snapshot + prompt interno.
  try {
    const result = streamText({
      model: openai(OPENAI_MODEL),
      system: buildSystemMessage(),
      messages: [
        {
          role: 'user',
          content:
            'Analise o snapshot da agência e liste os top 3 insights mais prioritários para hoje. Seja direto e prático — máximo 3 parágrafos curtos, sem títulos, sem markdown complexo.',
        },
      ],
    })
    // Stream de texto simples, consumido pelo client via fetch + reader.
    return result.toTextStreamResponse()
  } catch {
    // 4. Erro (rede/limite/chave inválida) — resposta amigável, sem vazar
    //    detalhes internos e sem estourar 500 cru.
    return respostaTexto(
      'Não foi possível gerar os insights agora. Verifique se a OPENAI_API_KEY ' +
        'é válida e tente novamente em instantes.',
    )
  }
}
