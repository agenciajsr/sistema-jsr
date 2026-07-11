---
phase: quick-260711-hik
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/insights/route.ts
  - src/components/dashboard/ai-insight-float.tsx
autonomous: true
requirements: [INSIGHTS-AUTO-01]

must_haves:
  truths:
    - "Ao abrir o dashboard, o card de Insights da IA busca texto gerado pela OpenAI via streaming"
    - "Durante a busca, o card exibe 'Analisando dados da agência...' no lugar do texto estático"
    - "Após o streaming completar, o card exibe o insight gerado pela IA"
    - "Sem OPENAI_API_KEY ou com erro/401, o card exibe aiInsightMock.texto sem quebrar"
    - "O visual do card permanece idêntico ao atual (dark, ring, gradiente)"
  artifacts:
    - path: "src/app/api/insights/route.ts"
      provides: "Rota GET que gera insight proativo via streamText + toTextStreamResponse"
      exports: ["GET"]
    - path: "src/components/dashboard/ai-insight-float.tsx"
      provides: "Card flutuante consumindo /api/insights via fetch + ReadableStream reader"
  key_links:
    - from: "src/components/dashboard/ai-insight-float.tsx"
      to: "/api/insights"
      via: "fetch em useEffect com reader de ReadableStream"
      pattern: "fetch.*api/insights"
    - from: "src/app/api/insights/route.ts"
      to: "buildSystemMessage() + streamText"
      via: "mensagem interna pedindo top 3 insights do dia"
      pattern: "streamText.*buildSystemMessage"
---

<objective>
Substituir o texto estático `aiInsightMock.texto` do card flutuante de IA por um insight gerado em tempo real via OpenAI, reutilizando a infraestrutura já existente (copilot.ts, AI SDK, padrão de streaming do /api/chat).

Purpose: Dar vida ao card de Insights da IA — hoje é decorativo (mock fixo). Com esta tarefa, ao abrir o dashboard a IA analisa o snapshot da agência e devolve os top 3 pontos que merecem atenção hoje.
Output: Rota `/api/insights` + componente `AiInsightFloat` atualizado com fetch streaming.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260711-hik-insights-automaticos-no-dashboard-via-ia/260711-hik-PLAN.md

<!-- Interfaces relevantes já existentes no projeto -->
<interfaces>
<!-- De src/lib/ai/copilot.ts -->
export const OPENAI_MODEL: string  // process.env.OPENAI_MODEL || 'gpt-4o-mini'
export function buildSystemMessage(): string  // persona + snapshot completo dos mocks

<!-- De src/app/api/chat/route.ts — padrão de rota a replicar -->
export const runtime = 'nodejs'
// Padrão: auth gate → sem chave → respostaTexto() graciosa → streamText + toTextStreamResponse()

<!-- De src/components/dashboard/ai-insight-float.tsx -->
// Usa: useState(true) para aberto, aiInsightMock.texto (linha 48) para o texto
// Visual: fixed bottom-6 right-6, bg-[#0b1a33], ring-1 ring-white/10 — NÃO alterar

<!-- De src/lib/mock/dashboard-ref.ts (usado indiretamente via copilot.ts) -->
export const aiInsightMock: { texto: string }  // fallback quando IA indisponível
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: Criar rota GET /api/insights</name>
  <files>src/app/api/insights/route.ts</files>
  <action>
Criar arquivo `src/app/api/insights/route.ts` seguindo EXATAMENTE o padrão do `/api/chat/route.ts`, com estas diferenças:

1. Exportar `GET` em vez de `POST` — não há body do usuário.
2. Auth gate igual: `getCurrentUser()` → 401 sem sessão.
3. Sem chave: retornar `respostaTexto()` com mensagem de fallback amigável em pt-BR (mesma lógica do /api/chat).
4. Com chave: chamar `streamText` com:
   - `model: openai(OPENAI_MODEL)`
   - `system: buildSystemMessage()`
   - `messages`: array com UMA mensagem `user` interna (não vem do client):
     ```
     "Analise o snapshot da agência e liste os top 3 insights mais prioritários para hoje. Seja direto e prático — máximo 3 parágrafos curtos, sem títulos, sem markdown complexo."
     ```
5. Retornar `result.toTextStreamResponse()`.
6. Try/catch igual ao /api/chat: erro → `respostaTexto()` com mensagem amigável.
7. `export const runtime = 'nodejs'` no topo.

Imports necessários (mesmos do /api/chat):
```typescript
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { getCurrentUser } from '@/lib/auth/session'
import { OPENAI_MODEL, buildSystemMessage } from '@/lib/ai/copilot'
```

A função `respostaTexto` pode ser copiada do /api/chat (helper local, não exportado).
  </action>
  <verify>
    <automated>cd "C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Arquivo existe, compila sem erros de tipo, exporta GET com runtime nodejs.</done>
</task>

<task type="auto">
  <name>Tarefa 2: Atualizar AiInsightFloat com fetch streaming</name>
  <files>src/components/dashboard/ai-insight-float.tsx</files>
  <action>
Atualizar `src/components/dashboard/ai-insight-float.tsx` adicionando fetch de streaming. Manter TUDO do visual atual inalterado.

Mudanças de estado:
```typescript
const [texto, setTexto] = useState<string>('')
const [carregando, setCarregando] = useState(true)
```
(remover dependência de `aiInsightMock` para o texto principal — manter o import apenas para o fallback)

Adicionar `useEffect` ao montar o componente:
```typescript
useEffect(() => {
  let cancelado = false

  async function buscarInsight() {
    try {
      const res = await fetch('/api/insights')
      if (!res.ok || !res.body) {
        // Fallback silencioso: usar mock
        if (!cancelado) {
          setTexto(aiInsightMock.texto)
          setCarregando(false)
        }
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        if (!cancelado) setTexto(acumulado)
      }
      if (!cancelado) setCarregando(false)
    } catch {
      // Erro de rede — fallback silencioso
      if (!cancelado) {
        setTexto(aiInsightMock.texto)
        setCarregando(false)
      }
    }
  }

  void buscarInsight()
  return () => { cancelado = true }
}, [])
```

No JSX, substituir `{aiInsightMock.texto}` (linha 48) por:
```tsx
{carregando ? (
  <span className="italic text-white/50">Analisando dados da agência...</span>
) : (
  texto
)}
```

O botão "Ver análise completa" deve navegar para `/chat-ia`. Adicionar import `Link` do Next.js e envolver o `<Button>` com `<Link href="/chat-ia">`, ou adicionar `onClick={() => router.push('/chat-ia')}` com `useRouter` — usar o padrão já existente no componente (se Button não tiver href nativo, usar Link wrapper).

Visual do card: NENHUMA alteração nas classes CSS, estrutura do div, gradiente, ring, ícone Brain, badge Beta, botão fechar.
  </action>
  <verify>
    <automated>cd "C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Componente compila sem erros; ao carregar o dashboard com OPENAI_API_KEY configurada o card exibe "Analisando..." e depois o texto da IA; sem chave exibe aiInsightMock.texto.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passa sem erros nos dois arquivos modificados.
2. `src/app/api/insights/route.ts` exporta `GET` e `runtime = 'nodejs'`.
3. `src/components/dashboard/ai-insight-float.tsx` não referencia `aiInsightMock.texto` diretamente no JSX (apenas no fallback dentro do useEffect).
4. Visual do card idêntico ao original: mesmas classes, mesmo gradiente, mesmo ícone, mesmo badge.
</verification>

<success_criteria>
- Rota GET /api/insights existe e segue padrão auth-gate + degradação graciosa + streamText do /api/chat
- AiInsightFloat busca /api/insights via useEffect com reader de ReadableStream
- Estado de loading exibe "Analisando dados da agência..." em itálico esmaecido
- Fallback silencioso (401, erro, sem chave) exibe aiInsightMock.texto sem crash
- Visual do card dark inalterado
- Zero novas dependências npm adicionadas
- OPENAI_API_KEY nunca exposta ao client
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260711-hik-insights-automaticos-no-dashboard-via-ia/260711-hik-SUMMARY.md`
</output>
