import Image from 'next/image'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contratos, clientes } from '@/lib/db/schema'
import { rotuloServico } from '@/lib/crm/servicos'
import { FormularioContratante } from './formulario-contratante'

// ⚠️ ROTA PÚBLICA de propósito: fica FORA do grupo (app), então NÃO passa pelo
// gate de login do (app)/layout.tsx. O cliente da agência abre este link no
// celular (via WhatsApp) para preencher os dados do contrato. A segurança é o
// token imprevisível (256 bits, unique).

// Backstop contra o timeout de 300s da Vercel (padrão das páginas do app).
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function TelaErro() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 text-center shadow-sm">
        <Image src="/logo-jsr.png" alt="JSR" width={96} height={40} className="mx-auto h-10 w-auto" />
        <h1 className="text-lg font-semibold">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground">
          Este link de contrato não está mais disponível. Fale com a equipe JSR para receber um novo
          link.
        </p>
      </div>
    </main>
  )
}

export default async function ContratoPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!token) return <TelaErro />

  // Query única (join do cliente) — sequencial, nada de Promise.all.
  let contrato:
    | {
        id: string
        statusFluxo: string | null
        servico: string | null
        duracaoMeses: number | null
        dadosContratante: unknown
        clienteNome: string | null
        contatoNome: string | null
        contatoEmail: string | null
        contatoTelefone: string | null
      }
    | undefined
  try {
    const [row] = await db
      .select({
        id: contratos.id,
        statusFluxo: contratos.statusFluxo,
        servico: contratos.servico,
        duracaoMeses: contratos.duracaoMeses,
        dadosContratante: contratos.dadosContratante,
        clienteNome: clientes.nome,
        contatoNome: clientes.contatoNome,
        contatoEmail: clientes.contatoEmail,
        contatoTelefone: clientes.contatoTelefone,
      })
      .from(contratos)
      .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
      .where(eq(contratos.token, token))
    contrato = row
  } catch (e) {
    // Migration 0029 pendente ou banco fora: nunca vazar erro técnico.
    console.error('[ContratoPublicoPage]', e)
    return <TelaErro />
  }

  // Token inexistente ou contrato fora do fluxo (legado) → erro amigável.
  if (!contrato || !contrato.statusFluxo) return <TelaErro />

  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="space-y-2 text-center">
          <Image
            src="/logo-jsr.png"
            alt="JSR"
            width={112}
            height={48}
            className="mx-auto h-12 w-auto"
          />
          <h1 className="text-xl font-semibold tracking-tight">Dados para o contrato</h1>
          <p className="text-sm text-muted-foreground">
            {contrato.clienteNome ? `${contrato.clienteNome} — ` : ''}
            {rotuloServico(contrato.servico)}
            {contrato.duracaoMeses ? ` · ${contrato.duracaoMeses} meses` : ''}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-4 shadow-sm sm:p-6">
          <FormularioContratante
            token={token}
            preenchido={{
              nome: contrato.contatoNome ?? contrato.clienteNome ?? '',
              email: contrato.contatoEmail ?? '',
              telefone: contrato.contatoTelefone ?? '',
            }}
            dadosAnteriores={contrato.dadosContratante ?? null}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Seus dados são usados apenas para a elaboração do contrato com a Agência JSR.
        </p>
      </div>
    </main>
  )
}
