import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { relatorioConfigs, relatorios } from '@/lib/db/schema'
import { gerarRelatorioDeConfig } from '@/lib/relatorios/gerar-relatorio-config'
import { devidoHoje } from '@/lib/relatorios/engine'
import { hojeBrasilia } from '@/lib/date-br'

// Rota chamada pelo Vercel Cron (GET) TODO DIA 10h UTC (07h Brasília).
// Gera os relatórios DEVIDOS HOJE: configs semanais no dia da semana configurado,
// mensais no dia do mês (com grampeamento de fim de mês). Sem sessão de usuário —
// a proteção é feita por CRON_SECRET (Authorization: Bearer).
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 })
    }
  } else {
    console.warn('[cron/relatorios] CRON_SECRET não configurado — rota desprotegida.')
  }

  try {
    const hoje = hojeBrasilia()

    const configs = await db
      .select()
      .from(relatorioConfigs)
      .where(eq(relatorioConfigs.ativo, true))

    const devidas = configs.filter((c) =>
      devidoHoje(
        {
          frequencia: c.frequencia as 'semanal' | 'mensal',
          diaSemana: c.diaSemana,
          diaMes: c.diaMes,
          ativo: c.ativo,
        },
        hoje,
      ),
    )

    let gerados = 0
    let semDados = 0
    let erros = 0

    // Erro em uma config NÃO interrompe as demais.
    for (const config of devidas) {
      try {
        const relatorio = await gerarRelatorioDeConfig(config.id, hoje)
        if (relatorio) {
          await db.insert(relatorios).values({
            clienteId: relatorio.clienteId,
            clienteNome: relatorio.clienteNome,
            tipo: 'automatico',
            periodoInicio: relatorio.periodo.inicio,
            periodoFim: relatorio.periodo.fim,
            conteudo: relatorio.texto,
            configId: config.id,
          })
          gerados++
        } else {
          semDados++
        }
      } catch (erroConfig) {
        erros++
        console.error(`[cron/relatorios] falha na config "${config.nome}":`, erroConfig)
      }
    }

    return NextResponse.json({
      ok: true,
      hoje,
      devidas: devidas.length,
      gerados,
      semDados,
      erros,
    })
  } catch (err) {
    console.error('[cron/relatorios] Erro:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}
