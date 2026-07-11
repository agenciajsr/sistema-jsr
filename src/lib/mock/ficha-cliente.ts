// Helper server-safe (sem 'use client', sem hooks) que compila os dados de
// exemplo da Ficha do Cliente casando pelo NOME do cliente. NUNCA quebra quando
// o nome não existe no mock: retorna arrays vazios / undefined tratados e uma
// cobrança derivada em estado neutro. A persistência real (Asaas, checklist,
// acompanhamento) é um incremento funcional FUTURO — aqui é apenas visual.

import {
  clientesTrafegoMock,
  financeiroMock,
  type ClienteTrafego,
  type FinanceiroClienteMock,
} from '@/lib/mock/dashboard'
import {
  acompanhamentoMock,
  checklistMock,
  type AcompanhamentoMock,
  type ChecklistItemMock,
} from '@/lib/mock/extra'

// LOCKED: controle manual de cobrança, sem banco neste incremento.
export type CobrancaMock = {
  usaAsaas: boolean
  diaCobranca: number | null
  status: 'pago' | 'pendente' | 'vencido'
}

export type MockDaFicha = {
  trafego: ClienteTrafego | undefined
  financeiro: FinanceiroClienteMock | undefined
  checklist: ChecklistItemMock[]
  acompanhamento: AcompanhamentoMock[]
  cobranca: CobrancaMock
}

export function getMockDaFicha(nomeCliente: string): MockDaFicha {
  const trafego = clientesTrafegoMock.find((c) => c.nome === nomeCliente)
  const financeiro = financeiroMock.find((f) => f.cliente === nomeCliente)
  const checklist = checklistMock.filter((i) => i.cliente === nomeCliente)
  const acompanhamento = acompanhamentoMock.filter((a) => a.cliente === nomeCliente)

  // Cobrança DERIVADA (mock/visual). Se há financeiro para o cliente, assume
  // que ele usa Asaas e mapeia o status financeiro em um status de cobrança;
  // caso contrário, estado neutro (não usa Asaas, sem dia, pendente).
  const cobranca: CobrancaMock = financeiro
    ? {
        usaAsaas: true,
        diaCobranca: financeiro.diaCobranca,
        status: financeiro.status === 'próximo' ? 'pendente' : 'pago',
      }
    : {
        usaAsaas: false,
        diaCobranca: null,
        status: 'pendente',
      }

  return { trafego, financeiro, checklist, acompanhamento, cobranca }
}
