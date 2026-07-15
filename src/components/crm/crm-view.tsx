'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, LayoutGrid, List, Search, Settings2, SlidersHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KpisCrm } from '@/components/crm/kpis-crm'
import { KanbanCrm } from '@/components/crm/kanban-crm'
import { BarraOrigemLeads } from '@/components/crm/barra-origem-leads'
import { NovaOportunidadeDialog } from '@/components/crm/nova-oportunidade-dialog'
import type { CrmVisaoGeral } from '@/lib/crm/dados'

// Orquestrador da /crm no formato do mockup: header + seletor de pipeline +
// abas de visao + busca. Os controles ainda sem backend (periodo, filtro,
// configuracao, Lista/Calendario) aparecem como placeholder HONESTO — visiveis
// mas inertes com title="Em breve", nunca com dado falso.

// Placeholder das visoes que ainda nao existem.
function VisaoEmConstrucao({ nome }: { nome: string }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <p className="text-sm font-medium">Visao em construcao</p>
      <p className="mt-1 text-sm text-muted-foreground">
        A visao de {nome} entra numa proxima entrega. Use o Kanban por enquanto.
      </p>
    </div>
  )
}

export function CrmView({ dados }: { dados: CrmVisaoGeral }) {
  const [busca, setBusca] = useState('')

  // Filtro CLIENT-SIDE sobre as oportunidades ja carregadas (titulo/contato/
  // empresa). Busca vazia => undefined => o kanban mostra tudo.
  const oportunidadesVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return undefined
    const ids = new Set<string>()
    for (const coluna of dados.colunas) {
      for (const o of coluna.oportunidades) {
        const alvo = `${o.titulo} ${o.contatoNome ?? ''} ${o.empresaNome ?? ''}`.toLowerCase()
        if (alvo.includes(termo)) ids.add(o.id)
      }
    }
    return ids
  }, [busca, dados.colunas])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seu pipeline de vendas e oportunidades
          </p>
        </div>
        {/* Periodo: inerte por ora (o recorte por data ainda nao existe). */}
        <Button
          type="button"
          variant="outline"
          className="cursor-not-allowed text-muted-foreground"
          title="Em breve"
        >
          <CalendarDays className="size-4" />
          Selecione um periodo
        </Button>
      </div>

      {/* Seletor de pipeline — o v1 tem um unico pipeline padrao. */}
      <div className="flex w-fit items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-[var(--shadow-sm)]">
        <span className="size-2 rounded-full bg-primary" />
        <span className="text-sm font-medium">{dados.pipelineNome}</span>
        <Badge variant="secondary" className="text-[10px]">
          Padrao
        </Badge>
        <ChevronDown className="size-4 text-muted-foreground/60" aria-hidden />
      </div>

      <Tabs defaultValue="kanban" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <NovaOportunidadeDialog etapas={dados.etapas} />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar oportunidades..."
                className="w-64 pl-8"
                aria-label="Buscar oportunidades"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="cursor-not-allowed text-muted-foreground"
              title="Em breve"
              aria-label="Filtros (em breve)"
            >
              <SlidersHorizontal className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="cursor-not-allowed text-muted-foreground"
              title="Em breve"
              aria-label="Configuracoes do pipeline (em breve)"
            >
              <Settings2 className="size-4" />
            </Button>
          </div>

          <TabsList>
            <TabsTrigger value="kanban">
              <LayoutGrid className="size-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="lista">
              <List className="size-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="calendario">
              <CalendarDays className="size-4" />
              Calendario
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="kanban" className="space-y-6">
          <KpisCrm kpis={dados.kpis} />
          <KanbanCrm
            colunas={dados.colunas}
            etapas={dados.etapas}
            oportunidadesVisiveis={oportunidadesVisiveis}
          />
          <BarraOrigemLeads origens={dados.origens} />
        </TabsContent>

        <TabsContent value="lista">
          <VisaoEmConstrucao nome="lista" />
        </TabsContent>

        <TabsContent value="calendario">
          <VisaoEmConstrucao nome="calendario" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
