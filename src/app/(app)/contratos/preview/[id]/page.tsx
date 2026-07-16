import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contratos, clientes } from '@/lib/db/schema'
import { montarVariaveisContrato } from '@/lib/contratos/variaveis'
import {
  montarSecoesContrato,
  montarBlocoAssinaturas,
  trechosDoParagrafo,
  tituloContrato,
} from '@/lib/contratos/template-trafego'
import { CopiarLinkBotao } from '@/components/contratos/copiar-link-botao'
import { BotaoImprimir } from './botao-imprimir'

// Preview INTERNO do contrato preenchido — rota autenticada (grupo (app)).
// Renderiza as mesmas seções do template usado no PDF enviado à Autentique.

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl space-y-3 rounded-xl border bg-background p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold">{titulo}</h1>
      <div className="text-sm text-muted-foreground">{children}</div>
      <Link href="/contratos" className="inline-flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Voltar para contratos
      </Link>
    </div>
  )
}

export default async function PreviewContratoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let contrato:
    | {
        id: string
        clienteNome: string
        dataInicio: string
        dataVencimento: string
        valorMensal: string
        duracaoMeses: number | null
        dadosContratante: unknown
        token: string | null
        servicos: unknown
      }
    | undefined
  const camposPreview = {
    id: contratos.id,
    clienteNome: clientes.nome,
    dataInicio: contratos.dataInicio,
    dataVencimento: contratos.dataVencimento,
    valorMensal: contratos.valorMensal,
    duracaoMeses: contratos.duracaoMeses,
    dadosContratante: contratos.dadosContratante,
    token: contratos.token,
  }
  try {
    try {
      const [row] = await db
        .select({ ...camposPreview, servicos: contratos.servicos })
        .from(contratos)
        .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
        .where(eq(contratos.id, id))
      contrato = row
    } catch (e0031) {
      // Migration 0031 pendente: preview segue como legado (servicos null).
      console.warn('[preview contrato] coluna servicos ausente (migration 0031 pendente?)', e0031)
      const [row] = await db
        .select(camposPreview)
        .from(contratos)
        .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
        .where(eq(contratos.id, id))
      contrato = row ? { ...row, servicos: null } : undefined
    }
  } catch (e) {
    // Degradação graciosa: colunas do fluxo ausentes (0029/0030 pendentes).
    console.warn('[preview contrato] colunas do fluxo ausentes?', e)
    return (
      <Aviso titulo="Preview indisponível">
        As migrations 0029/0030 ainda não foram aplicadas em produção — aplique-as para habilitar o
        preview do contrato.
      </Aviso>
    )
  }

  if (!contrato) {
    return <Aviso titulo="Contrato não encontrado">Este contrato não existe mais.</Aviso>
  }

  if (!contrato.dadosContratante) {
    return (
      <Aviso titulo="Aguardando os dados do contratante">
        <p>
          O contratante ainda não preencheu o formulário público. Copie o link e envie pelo
          WhatsApp:
        </p>
        {contrato.token ? (
          <div className="mt-2 flex justify-center">
            <CopiarLinkBotao token={contrato.token} />
          </div>
        ) : null}
      </Aviso>
    )
  }

  const vars = montarVariaveisContrato({
    contrato: {
      dataInicio: contrato.dataInicio,
      dataVencimento: contrato.dataVencimento,
      valorMensal: contrato.valorMensal,
      duracaoMeses: contrato.duracaoMeses,
      servicos: contrato.servicos,
    },
    dadosContratante: contrato.dadosContratante,
  })

  if ('error' in vars) {
    return <Aviso titulo="Não foi possível montar o contrato">{vars.error}</Aviso>
  }

  const secoes = montarSecoesContrato(vars.data)
  const assinaturas = montarBlocoAssinaturas(vars.data)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link
          href="/contratos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <BotaoImprimir />
      </div>

      <article className="rounded-xl border bg-white p-8 font-serif text-[15px] leading-7 text-neutral-900 shadow-sm sm:p-12 print:border-none print:p-0 print:shadow-none dark:border-neutral-700">
        <h1 className="mb-8 text-center text-lg font-bold">{tituloContrato(vars.data)}</h1>
        {secoes.map((secao, i) => (
          <section key={i} className="mb-4">
            {secao.titulo ? <h2 className="mb-2 mt-6 font-bold">{secao.titulo}</h2> : null}
            {secao.paragrafos.map((p, j) => (
              <p key={j} className="mb-2 text-justify">
                {trechosDoParagrafo(p).map((t, k) =>
                  t.negrito ? <strong key={k}>{t.texto}</strong> : t.texto
                )}
              </p>
            ))}
          </section>
        ))}
        {[assinaturas.contratante, assinaturas.contratado].map((parte) => (
          <section key={parte.rotulo} className="mb-6 mt-8">
            <p className="font-bold">{parte.rotulo}</p>
            <p>Neste ato representada por:</p>
            <p className="mt-8 font-bold">____________________________________________</p>
            <p>{parte.nome}</p>
            <p>{parte.documento}</p>
          </section>
        ))}
        <p className="mt-8 text-xs text-neutral-500 print:hidden">
          Preview interno — contrato de {contrato.clienteNome}. O PDF enviado para assinatura usa
          exatamente este texto.
        </p>
      </article>
    </div>
  )
}
