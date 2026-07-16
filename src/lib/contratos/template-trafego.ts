// Template do CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRÁFEGO PAGO — módulo PURO.
//
// Texto extraído UMA vez dos DOCX de referência (contratos/JSR MIDIAS Contrato
// Tráfego Pago [3meses|6meses].docx) e versionado aqui como TS. Comparando os
// dois DOCX, as ÚNICAS diferenças são "3 meses" vs "6 meses" nas cláusulas
// 2.1 e 5.1 — por isso um template só, parametrizado por duracaoMeses.
// Nada de docxtemplater/pizzip em runtime: template versionado é a rota
// robusta para serverless (Vercel Hobby).

import type { VariaveisContrato } from './variaveis'
import { descricaoObjetoServicos, rotuloPlataformas, rotuloServicoUi } from './servicos-contratados'

/** Trecho de parágrafo com marcação de negrito (espelha o DOCX de referência). */
export type TrechoContrato = { texto: string; negrito?: boolean }

/** Parágrafo: string simples (sem negrito) OU lista de trechos com negrito. */
export type ParagrafoContrato = string | TrechoContrato[]

export type SecaoContrato = {
  titulo?: string
  paragrafos: ParagrafoContrato[]
}

/** Normaliza um parágrafo para lista de trechos (consumo uniforme em PDF/HTML). */
export function trechosDoParagrafo(p: ParagrafoContrato): TrechoContrato[] {
  return typeof p === 'string' ? [{ texto: p }] : p
}

// Textos EXATOS do rodapé do DOCX de referência (word/footer1.xml).
export const RODAPE_CONTRATO = {
  nome: 'Jacson Silva Ribeiro',
  contato: 'E-mail: jacsonribeiiro@gmail.com | Cel: (71)99363-6734',
  cidade: 'Salvador - BA | CEP 41510-237',
} as const

const DADOS_CONTRATADO_NEGRITO = 'CONTRATADO(A): JSR MÍDIAS (JACSON TRÁFEGO PAGO),'
const DADOS_CONTRATADO_RESTO =
  ' pessoa jurídica de direito privado inscrita ' +
  'no CNPJ de nº 35.368.699/0001-21, com sede localizada na R. Manoel dos Santos Filho, ' +
  'representada por Jacson Silva Ribeiro, solteiro, Gestor de Tráfego Pago, inscrito no CPF ' +
  'nº 069.345.675-28, residente na R. Manoel dos Santos Filho.'

export const TITULO_CONTRATO = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRÁFEGO PAGO'

const TITULO_CONTRATO_MULTI = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL'

/**
 * Título dinâmico (quick-260716-ky2): legado ou só-tráfego mantém o título
 * original; contrato com outros serviços vira "marketing digital".
 */
export function tituloContrato(vars: VariaveisContrato): string {
  if (!vars.servicos) return TITULO_CONTRATO
  const soTrafego = vars.servicos.length === 1 && vars.servicos[0].servico === 'trafego_pago'
  return soTrafego ? TITULO_CONTRATO : TITULO_CONTRATO_MULTI
}

/** Bloco de assinaturas (linhas na última página do PDF + fecho do preview). */
export type BlocoAssinaturas = {
  localEData: string
  contratante: { rotulo: string; nome: string; documento: string }
  contratado: { rotulo: string; nome: string; documento: string }
}

export function montarBlocoAssinaturas(vars: VariaveisContrato): BlocoAssinaturas {
  return {
    localEData: `Salvador - BA, ${vars.dataInicioFormatada}.`,
    contratante: {
      rotulo: 'CONTRATANTE:',
      nome: `NOME: ${vars.nomeSignatario}`,
      documento: `CPF n.º ${vars.cpfSignatario}`,
    },
    contratado: {
      rotulo: 'CONTRATADO:',
      nome: 'NOME: Jacson Silva Ribeiro',
      documento: 'CNPJ n.º 35.368.699/0001-21',
    },
  }
}

// No DOCX o parágrafo do CONTRATANTE tem o rótulo e o NOME/razão social em
// negrito. A qualificação sempre começa pelo nome seguido de vírgula — o split
// abaixo separa o nome (negrito) do restante (normal).
function paragrafoContratante(qualificacao: string): TrechoContrato[] {
  const virgula = qualificacao.indexOf(',')
  if (virgula === -1) return [{ texto: `CONTRATANTE: ${qualificacao}`, negrito: true }]
  return [
    { texto: `CONTRATANTE: ${qualificacao.slice(0, virgula)}`, negrito: true },
    { texto: qualificacao.slice(virgula) },
  ]
}

// Itens específicos da operação de tráfego pago (textos do DOCX, sem os
// números — a numeração é montada dinamicamente na cláusula do objeto).
const ITENS_OBJETO_TRAFEGO = [
  'Criação e configuração inicial da conta de anúncios do CONTRATANTE na plataforma, com auxílio do CONTRATADO, caso o CONTRATANTE assim deseje;',
  'Configuração do faturamento da conta, emissão de boletos para investir o crédito nas plataformas ou cadastramento do cartão de crédito do CONTRATANTE, com auxílio do CONTRATADO, caso o CONTRATANTE assim deseje;',
  'Criação das campanhas, de acordo com a estratégia planejada em conjunto com o CONTRATANTE.',
  'Gerenciamento de anúncios e otimização periódica desses anúncios, com base na coleta e análise de dados resultantes dos anúncios.',
  'Prestação de contas dos serviços prestados.',
] as const

const PARAGRAFO_1_2 =
  '1.2 O CONTRATADO não desenvolve e não publica criativos. O CONTRATANTE deverá produzir esses materiais e repassar para o CONTRATADO, para que o CONTRATADO seja o responsável pela criação das campanhas de anúncio e efetivamente consiga anunciar.'
const PARAGRAFO_1_3 =
  '1.3 Os primeiros 7 (sete) dias úteis de contrato serão destinados para o trabalho de configuração inicial do CONTRATANTE, criação das campanhas de teste e planejamento dos anúncios.'

/**
 * Cláusula 1ª (objeto) — dinâmica quando há serviços estruturados
 * (quick-260716-ky2); com vars.servicos === null o texto é EXATAMENTE o
 * legado (nenhuma regressão nos contratos já enviados).
 */
function clausulaObjeto(vars: VariaveisContrato): SecaoContrato {
  if (!vars.servicos) {
    return {
      titulo: 'CLÁUSULA 1ª - DO OBJETO DO CONTRATO',
      paragrafos: [
        '1.1 O presente documento estabelece uma relação de prestação de serviços especificamente descritos a seguir:',
        ...ITENS_OBJETO_TRAFEGO.map((texto, i) => `1.1.${i + 1} ${texto}`),
        '1.1.6 O presente contrato tem por objeto a prestação de serviços de geração de tráfego pago a partir das plataformas de anúncios, sem exclusividade e sem subordinação, visando a promoção do site e/ou das mídias sociais do(a) CONTRATANTE.',
        PARAGRAFO_1_2,
        PARAGRAFO_1_3,
      ],
    }
  }

  const itens = vars.servicos
  const temTrafego = itens.some((s) => s.servico === 'trafego_pago')
  const paragrafos: ParagrafoContrato[] = [
    '1.1 O presente documento estabelece uma relação de prestação de serviços especificamente descritos a seguir:',
  ]
  let n = 0
  for (const descricao of descricaoObjetoServicos(itens)) {
    paragrafos.push(`1.1.${++n} ${descricao}`)
  }
  if (temTrafego) {
    for (const texto of ITENS_OBJETO_TRAFEGO) {
      paragrafos.push(`1.1.${++n} ${texto}`)
    }
  }
  // Parágrafo-objeto final: cita os serviços contratados e as plataformas.
  const listaServicos = itens
    .map((s) => {
      const plataformas = s.plataformas?.length ? ` (${rotuloPlataformas(s.plataformas)})` : ''
      return `${rotuloServicoUi(s.servico)}${plataformas}`
    })
    .join(', ')
  paragrafos.push(
    `1.1.${++n} O presente contrato tem por objeto a prestação dos serviços de ${listaServicos}, ` +
      'sem exclusividade e sem subordinação, visando a promoção do negócio, do site e/ou das mídias sociais do(a) CONTRATANTE.'
  )
  if (temTrafego) {
    paragrafos.push(PARAGRAFO_1_2, PARAGRAFO_1_3)
  }
  return { titulo: 'CLÁUSULA 1ª - DO OBJETO DO CONTRATO', paragrafos }
}

/** Monta as seções do contrato já com as variáveis interpoladas (texto puro). */
export function montarSecoesContrato(vars: VariaveisContrato): SecaoContrato[] {
  const meses = `${vars.duracaoMeses} meses`
  return [
    {
      paragrafos: [
        paragrafoContratante(vars.qualificacaoContratante),
        [
          { texto: DADOS_CONTRATADO_NEGRITO, negrito: true },
          { texto: DADOS_CONTRATADO_RESTO },
        ],
        [
          { texto: 'Pelo presente instrumento particular de ' },
          { texto: tituloContrato(vars), negrito: true },
          { texto: ' aqui denominado(a) ' },
          { texto: 'CONTRATANTE', negrito: true },
          { texto: ', contrata os serviços da aqui denominada ' },
          { texto: 'CONTRATADA', negrito: true },
          {
            texto:
              ', que fazem de livre e espontânea vontade, acordando o presente contrato nos seguintes termos:',
          },
        ],
      ],
    },
    {
      titulo: 'DEFINIÇÕES',
      paragrafos: [
        'PLATAFORMA: Onde é realizada a gestão técnica e estratégica dos anúncios da conta de anúncios do CONTRATANTE.',
        'CONTA DE ANÚNCIOS: Cadastro em nome do CONTRATANTE em que o CONTRATADO faz o gerenciamento na plataforma.',
        'CAMPANHA: Nomenclatura dada à atividade, realizada pelo CONTRATADO, de gerenciar anúncios ativos na conta de anúncios do CONTRATANTE, utilizando de estratégia e planejamento para que os objetivos do CONTRATANTE sejam atingidos.',
        'CRÉDITOS: Dinheiro disponível na conta de anúncios para utilização nas plataformas.',
        'CRIATIVO: Material contendo vídeo, texto ou imagem, que servirá como anúncio para ser publicado, pelo CONTRATADO, em campanhas de anúncios pela conta de anúncios do CONTRATANTE.',
      ],
    },
    clausulaObjeto(vars),
    {
      titulo: 'CLÁUSULA 2ª - DO VALOR E FORMA DE PAGAMENTO',
      paragrafos: [
        [
          {
            texto: `2.1 O presente serviço será remunerado mensalmente pela quantia de ${vars.valorMensalFormatado}, referente aos serviços efetivamente prestados, acordo feito de `,
          },
          { texto: meses, negrito: true },
          {
            texto:
              ', devendo ser pago através de transferência ou até mesmo, PIX, na conta corrente nº 5679908-0, agência nº 0001, banco nº 336 - Banco [C6 S.A.] PIX: jacsonribeiiro@icloud.com, em nome do CONTRATADO, para a primeira mensalidade, ficando o dia 30 como data base para o pagamento das demais.',
          },
        ],
        // Composição do valor por serviço (só com 2+ serviços estruturados —
        // preenche o "2.2" que o DOCX original pula).
        ...(vars.servicos && vars.servicos.length >= 2
          ? [
              `2.2 O valor mensal é composto pelos seguintes serviços: ${vars.linhasValorPorServico.join('; ')}.`,
            ]
          : []),
        '2.3 Em caso de atraso no pagamento por 5 dias ou mais, os serviços contratados serão suspensos até que haja a devida regularização por parte do CONTRATANTE.',
        '2.4 Fica vedado o CONTRATANTE negociar abatimentos, descontos ou dilações de prazo para o pagamento ou execução dos serviços sem o prévio conhecimento e autorização do CONTRATADO.',
      ],
    },
    {
      titulo: 'CLÁUSULA 3ª - RESPONSABILIDADES DO CONTRATANTE',
      paragrafos: [
        '3.1 Informar o CONTRATADO com clareza quais são os seus objetivos para o negócio com as ações de tráfego pago. Além de informar o CONTRATADO tudo que for necessário para que os objetivos sejam satisfatórios.',
        [
          { texto: '3.2 Fornecer os materiais e/ou alterações sempre com no mínimo ' },
          { texto: '4 dias úteis', negrito: true },
          {
            texto:
              ' de antecedência. Sem tais informações o CONTRATADO não poderá dar sequência no serviço contratado.',
          },
        ],
        '3.2.1 O CONTRATADO se reserva no direito de efetuar pequenas mudanças nos materiais, inclusive os textos, para aperfeiçoar os conteúdos continuamente.',
        '3.2.2 O CONTRATADO se reserva no direito de mudar os materiais, caso seja necessário, para cumprir as diretrizes estabelecidas pelas plataformas.',
        '3.3 Fornecer ao CONTRATADO as páginas e sites necessários para as campanhas.',
        '3.4 Fornecer ao CONTRATADO, sempre que necessário, um número de WhatsApp Business para o contato dos clientes, bem como garantir que os atendimentos aconteçam de maneira eficiente.',
        '3.5 Ter uma conta do negócio em cada uma das mídias sociais que serão trabalhadas e administradas pelo CONTRATADO - se necessário, o CONTRATADO prestará o auxílio necessário para a criação de tais contas, caso o CONTRATANTE ainda não as tenha criado.',
        '3.6 Ter contas de anúncios com franqueamento de acesso como administrador para que o CONTRATADO administre as campanhas.',
        '3.7 Disponibilizar os investimentos necessários para as campanhas dentro de cada plataforma e garantir que os anúncios não serão pausados por falta de pagamento. Tais investimentos serão disponibilizados diretamente dentro da plataforma pelo próprio CONTRATANTE, ou poderão ser repassados ao CONTRATADO para que o faça com a devida apresentação de recibos.',
        '3.7.1 Os investimentos poderão ser realizados por todos os meios aceitos pela plataforma (a exemplo, cartão de crédito, cartão de débito, boleto bancário, PIX, etc.). Cabe ao CONTRATANTE decidir qual meio será o utilizado para a disponibilização de tais investimentos.',
        '3.7.2 Caso o CONTRATANTE opte por utilizar o meio de cartão de crédito, é de responsabilidade do CONTRATANTE manter limite disponível no cartão de crédito para compra de créditos nas plataformas nos casos necessários.',
        '3.7.3 Ter ciência que o valor do investimento nas plataformas de anúncios impacta diretamente nos resultados das campanhas, fica livre para seguir ou não a orientação técnica do CONTRATADO sobre o valor a ser investido.',
        '3.8 Remunerar o CONTRATADO pelo trabalho nos prazos acertados.',
        '3.9 É de responsabilidade do CONTRATANTE conferir os materiais antes ou após sua publicação.',
        '3.10 Informar quaisquer alterações de dados que possam atrasar o andamento dos trabalhos.',
        '3.10.1 Quando houver alteração nos dados cadastrais ou alguma informação que interfira na continuidade do serviço, a CONTRATANTE deverá informar e solicitar ao CONTRATADO a atualização das mesmas.',
      ],
    },
    {
      titulo: 'CLÁUSULA 4ª - DAS RESPONSABILIDADES DO CONTRATADO',
      paragrafos: [
        '4.1 Definir a melhor estratégia para as campanhas de acordo com os objetivos apresentados pelo CONTRATANTE.',
        '4.2 Subir e gerenciar os anúncios nas plataformas, e, otimizar as campanhas, solicitando novos criativos sempre que necessário.',
        '4.3 Solicitar ao CONTRATANTE páginas e sites que serão os destinos das campanhas.',
        '4.4 Solicitar ao CONTRATANTE número de WhatsApp Business para destino das campanhas, se este for necessário aos objetivos do CONTRATANTE.',
        '4.5 Gerenciar a conta de anúncios do CONTRATANTE com o total esmero.',
        '4.6 Acompanhar os gastos para dar feedback ao CONTRATANTE sobre eles.',
        '4.7 Desenvolver relatórios e prestar conta ao CONTRATANTE na frequência por ele estipulada.',
        '4.8 Realizar e cumprir os serviços contratados de acordo com a descrição do objeto do contrato.',
        '4.9 Respeitar a legislação vigente aplicável à atividade publicitária, criando os anúncios dentro das normas previstas no Código Brasileiro de Autorregulamentação Publicitária e no Código de Defesa do Consumidor.',
        [
          { texto: '4.10 O CONTRATADO ' },
          { texto: 'NÃO', negrito: true },
          { texto: ' se responsabiliza:' },
        ],
        '4.10.1 Pelo mau funcionamento de serviço e ferramentas de terceiros, ferramentas de busca ou outros que gere qualquer tipo de perda ou a falta de disponibilidade do serviço prestado para o CONTRATANTE.',
        '4.10.2 Pelos danos que o CONTRATANTE venha a sofrer decorrente de mau funcionamento de sua própria conexão ou mau uso da internet ou problemas com sua rede de internet.',
        '4.10.3 Por perdas indiretas que o CONTRATANTE venha a ter por eventuais falhas nas ferramentas e dados cadastrados.',
        '4.10.4 Por perdas indiretas que o CONTRATANTE venha a ter por eventuais falhas na plataforma.',
        '4.10.5 Por eventuais mudanças nas diretrizes das plataformas.',
        '4.10.6 Por eventuais taxas ou valores excedentes cobrados, pela administradora das plataformas, no cartão de crédito do CONTRATANTE. Neste caso é responsabilidade do CONTRATANTE entrar em contato com as administradoras da plataforma e/ou do cartão de crédito para resolução de um eventual problema.',
        '4.10.7 Por ilegalidade ou transgressão de direitos de terceiros que estejam contidos no criativo, uma vez que o CONTRATANTE é o responsável pelo conteúdo dos materiais.',
        '4.10.8 Por eventuais prejuízos decorrentes de informações erradas ou mal interpretadas no conteúdo dos anúncios.',
        '4.10.9 O CONTRATADO não é responsável por eventuais prejuízos decorrentes de informações erradas ou mal interpretadas no conteúdo dos posts.',
        '4.10.10 Designar um responsável por estar em contato com o CONTRATADO para atendimento a dúvidas levantadas.',
        '4.10.11 O CONTRATADO não se responsabiliza por mensagens e publicações de pessoas feitas em redes sociais e demais sites da Internet.',
        '4.11 Uma vez que a plataforma exibe anúncios de forma rotativa, o CONTRATADO não garante que os dados na plataforma sejam mostrados cada vez que ela seja aberta, bem como não se pode garantir que os materiais publicados estejam sempre visíveis.',
        '4.12 O CONTRATADO não desenvolve nenhum tipo de áudio, animação ou vídeo para posts e/ou criativo nas plataformas. Tampouco faz a criação de sites ou instalação de códigos de programador (pixel) nos sites ou gestão de e-mail marketing do CONTRATANTE. Cabe ao CONTRATADO exclusivamente realizar o gerenciamento de campanhas, a coleta de dados destas campanhas, a análise de tais dados e, por fim, a otimização das campanhas para que os objetivos do CONTRATANTE sejam satisfatoriamente atingidos.',
      ],
    },
    {
      titulo: 'CLÁUSULA 5ª - DA VIGÊNCIA DO CONTRATO',
      paragrafos: [
        `5.1 O presente contrato entra em vigor na data de sua assinatura e vigorará pelo prazo de ${meses}. Ao final deste prazo o contrato se encerra. Caso o CONTRATANTE queira continuar, será feita uma nova negociação.`,
      ],
    },
    {
      titulo: 'CLÁUSULA 6ª - DA RESCISÃO E ALTERAÇÃO DE CLÁUSULAS',
      paragrafos: [
        '6.1 Na hipótese de rescisão contratual, não haverá a devolução de qualquer valor por parte do CONTRATADO.',
        '6.1.1 Os valores a que esta cláusula se refere são os valores pagos pelo CONTRATANTE referentes aos serviços prestados pelo CONTRATADO. Os valores especificados como investimentos (cláusula nº 3.7) pertencem à conta de anúncios do CONTRATANTE, sendo, desta forma, dinheiros do próprio CONTRATANTE - o CONTRATADO não possui direito sobre tais valores.',
        '6.2 Este contrato poderá ser revisado, ampliado, reduzido e modificado a qualquer tempo, mediante a anuência das partes envolvidas.',
        '6.3 O CONTRATANTE deverá informar ao CONTRATADO com antecedência de 10 dias da sua vontade de rescisão deste instrumento.',
        '6.4 Durante o prazo estabelecido na cláusula n.º 5.1, o contrato não poderá ser rescindido sem a aplicação de multa contratual de 40% em cima do valor total das parcelas restantes.',
        '6.5 Caso sejam ultrapassados 3 (três) dias de inadimplemento, poderá o CONTRATADO rescindir o presente contrato, independente de notificação ou aviso prévio.',
      ],
    },
    {
      titulo: 'CLÁUSULA 7ª - DAS DISPOSIÇÕES GERAIS',
      paragrafos: [
        '7.1 A tolerância, por qualquer das partes, com relação ao descumprimento de qualquer termo ou condição aqui ajustado, não será considerada como desistência em exigir o cumprimento de disposição nele contida, nem representará novação com relação à obrigação passada, presente ou futura, no tocante ao termo ou condição cujo descumprimento foi tolerado.',
        '7.2 O contrato entre as partes fica automaticamente suspenso se sua execução for impedida por acontecimentos extraordinários como, por exemplo, incêndio, guerra, ações militares, greve de trabalhadores, catástrofes naturais como inundações, relâmpagos, interrupções graves dos sistemas da internet que não podem ser resolvidos sem custos adequados ou que não podem ser calculados no momento da contratação.',
        '7.3 O contrato segue vigente mesmo quando ocorrer pane ou pausa temporária dos funcionamentos das plataformas utilizadas nas campanhas. Leia-se, "quando a plataforma X estiver fora do ar" ou algo relacionado.',
        '7.4 É livre o CONTRATADO ter seus próprios clientes, fora do âmbito deste contrato.',
        '7.4.1 O CONTRATADO executará os serviços diretamente ao CONTRATANTE, em horários e dias de sua livre escolha, sem vínculo empregatício ou de exclusividade.',
        '7.5 O CONTRATANTE pode solicitar antecipadamente que o CONTRATADO envie os documentos via e-mail, se necessário.',
        '7.6 O CONTRATADO poderá solicitar ou auxiliar na criação de uma pasta no Google Drive, de posse do CONTRATANTE com permissão de acesso e sem restrições ao CONTRATADO, para que nesta os arquivos pessoais sejam tratados, conforme a lei de LGPD.',
        '7.6.1 Os materiais gráficos e documentos pessoais estarão em pastas do Google Drive, para não ter perda na qualidade ao serem disponibilizados pelo CONTRATANTE ao CONTRATADO, assim como arquivos que não possam ser enviados por conta do seu tamanho.',
        '7.7 O atraso nas respostas dos pedidos de solicitações feitas pelo CONTRATADO podem acarretar em atraso nos prazos, este parágrafo da plena ciência ao CONTRATANTE que isso não implicará na mudança das datas de pagamento.',
        '7.8 Todo atendimento será feito on-line através do Whatsapp pessoal e/ou do grupo criado pelo CONTRATADO, reuniões por vídeo conferências ou E-mail, por onde informará ao CONTRATANTE os andamentos dos serviços prestados.',
        '7.9 As reuniões serão agendadas em comum acordo de datas e horários podendo ser solicitadas por qualquer uma das partes.',
        '7.10 As contas de anúncios que serão utilizadas para prestação dos serviços contratados são de propriedade do CONTRATANTE.',
        '7.11 O CONTRATADO não se obriga a pagar qualquer despesa e não se responsabiliza por eventuais suspensões ou cancelamento de serviços do Facebook ADS e Google ADS. Pois normalmente suspensões ou bloqueios ocorrem por descumprimento de políticas de privacidade das plataformas, comumente relacionadas às imagens, textos e designers das publicações.',
      ],
    },
    {
      titulo: 'CLÁUSULA 8ª - DO SIGILO E CONFIDENCIALIDADE',
      paragrafos: [
        '8.1 O CONTRATADO fica livre para compartilhar os resultados obtidos nas campanhas, seja na sua rede social, portfólios, turmas de mentorados, turmas de estudo sem o consentimento do CONTRATANTE. Desde que esses resultados não exponham informações pessoais ou que possam ser relacionadas ao CONTRATANTE de maneira direta.',
      ],
    },
    {
      titulo: 'CLÁUSULA 9ª - DA SUBCONTRATAÇÃO',
      paragrafos: [
        '9.1 O CONTRATADO fica livre para delegar suas funções para seus terceirizados / funcionários / parceiros SEM o consentimento do CONTRATANTE.',
      ],
    },
    {
      titulo: 'CLÁUSULA 10ª – ANTI-CORRUPÇÃO',
      paragrafos: [
        '10.1 As Partes declaram conhecer as normas de prevenção à corrupção previstas na legislação brasileira, dentre elas, a Lei de Improbidade Administrativa (Lei n. 8.429/1992) e a Lei n. 12.846/2013 e seus regulamentos (em conjunto, "Leis Anticorrupção") e se comprometem a cumpri-las fielmente, por si e por seus sócios, administradores e colaboradores, bem como exigir o seu cumprimento pelos terceiros por elas contratados.',
        '10.2 A CONTRATADA e todos os seus colaboradores (sócios, diretores, administradores, funcionários, prepostos etc.) ao exercerem suas atividades, devem se abster de quaisquer práticas, ou condutas que importem em atos ilícitos e/ou corrupção, suborno ou qualquer outro ato que possa gerar vantagem ilícita por conta de negociações comerciais. Devendo sempre, primar pelos ditames normativos em vigor.',
        '10.3 A Parte que tomar conhecimento, tiver motivos para saber ou suspeitar de qualquer violação dessas disposições se compromete a comunicar a outra Parte por escrito imediatamente, a partir do momento em que tomar conhecimento de tal fato.',
      ],
    },
    {
      titulo: 'CLÁUSULA 11ª – DA PROTEÇÃO DE DADOS',
      paragrafos: [
        '11.1 As Partes comprometem-se a cumprir integralmente os requisitos da presente Cláusula e da legislação de proteção de dados aplicável no Brasil, incluindo, mas não se limitando à Lei nº 13.709/18 (Lei Geral de Proteção de Dados Pessoais – "LGPD"), como também se comprometem a garantir que seus empregados, agentes e subcontratados observem seus dispositivos.',
        '11.2 Para fins da presente Cláusula, "Dado Pessoal" significa qualquer informação relacionada a pessoa natural identificada ou identificável que seja coletada em decorrência das obrigações das Partes no contexto deste Contrato, bem como informações que são compartilhadas com ou disponibilizadas à outra Parte nos termos deste Contrato.',
        '11.3 A partir de então, para os fins deste Contrato, cada uma das Partes comprometer-se-á a cumprir integralmente os requisitos da legislação de proteção de dados aplicável.',
        '11.4 As Partes reconhecem e concordam que, no que diz respeito ao tratamento dos Dados Pessoais, cada Parte atua como um controlador em relação a tal tratamento e não se pretende que qualquer Parte atue como um operador para a outra em relação a qualquer atividade de tratamento de referidos dados.',
        '11.5 Desta forma, cada Parte será individualmente responsável pelo cumprimento de suas obrigações decorrentes da LGPD, de eventuais regulamentações emitidas posteriormente por autoridade reguladora competente e demais leis e regulações aplicáveis ao tratamento de Dados Pessoais.',
        '11.6 Cada Parte deverá assegurar que quaisquer Dados Pessoais que forneça à outra Parte tenham sido coletados em conformidade com a legislação aplicável. As Partes deverão tomar as medidas necessárias, incluindo fornecer informações adequadas aos titulares de dados e garantir a existência de uma base legal, para que a outra Parte tenha o direito de receber tais Dados Pessoais para os fins previstos neste Contrato.',
        '11.7 A Parte que receber os Dados Pessoais fornecidos pela outra Parte deverá tratar os dados somente na medida do necessário para atingir a finalidade pela qual foram fornecidos e para cumprimento das obrigações previstas no presente contrato. As Partes reconhecem que os Dados Pessoais também poderão ser tratados, caso necessário, para cumprimento de obrigação legal ou regulatória a qual a Parte esteja sujeita no Brasil ou para o exercício de direitos em processos judiciais, administrativos e arbitrais.',
        '11.8 Os Dados Pessoais coletados serão tratados durante o período de vigência do presente Contrato e/ou enquanto houver base legal para o tratamento de dados. Na hipótese de término do presente Contrato e, ausente qualquer base legal para tratamento dos Dados Pessoais, as Partes comprometem-se a eliminar de seus registros e sistemas todos os Dados Pessoais a que tiverem acesso ou que receberam de alguma forma em decorrência deste Contrato.',
        '11.9 Se uma das Partes receber uma reclamação, consulta ou solicitação de ou em nome de um titular de dados ou de autoridade reguladora ou outro órgão competente em relação ao tratamento de Dados Pessoais (incluindo, sem limitação, qualquer solicitação de acesso, retificação, exclusão, portabilidade ou restrição de tratamento de dados pessoais) de acordo com direitos previstos na legislação aplicável, a Parte deverá, imediatamente, e em qualquer caso, dentro de 5 (cinco) dias úteis, notificar a outra Parte por escrito sobre tal solicitação, salvo se a reclamação, consulta ou solicitação exigir um prazo inferior.',
        '11.10 Cada Parte deve garantir que possui políticas e adotará as medidas técnicas e administrativas aptas a proteger os Dados Pessoais contra acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão, bem como de qualquer outro evento que resulte no tratamento de Dados Pessoais ilegal ou abusivo, nos termos da legislação aplicável, tais como incidentes de segurança e privacidade que ponham em risco a integridade ou a confidencialidade dos Dados Pessoais.',
        '11.11 Cada Parte notificará imediatamente a outra Parte por escrito sobre qualquer tratamento ilegal ou abusivo que os Dados Pessoais possam estar envolvidos, informando a natureza dos dados afetados, os riscos relacionados, bem como as medidas de segurança para a proteção dos dados e mitigação dos prejuízos. Neste caso, as Partes atuarão em total cooperação e prestarão assistência mútua para minimizar possíveis efeitos negativos aos titulares e alinhar a estratégia de defesa, assim como qualquer comunicação com titulares, terceiros e autoridades competentes.',
      ],
    },
    // Fecho SEM as linhas de assinatura: elas são renderizadas em página
    // própria (determinística) pelo pdf.tsx e no fim do preview HTML, usando
    // montarBlocoAssinaturas().
    {
      paragrafos: [
        'E assim, por estarem de justo acordo, as partes assinam este instrumento em 02 (duas) vias de idêntico teor e forma.',
        [{ texto: `Salvador - BA, ${vars.dataInicioFormatada}.`, negrito: true }],
      ],
    },
  ]
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragrafoHtml(p: ParagrafoContrato): string {
  const conteudo = trechosDoParagrafo(p)
    .map((t) => (t.negrito ? `<strong>${escaparHtml(t.texto)}</strong>` : escaparHtml(t.texto)))
    .join('')
  return `<p>${conteudo}</p>`
}

/** HTML completo do miolo do contrato (título + seções + assinaturas), pronto para o preview. */
export function montarContratoHtml(vars: VariaveisContrato): string {
  const secoes = montarSecoesContrato(vars)
  const corpo = secoes
    .map((secao) => {
      const titulo = secao.titulo ? `<h2>${escaparHtml(secao.titulo)}</h2>` : ''
      const paragrafos = secao.paragrafos.map(paragrafoHtml).join('\n')
      return `${titulo}\n${paragrafos}`
    })
    .join('\n')
  const b = montarBlocoAssinaturas(vars)
  const assinaturas = [b.contratante, b.contratado]
    .map(
      (parte) =>
        `<p><strong>${escaparHtml(parte.rotulo)}</strong></p>\n` +
        `<p>Neste ato representada por:</p>\n` +
        `<p><strong>____________________________________________</strong></p>\n` +
        `<p>${escaparHtml(parte.nome)}</p>\n` +
        `<p>${escaparHtml(parte.documento)}</p>`
    )
    .join('\n')
  return `<h1>${escaparHtml(tituloContrato(vars))}</h1>\n${corpo}\n${assinaturas}`
}
