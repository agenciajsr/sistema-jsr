// Detecção de "lead novo" na /crm (quick 260717-pvr) — módulo PURO (zero
// import de react/db), no padrão de src/lib/crm/origem.ts.
//
// O CrmView guarda os ids das oportunidades do render anterior num ref e, a
// cada novo `dados` vindo do servidor (router.refresh do polling), pergunta
// aqui o que APARECEU. Remoções (ganho/perdido some do board) nunca são
// novidade. `idsAnteriores === null` sinaliza a PRIMEIRA carga: nada é
// novidade — senão a carga inicial dispararia um toast por card.

export type OportunidadeNovidade = {
  id: string
  titulo: string
  contatoNome: string | null
}

export function detectarNovasOportunidades(
  idsAnteriores: Set<string> | null,
  atuais: OportunidadeNovidade[],
): OportunidadeNovidade[] {
  if (idsAnteriores === null) return []
  return atuais.filter((o) => !idsAnteriores.has(o.id))
}

// Rótulo do toast "Novo lead: ..." — nome do contato quando existir (o que a
// equipe reconhece), senão o título do negócio.
export function rotuloNovidade(o: OportunidadeNovidade): string {
  const nome = o.contatoNome?.trim()
  return nome ? nome : o.titulo
}
