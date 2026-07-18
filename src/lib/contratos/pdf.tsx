// Geração do PDF do contrato — @react-pdf/renderer (leve, roda em serverless;
// NADA de puppeteer/chromium no plano Hobby da Vercel). Fonte Helvetica padrão
// (evita registro de fontes externas, que pesa o cold start).
//
// Formatação fiel ao DOCX de referência (contratos/JSR MIDIAS Contrato Tráfego
// Pago [3meses].docx): negritos espelhados via TrechoContrato, rodapé em TODAS
// as páginas (textos exatos do footer1.xml) e página FINAL própria para as
// assinaturas, com linhas em posições absolutas conhecidas em tempo de build.

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

import {
  montarSecoesContrato,
  montarBlocoAssinaturas,
  trechosDoParagrafo,
  RODAPE_CONTRATO,
  tituloContrato,
  type ParagrafoContrato,
} from './template-trafego'
import type { VariaveisContrato } from './variaveis'

// A4 = 595 x 842 pt. As linhas de assinatura ficam em `top` fixo (pt) na
// página final — daí as posições em % enviadas à Autentique são determinísticas.
const ALTURA_A4 = 842
const TOP_LINHA_CONTRATANTE = 240
const TOP_LINHA_CONTRATADO = 460

/**
 * Posições (formato da Autentique: x/y como string em % da página, y crescendo
 * de cima para baixo) onde o carimbo de assinatura deve cair — logo ACIMA de
 * cada linha da última página. Usadas por enviarParaAssinatura.
 */
export const POSICAO_ASSINATURA = {
  contratante: {
    x: '12',
    y: String(Math.round(((TOP_LINHA_CONTRATANTE - 65) / ALTURA_A4) * 100)),
  },
  contratado: {
    x: '12',
    y: String(Math.round(((TOP_LINHA_CONTRATADO - 65) / ALTURA_A4) * 100)),
  },
} as const

/**
 * Conta as páginas de um PDF pelo objeto /Pages (/Count N). Em PDFs gerados
 * pelo @react-pdf há um único /Count raiz; por segurança usamos o MAIOR valor
 * encontrado. Fallback: contagem de objetos /Type /Page; último recurso: 1.
 */
export function contarPaginasPdf(buffer: Buffer): number {
  const texto = buffer.toString('latin1')
  const counts = [...texto.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]))
  if (counts.length > 0) return Math.max(...counts)
  const pages = texto.match(/\/Type\s*\/Page[^s]/g)
  return pages && pages.length > 0 ? pages.length : 1
}

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 48,
    paddingBottom: 80,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.6,
    color: '#111111',
  },
  titulo: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  secaoTitulo: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 8,
  },
  paragrafo: {
    marginBottom: 8,
    textAlign: 'justify',
  },
  negrito: {
    fontFamily: 'Helvetica-Bold',
  },
  rodape: {
    position: 'absolute',
    bottom: 24,
    left: 56,
    right: 56,
    fontSize: 8,
    lineHeight: 1.4,
    textAlign: 'center',
    color: '#666666',
  },
  // Página final de assinaturas — blocos em posição ABSOLUTA (determinística).
  blocoAssinatura: {
    position: 'absolute',
    left: 56,
    right: 56,
  },
  rotuloParte: {
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  linhaAssinatura: {
    width: 320,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    marginBottom: 6,
  },
})

function Paragrafo({ p }: { p: ParagrafoContrato }) {
  return (
    <Text style={estilos.paragrafo}>
      {trechosDoParagrafo(p).map((t, i) =>
        t.negrito ? (
          <Text key={i} style={estilos.negrito}>
            {t.texto}
          </Text>
        ) : (
          <Text key={i}>{t.texto}</Text>
        )
      )}
    </Text>
  )
}

function Rodape() {
  return (
    <Text style={estilos.rodape} fixed>
      {RODAPE_CONTRATO.nome}
      {'\n'}
      {RODAPE_CONTRATO.contato}
      {'\n'}
      {RODAPE_CONTRATO.cidade}
    </Text>
  )
}

function ContratoPdf({ vars }: { vars: VariaveisContrato }) {
  const todas = montarSecoesContrato(vars)
  // O FECHO ("E assim... Salvador - BA, data") sai do fluxo do corpo e vai
  // para o TOPO da página de assinaturas — senão fica órfão páginas antes.
  const secoes = todas.filter((s) => !s.fecho)
  const fecho = todas.filter((s) => s.fecho)
  const assinaturas = montarBlocoAssinaturas(vars)
  return (
    <Document title={tituloContrato(vars)} language="pt-BR">
      <Page size="A4" style={estilos.pagina}>
        <Text style={estilos.titulo}>{tituloContrato(vars)}</Text>
        {secoes.map((secao, i) => (
          <View key={i}>
            {secao.titulo ? <Text style={estilos.secaoTitulo}>{secao.titulo}</Text> : null}
            {secao.paragrafos.map((p, j) => (
              <Paragrafo key={j} p={p} />
            ))}
          </View>
        ))}
        <Rodape />
      </Page>
      {/* Página FINAL de assinaturas — posições absolutas fixas (ver POSICAO_ASSINATURA).
          O fecho fica no topo em fluxo normal; NÃO afeta o top das linhas. */}
      <Page size="A4" style={estilos.pagina}>
        {fecho.map((secao, i) => (
          <View key={i}>
            {secao.paragrafos.map((p, j) => (
              <Paragrafo key={j} p={p} />
            ))}
          </View>
        ))}
        <View style={[estilos.blocoAssinatura, { top: TOP_LINHA_CONTRATANTE - 120 }]}>
          <Text style={estilos.rotuloParte}>{assinaturas.contratante.rotulo}</Text>
          <Text>Neste ato representada por:</Text>
        </View>
        <View style={[estilos.blocoAssinatura, { top: TOP_LINHA_CONTRATANTE }]}>
          <View style={estilos.linhaAssinatura} />
          <Text>{assinaturas.contratante.nome}</Text>
          <Text>{assinaturas.contratante.documento}</Text>
        </View>

        <View style={[estilos.blocoAssinatura, { top: TOP_LINHA_CONTRATADO - 120 }]}>
          <Text style={estilos.rotuloParte}>{assinaturas.contratado.rotulo}</Text>
          <Text>Neste ato representada por:</Text>
        </View>
        <View style={[estilos.blocoAssinatura, { top: TOP_LINHA_CONTRATADO }]}>
          <View style={estilos.linhaAssinatura} />
          <Text>{assinaturas.contratado.nome}</Text>
          <Text>{assinaturas.contratado.documento}</Text>
        </View>
        <Rodape />
      </Page>
    </Document>
  )
}

/** Gera o PDF do contrato preenchido como Buffer (pronto para a Autentique). */
export async function gerarPdfContrato(vars: VariaveisContrato): Promise<Buffer> {
  return renderToBuffer(<ContratoPdf vars={vars} />)
}
