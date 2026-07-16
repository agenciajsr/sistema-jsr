// Geração do PDF do contrato — @react-pdf/renderer (leve, roda em serverless;
// NADA de puppeteer/chromium no plano Hobby da Vercel). Fonte Helvetica padrão
// (evita registro de fontes externas, que pesa o cold start).

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

import { montarSecoesContrato, TITULO_CONTRATO } from './template-trafego'
import type { VariaveisContrato } from './variaveis'

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#111111',
  },
  titulo: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  secaoTitulo: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 6,
  },
  paragrafo: {
    marginBottom: 6,
    textAlign: 'justify',
  },
})

function ContratoPdf({ vars }: { vars: VariaveisContrato }) {
  const secoes = montarSecoesContrato(vars)
  return (
    <Document title={TITULO_CONTRATO} language="pt-BR">
      <Page size="A4" style={estilos.pagina}>
        <Text style={estilos.titulo}>{TITULO_CONTRATO}</Text>
        {secoes.map((secao, i) => (
          <View key={i}>
            {secao.titulo ? <Text style={estilos.secaoTitulo}>{secao.titulo}</Text> : null}
            {secao.paragrafos.map((p, j) => (
              <Text key={j} style={estilos.paragrafo}>
                {p}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}

/** Gera o PDF do contrato preenchido como Buffer (pronto para a Autentique). */
export async function gerarPdfContrato(vars: VariaveisContrato): Promise<Buffer> {
  return renderToBuffer(<ContratoPdf vars={vars} />)
}
