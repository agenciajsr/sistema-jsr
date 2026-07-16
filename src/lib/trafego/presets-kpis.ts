// Presets de KPIs por classe de objetivo + resolução do estado inicial da grade.
// Módulo PURO (zero import de db/auth/react), no padrão de metricas.ts: actions e
// UI só consomem. Testável sem banco.
//
// O buraco que isto tampa (Etapa 3): antes, cliente sem preferência salva abria com
// as 24 métricas TODAS ligadas. Agora nasce com o preset do OBJETIVO dele.
// Regra de ouro: preferência salva SEMPRE vence o preset — o preset é só o ponto de
// partida de quem nunca organizou.

import { CATALOGO_METRICAS, type MetricaId } from './metricas'
import type { ClasseObjetivo } from './aggregate'

// Estrutura de uma métrica na grade (mesma forma de PreferenciaKpi em actions/trafego,
// importada como tipo lá; aqui evitamos o import para o módulo ficar 100% puro).
export type ItemGrade = { id: string; ativo: boolean }

/**
 * Ordem ativa de cada classe de objetivo. O RESTO do catálogo entra desligado no
 * fim (nada some do "Organizar" — só nasce desligado). Ajustado com o usuário em
 * 15/jul/2026 (segue a sugestão do handoff da Etapa 3).
 */
const PRESET_POR_CLASSE: Record<ClasseObjetivo, MetricaId[]> = {
  vendas: [
    'investimento',
    'valorEmCompras',
    'roas',
    'compras',
    'cpaMedio',
    'ticketMedio',
    'adicoesCarrinho',
    'ctrLink',
  ],
  leads: [
    'investimento',
    'leads',
    'custoPorLead',
    'cliquesNoLink',
    'ctrLink',
    'cpcLink',
    'visualizacoesLp',
  ],
  conversas: [
    'investimento',
    'conversas',
    'custoPorConversa',
    'cliquesNoLink',
    'ctrLink',
    'cpcLink',
    'impressoes',
  ],
  trafego: [
    'investimento',
    'cliquesNoLink',
    'cpcLink',
    'ctrLink',
    'impressoes',
    'alcance',
    'cpm',
    'visualizacoesLp',
  ],
  engajamento: [
    'investimento',
    'engajamento',
    'impressoes',
    'alcance',
    'cpm',
    'ctrTodos',
    'cliques',
  ],
}

/**
 * Grade inicial para um cliente SEM preferência salva, a partir da classe do
 * objetivo. As métricas do preset entram ligadas, na ordem; o restante do catálogo
 * entra desligado no fim. Classe `null` (objetivo não classificado) = fallback
 * honesto: catálogo inteiro, tudo ligado (comportamento antigo).
 */
export function presetsKpis(classe: ClasseObjetivo | null): ItemGrade[] {
  if (classe === null) {
    return CATALOGO_METRICAS.map((m) => ({ id: m.id, ativo: true }))
  }
  const ativos = PRESET_POR_CLASSE[classe]
  const ordem = new Set<string>(ativos)
  const grade: ItemGrade[] = ativos.map((id) => ({ id, ativo: true }))
  for (const m of CATALOGO_METRICAS) {
    if (!ordem.has(m.id)) grade.push({ id: m.id, ativo: false })
  }
  return grade
}

/**
 * Resolve a ordem/visibilidade final da grade.
 *
 * - COM preferência salva (e ao menos uma métrica ativa): as salvas mandam; métricas
 *   novas do catálogo (fora da preferência) entram no fim, ligadas. Preferência
 *   salva SEMPRE vence o preset.
 * - SEM preferência salva (null, vazia, ou salva mas com TUDO desligado): usa o
 *   preset da classe. O caso "tudo desligado" é o guard contra grade vazia (ex.:
 *   linhas contaminadas antes da correção de estado do React) — nunca renderiza
 *   uma grade em branco.
 */
export function resolverPreferencias(
  salvas: ItemGrade[] | null,
  classe: ClasseObjetivo | null,
): ItemGrade[] {
  const idsValidos = new Set(CATALOGO_METRICAS.map((m) => m.id as string))
  const base = (salvas ?? []).filter((p) => idsValidos.has(p.id))

  // Sem nada salvo OU salvo porém sem nenhuma métrica ativa -> preset da classe.
  if (base.length === 0 || !base.some((p) => p.ativo)) {
    return presetsKpis(classe)
  }

  const presentes = new Set(base.map((p) => p.id))
  for (const m of CATALOGO_METRICAS) {
    if (!presentes.has(m.id)) base.push({ id: m.id, ativo: true })
  }
  return base
}
