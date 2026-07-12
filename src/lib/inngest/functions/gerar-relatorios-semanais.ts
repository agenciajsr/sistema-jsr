import { eq, and } from 'drizzle-orm'

import { inngest } from '../client'
import { db } from '@/lib/db'
import { clientes, adAccounts } from '@/lib/db/schema'
import { gerarRelatorioCliente } from '@/lib/relatorios/gerar-relatorio'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'

/**
 * Gera relatórios semanais automaticamente toda segunda-feira às 7h (Brasília).
 * Assim os dados de domingo já estão completos e o relatório fica pronto
 * para revisão logo no início do dia.
 *
 * Também pode ser disparado manualmente via evento 'relatorios/gerar.requested'.
 */
export const gerarRelatoriosSemanais = inngest.createFunction(
  {
    id: 'gerar-relatorios-semanais',
    name: 'Gerar Relatórios Semanais',
    triggers: [
      { cron: 'TZ=America/Sao_Paulo 0 7 * * 1' }, // Segunda-feira 7h
      { event: 'relatorios/gerar.requested' },
    ],
  },
  async ({ step, event }: { step: any; event: any }) => {
    // Determinar período (última semana: segunda → domingo)
    const hoje = hojeBrasilia()
    const dataFim = hoje // domingo (hoje)
    const dataInicio = dataMenosDias(6, hoje) // segunda passada

    // Listar clientes com contas Meta ativas
    const clientesAtivos = await step.run('listar-clientes', async () => {
      const rows = await db
        .select({ id: clientes.id, nome: clientes.nome })
        .from(clientes)
        .where(eq(clientes.status, 'ativo'))

      const resultado: { id: string; nome: string }[] = []
      for (const row of rows) {
        const contas = await db
          .select({ id: adAccounts.id })
          .from(adAccounts)
          .where(
            and(
              eq(adAccounts.clienteId, row.id),
              eq(adAccounts.plataforma, 'meta'),
              eq(adAccounts.ativo, true),
            ),
          )
        if (contas.length > 0) {
          resultado.push(row)
        }
      }
      return resultado
    })

    // Gerar relatório para cada cliente
    const resultados: { clienteId: string; clienteNome: string; status: 'ok' | 'sem_dados' | 'erro' }[] = []

    for (const cliente of clientesAtivos) {
      const result = await step.run(`gerar-${cliente.id}`, async () => {
        try {
          const relatorio = await gerarRelatorioCliente(cliente.id, dataInicio, dataFim)
          if (relatorio) {
            return { clienteId: cliente.id, clienteNome: cliente.nome, status: 'ok' as const }
          }
          return { clienteId: cliente.id, clienteNome: cliente.nome, status: 'sem_dados' as const }
        } catch {
          return { clienteId: cliente.id, clienteNome: cliente.nome, status: 'erro' as const }
        }
      })
      resultados.push(result)
    }

    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      total: clientesAtivos.length,
      gerados: resultados.filter((r) => r.status === 'ok').length,
      semDados: resultados.filter((r) => r.status === 'sem_dados').length,
      erros: resultados.filter((r) => r.status === 'erro').length,
      detalhes: resultados,
    }
  },
)
