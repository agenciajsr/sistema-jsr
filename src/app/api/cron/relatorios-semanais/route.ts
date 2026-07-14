import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientes, adAccounts, relatorios } from '@/lib/db/schema'
import { gerarRelatorioCliente } from '@/lib/relatorios/gerar-relatorio'
import { dataMenosDias } from '@/lib/date-br'

// Rota chamada pelo Vercel Cron (GET) toda segunda-feira 10h UTC (07h Brasília).
// Gera o relatório da SEMANA ANTERIOR (segunda → domingo) de cada cliente ativo
// com conta Meta e grava o histórico na tabela relatorios. Sem sessão de usuário —
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
    console.warn('[cron/relatorios-semanais] CRON_SECRET não configurado — rota desprotegida.')
  }

  try {
    // Período: semana anterior. Rodando segunda 07h BR, ontem = domingo e
    // 7 dias atrás = segunda passada (mesmos defaults de gerarRelatorioCliente,
    // passados explicitamente para clareza).
    const periodoFim = dataMenosDias(1) // domingo
    const periodoInicio = dataMenosDias(7) // segunda passada

    // Clientes ativos com pelo menos uma conta Meta ativa (consulta direta ao
    // banco — NÃO usar listarClientesRelatorio, que exige sessão de usuário).
    const clientesAtivos = await db
      .select({ id: clientes.id, nome: clientes.nome })
      .from(clientes)
      .where(eq(clientes.status, 'ativo'))

    const candidatos: { id: string; nome: string }[] = []
    for (const cliente of clientesAtivos) {
      const contas = await db
        .select({ id: adAccounts.id })
        .from(adAccounts)
        .where(
          and(
            eq(adAccounts.clienteId, cliente.id),
            eq(adAccounts.plataforma, 'meta'),
            eq(adAccounts.ativo, true),
          ),
        )
      if (contas.length > 0) candidatos.push(cliente)
    }

    let gerados = 0
    let semDados = 0
    let erros = 0

    // Erro em um cliente NÃO interrompe os demais (try/catch próprio por cliente).
    for (const cliente of candidatos) {
      try {
        const relatorio = await gerarRelatorioCliente(cliente.id, periodoInicio, periodoFim)
        if (relatorio) {
          await db.insert(relatorios).values({
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            tipo: 'semanal',
            periodoInicio: relatorio.periodoInicio,
            periodoFim: relatorio.periodoFim,
            conteudo: relatorio.textoWhatsapp,
          })
          gerados++
        } else {
          semDados++
        }
      } catch (erroCliente) {
        erros++
        console.error(`[cron/relatorios-semanais] falha ao gerar relatório do cliente ${cliente.nome}:`, erroCliente)
      }
    }

    return NextResponse.json({
      ok: true,
      periodo: { inicio: periodoInicio, fim: periodoFim },
      total: candidatos.length,
      gerados,
      semDados,
      erros,
    })
  } catch (err) {
    console.error('[cron/relatorios-semanais] Erro:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}
