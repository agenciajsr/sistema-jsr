import { describe, it, expect } from 'vitest'

import {
  agruparPorStatus,
  estatisticasDoQuadro,
  percentualConclusao,
  progressoChecklist,
  codigoTarefa,
  iniciais,
  corDoAvatar,
  agruparChecklist,
  filtrarTarefas,
  intervaloPadrao,
  formatarIntervalo,
  tempoRelativo,
  formatarTamanho,
  tipoDeArquivo,
  textoAtividade,
  corDaEtiqueta,
  COLUNAS_ORDEM,
} from './quadro'
import type { TarefaStatus, TarefaPrioridade } from './recorrencia'

// Helpers de fixture — só os campos que cada função realmente lê.
function t<E extends Record<string, unknown>>(status: TarefaStatus, extra?: E) {
  return { status, ...(extra ?? ({} as E)) }
}

function lista(counts: Record<TarefaStatus, number>) {
  const out: { status: TarefaStatus }[] = []
  for (const s of COLUNAS_ORDEM) {
    for (let i = 0; i < counts[s]; i++) out.push({ status: s })
  }
  return out
}

describe('agruparPorStatus', () => {
  it('devolve as 4 chaves SEMPRE, mesmo com entrada vazia', () => {
    // A coluna vazia precisa renderizar — nunca pode virar undefined.
    expect(agruparPorStatus([])).toEqual({
      a_fazer: [],
      em_andamento: [],
      concluida: [],
      nao_realizada: [],
    })
  })

  it('distribui cada tarefa na chave do seu status', () => {
    const dados = [t('a_fazer'), t('concluida'), t('em_andamento'), t('nao_realizada')]
    const r = agruparPorStatus(dados)
    expect(r.a_fazer).toHaveLength(1)
    expect(r.em_andamento).toHaveLength(1)
    expect(r.concluida).toHaveLength(1)
    expect(r.nao_realizada).toHaveLength(1)
  })

  it('preserva a ordem de entrada dentro de cada coluna', () => {
    const dados = [
      t('a_fazer', { id: 'a' }),
      t('a_fazer', { id: 'b' }),
      t('concluida', { id: 'c' }),
      t('a_fazer', { id: 'd' }),
    ]
    expect(agruparPorStatus(dados).a_fazer.map((x) => x.id)).toEqual(['a', 'b', 'd'])
  })
})

describe('estatisticasDoQuadro', () => {
  it('devolve zeros para lista vazia — nunca NaN', () => {
    const r = estatisticasDoQuadro([])
    expect(r.total).toBe(0)
    expect(r.porStatus).toEqual({ a_fazer: 0, em_andamento: 0, concluida: 0, nao_realizada: 0 })
    expect(r.percentualConclusao).toBe(0)
    expect(Number.isNaN(r.percentualConclusao)).toBe(false)
  })

  it('18 tarefas (6/4/5/3) devolve os numeros do mockup', () => {
    const r = estatisticasDoQuadro(
      lista({ a_fazer: 6, em_andamento: 4, concluida: 5, nao_realizada: 3 })
    )
    expect(r.total).toBe(18)
    expect(r.porStatus.a_fazer).toBe(6)
    expect(r.porStatus.em_andamento).toBe(4)
    expect(r.porStatus.concluida).toBe(5)
    expect(r.porStatus.nao_realizada).toBe(3)
    expect(r.percentualConclusao).toBe(28) // 5/18 = 27.7 → 28
  })

  it('total e a soma exata das 4 colunas', () => {
    const r = estatisticasDoQuadro(
      lista({ a_fazer: 2, em_andamento: 7, concluida: 1, nao_realizada: 4 })
    )
    const soma = COLUNAS_ORDEM.reduce((acc, s) => acc + r.porStatus[s], 0)
    expect(r.total).toBe(soma)
    expect(r.total).toBe(14)
  })
})

describe('percentualConclusao', () => {
  it('(0, 0) = 0 — guarda de divisao por zero', () => {
    expect(percentualConclusao(0, 0)).toBe(0)
  })

  it('(5, 18) = 28 (arredondado)', () => {
    expect(percentualConclusao(5, 18)).toBe(28)
  })

  it('(3, 3) = 100', () => {
    expect(percentualConclusao(3, 3)).toBe(100)
  })
})

describe('progressoChecklist', () => {
  it('devolve 0 quando total = 0 — nunca NaN', () => {
    expect(progressoChecklist(0, 0)).toBe(0)
  })

  it('calcula a porcentagem arredondada', () => {
    expect(progressoChecklist(1, 4)).toBe(25)
    expect(progressoChecklist(2, 3)).toBe(67)
  })
})

describe('codigoTarefa', () => {
  it('1247 -> TAR-1247', () => {
    expect(codigoTarefa(1247)).toBe('TAR-1247')
  })

  it('7 -> TAR-0007 (padStart 4)', () => {
    expect(codigoTarefa(7)).toBe('TAR-0007')
  })

  it('null/undefined -> string estavel, nunca TAR-null', () => {
    expect(codigoTarefa(null)).toBe('TAR-—')
    expect(codigoTarefa(undefined)).toBe('TAR-—')
  })
})

describe('iniciais', () => {
  it('Ana Paula Souza -> AP (primeira + segunda palavra)', () => {
    expect(iniciais('Ana Paula Souza')).toBe('AP')
  })

  it('Jacson -> JA (nome unico: 2 primeiras letras)', () => {
    expect(iniciais('Jacson')).toBe('JA')
  })

  it('vazio/espacos/null -> ? (nunca quebra)', () => {
    expect(iniciais('')).toBe('?')
    expect(iniciais('   ')).toBe('?')
    expect(iniciais(null)).toBe('?')
    expect(iniciais(undefined)).toBe('?')
  })
})

describe('corDoAvatar', () => {
  it('e DETERMINISTICO: o mesmo id devolve sempre a mesma classe', () => {
    const id = 'e3f1a2b4-0000-4444-8888-abcdefabcdef'
    expect(corDoAvatar(id)).toBe(corDoAvatar(id))
  })

  it('distribui entre as classes da paleta em ids diferentes', () => {
    const amostra = ['ana', 'bruno', 'carla', 'diego', 'edu', 'fabio', 'gabi', 'hugo']
    const classes = new Set(amostra.map((id) => corDoAvatar(id)))
    expect(classes.size).toBeGreaterThanOrEqual(2)
  })

  it('id ausente devolve uma classe valida, nao quebra', () => {
    expect(typeof corDoAvatar(null)).toBe('string')
    expect(corDoAvatar(null).length).toBeGreaterThan(0)
  })
})

describe('agruparChecklist', () => {
  it('agrupa por grupo com total e feitos corretos; vazio -> []', () => {
    expect(agruparChecklist([])).toEqual([])

    const itens = [
      { grupo: 'Checklist', concluido: true, texto: 'a' },
      { grupo: 'Checklist', concluido: false, texto: 'b' },
      { grupo: 'Revisao', concluido: true, texto: 'c' },
    ]
    const r = agruparChecklist(itens)
    expect(r).toHaveLength(2)

    const principal = r.find((g) => g.nome === 'Checklist')!
    expect(principal.total).toBe(2)
    expect(principal.feitos).toBe(1)
    expect(principal.itens).toHaveLength(2)

    const revisao = r.find((g) => g.nome === 'Revisao')!
    expect(revisao.total).toBe(1)
    expect(revisao.feitos).toBe(1)
  })
})

describe('filtrarTarefas', () => {
  const tarefas = [
    {
      id: '1',
      titulo: 'Revisar Contas de Anúncio',
      status: 'a_fazer' as TarefaStatus,
      prioridade: 'alta' as TarefaPrioridade,
      clienteId: 'c1',
      responsavelId: 'r1',
      clienteNome: 'Luzzia',
      responsavelNome: 'Ana Paula',
    },
    {
      id: '2',
      titulo: 'Subir criativos',
      status: 'concluida' as TarefaStatus,
      prioridade: 'baixa' as TarefaPrioridade,
      clienteId: 'c2',
      responsavelId: 'r2',
      clienteNome: 'Helena',
      responsavelNome: 'Jacson',
    },
  ]

  it('busca e case-insensitive e acento-insensitive no titulo', () => {
    expect(filtrarTarefas(tarefas, { busca: 'ANUNCIO' })).toHaveLength(1)
    expect(filtrarTarefas(tarefas, { busca: 'anúncio' })).toHaveLength(1)
    expect(filtrarTarefas(tarefas, { busca: 'revisar' })[0].id).toBe('1')
  })

  it('busca vazia nao filtra nada', () => {
    expect(filtrarTarefas(tarefas, { busca: '' })).toHaveLength(2)
    expect(filtrarTarefas(tarefas, {})).toHaveLength(2)
  })

  it("prioridade 'todas' nao filtra", () => {
    expect(filtrarTarefas(tarefas, { prioridade: 'todas' })).toHaveLength(2)
    expect(filtrarTarefas(tarefas, { prioridade: 'alta' })).toHaveLength(1)
  })

  it('filtros combinam com E logico', () => {
    expect(filtrarTarefas(tarefas, { busca: 'revisar', prioridade: 'baixa' })).toHaveLength(0)
    expect(filtrarTarefas(tarefas, { clienteId: 'c1', responsavelId: 'r1' })).toHaveLength(1)
    expect(filtrarTarefas(tarefas, { clienteId: 'c1', responsavelId: 'r2' })).toHaveLength(0)
  })

  it("sentinela 'todos' em cliente/responsavel nao filtra", () => {
    expect(filtrarTarefas(tarefas, { clienteId: 'todos', responsavelId: 'todos' })).toHaveLength(2)
  })
})

describe('intervaloPadrao', () => {
  it('hoje-30 .. hoje (FIX-2: termina em HOJE, nunca futuro por padrao)', () => {
    expect(intervaloPadrao('2026-07-14')).toEqual({ inicio: '2026-06-14', fim: '2026-07-14' })
  })

  it('atravessa a virada de mes sem quebrar', () => {
    expect(intervaloPadrao('2026-07-28')).toEqual({ inicio: '2026-06-28', fim: '2026-07-28' })
  })
})

describe('formatarIntervalo', () => {
  it("formata a partir da STRING, sem new Date() — '14/07/2026 - 20/07/2026'", () => {
    expect(formatarIntervalo('2026-07-14', '2026-07-20')).toBe('14/07/2026 - 20/07/2026')
  })
})

// --- Derivados novos (so8): comentário, anexo, atividade, notas ---

describe('tempoRelativo', () => {
  const agora = '2026-06-01T12:00:00.000Z'
  // Constrói um ISO "agora - N segundos" para os casos determinísticos.
  const atras = (segundos: number) =>
    new Date(new Date(agora).getTime() - segundos * 1000).toISOString()

  it('menos de 1 minuto -> "agora há pouco"', () => {
    expect(tempoRelativo(agora, agora)).toBe('agora há pouco')
    expect(tempoRelativo(atras(30), agora)).toBe('agora há pouco')
  })

  it('minutos: singular e plural', () => {
    expect(tempoRelativo(atras(60), agora)).toBe('há 1 minuto')
    expect(tempoRelativo(atras(5 * 60), agora)).toBe('há 5 minutos')
  })

  it('horas: singular e plural', () => {
    expect(tempoRelativo(atras(60 * 60), agora)).toBe('há 1 hora')
    expect(tempoRelativo(atras(3 * 60 * 60), agora)).toBe('há 3 horas')
  })

  it('dias: singular e plural', () => {
    expect(tempoRelativo(atras(24 * 60 * 60), agora)).toBe('há 1 dia')
    expect(tempoRelativo(atras(4 * 24 * 60 * 60), agora)).toBe('há 4 dias')
  })

  it('30 dias ou mais -> data dd/MM/yyyy', () => {
    // agora = 01/06/2026; -30 dias = 02/05/2026.
    expect(tempoRelativo(atras(30 * 24 * 60 * 60), agora)).toBe('02/05/2026')
  })

  it('entrada inválida/vazia -> "" (nunca lança, nunca Invalid Date)', () => {
    expect(tempoRelativo('', agora)).toBe('')
    expect(tempoRelativo('não é data', agora)).toBe('')
    expect(() => tempoRelativo('x', agora)).not.toThrow()
  })
})

describe('formatarTamanho', () => {
  it('casos do mockup', () => {
    expect(formatarTamanho(0)).toBe('0 KB')
    expect(formatarTamanho(900)).toBe('900 B')
    expect(formatarTamanho(1024)).toBe('1 KB')
    expect(formatarTamanho(1536)).toBe('1,5 KB')
    expect(formatarTamanho(1048576)).toBe('1 MB')
    expect(formatarTamanho(5242880)).toBe('5 MB')
  })

  it('separador decimal é vírgula (pt-BR) e sem casa quando inteiro', () => {
    expect(formatarTamanho(1536)).toContain(',')
    expect(formatarTamanho(2048)).toBe('2 KB')
  })

  it('negativo/NaN/null -> "—"', () => {
    expect(formatarTamanho(-1)).toBe('—')
    expect(formatarTamanho(Number.NaN)).toBe('—')
    expect(formatarTamanho(null)).toBe('—')
    expect(formatarTamanho(undefined)).toBe('—')
  })
})

describe('tipoDeArquivo', () => {
  it('planilha (verde chart-success)', () => {
    expect(tipoDeArquivo('vendas.xlsx').rotulo).toBe('Planilha')
    expect(tipoDeArquivo('dados.csv').rotulo).toBe('Planilha')
    expect(tipoDeArquivo('x', 'application/vnd.ms-excel').rotulo).toBe('Planilha')
    expect(tipoDeArquivo('vendas.xlsx').classe).toContain('chart-success')
  })

  it('pdf (vermelho destructive)', () => {
    expect(tipoDeArquivo('contrato.pdf').rotulo).toBe('PDF')
    expect(tipoDeArquivo('contrato.pdf').classe).toContain('destructive')
  })

  it('apresentação (laranja chart-warning)', () => {
    expect(tipoDeArquivo('pitch.pptx').rotulo).toBe('Apresentação')
    expect(tipoDeArquivo('pitch.pptx').classe).toContain('chart-warning')
  })

  it('imagem e documento usam primary', () => {
    expect(tipoDeArquivo('logo.png').rotulo).toBe('Imagem')
    expect(tipoDeArquivo('logo.png').classe).toContain('primary')
    expect(tipoDeArquivo('brief.docx').rotulo).toBe('Documento')
    expect(tipoDeArquivo('nota.txt').rotulo).toBe('Documento')
  })

  it('desconhecido/vazio -> "Arquivo" com muted-foreground', () => {
    expect(tipoDeArquivo('').rotulo).toBe('Arquivo')
    expect(tipoDeArquivo('semponto').rotulo).toBe('Arquivo')
    expect(tipoDeArquivo('semponto').classe).toContain('muted-foreground')
  })

  it('a extensão ganha do mime e é case-insensitive', () => {
    // .pdf ganha do mime de imagem.
    expect(tipoDeArquivo('doc.pdf', 'image/png').rotulo).toBe('PDF')
    expect(tipoDeArquivo('REL.PDF').rotulo).toBe('PDF')
  })

  it('a classe nunca contém cor hardcoded (# ou rgb)', () => {
    for (const nome of ['a.xlsx', 'a.pdf', 'a.pptx', 'a.png', 'a.docx', 'a']) {
      const classe = tipoDeArquivo(nome).classe
      expect(classe).not.toMatch(/#|rgb/)
    }
  })
})

describe('textoAtividade', () => {
  it('campo status -> frase + rótulo do status', () => {
    expect(textoAtividade({ tipo: 'campo_alterado', campo: 'status', para: 'concluida' })).toEqual({
      frase: 'alterou o status para',
      valor: 'Concluída',
    })
  })

  it('campo prioridade -> frase + rótulo da prioridade', () => {
    expect(
      textoAtividade({ tipo: 'campo_alterado', campo: 'prioridade', para: 'alta' })
    ).toEqual({ frase: 'alterou a prioridade para', valor: 'Alta' })
  })

  it('campo titulo -> renomeou, sem valor', () => {
    expect(textoAtividade({ tipo: 'campo_alterado', campo: 'titulo' })).toEqual({
      frase: 'renomeou a tarefa',
      valor: null,
    })
  })

  it('comentou / anexou / removeu_anexo carregam o detalhe', () => {
    expect(textoAtividade({ tipo: 'comentou', detalhe: 'texto...' })).toEqual({
      frase: 'comentou',
      valor: 'texto...',
    })
    expect(textoAtividade({ tipo: 'anexou', detalhe: 'plan.xlsx' })).toEqual({
      frase: 'anexou um arquivo',
      valor: 'plan.xlsx',
    })
    expect(textoAtividade({ tipo: 'removeu_anexo', detalhe: 'x.pdf' })).toEqual({
      frase: 'removeu um arquivo',
      valor: 'x.pdf',
    })
  })

  it('criou / checklist_concluido', () => {
    expect(textoAtividade({ tipo: 'criou' })).toEqual({ frase: 'criou a tarefa', valor: null })
    expect(textoAtividade({ tipo: 'checklist_concluido', detalhe: 'Revisar' })).toEqual({
      frase: 'concluiu o item',
      valor: 'Revisar',
    })
  })

  it('tipo desconhecido -> "atualizou a tarefa" (nunca lança — tipo é text livre)', () => {
    expect(textoAtividade({ tipo: 'tipo_do_futuro' })).toEqual({
      frase: 'atualizou a tarefa',
      valor: null,
    })
    expect(() => textoAtividade({ tipo: 'qualquer' })).not.toThrow()
  })
})

describe('corDaEtiqueta', () => {
  it('é determinístico: a mesma etiqueta tem sempre a mesma cor', () => {
    expect(corDaEtiqueta('Google Ads')).toBe(corDaEtiqueta('Google Ads'))
  })

  it('nunca devolve cor hardcoded e não quebra com null', () => {
    expect(corDaEtiqueta('Performance')).not.toMatch(/#|rgb/)
    expect(typeof corDaEtiqueta(null)).toBe('string')
    expect(corDaEtiqueta(null).length).toBeGreaterThan(0)
  })
})
