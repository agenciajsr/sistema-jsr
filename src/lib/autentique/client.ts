// Cliente da API da Autentique (assinatura eletrônica) — módulo SERVER em lib
// (NÃO 'use server': exports de arquivo 'use server' viram endpoints; helpers
// internos moram em src/lib). GraphQL v2 com upload multipart
// (spec graphql-multipart-request: campos operations/map/0 no FormData).

const AUTENTIQUE_URL = 'https://api.autentique.com.br/v2/graphql'

/** Erro tipado: sem AUTENTIQUE_API_TOKEN a action mostra mensagem amigável. */
export class AutentiqueTokenAusenteError extends Error {
  constructor() {
    super('AUTENTIQUE_API_TOKEN não configurado.')
    this.name = 'AutentiqueTokenAusenteError'
  }
}

function obterToken(): string {
  // Aceita os dois nomes: AUTENTIQUE_API_TOKEN ou AUTENTIQUE_API_KEY (nome já usado no .env do projeto).
  const token = process.env.AUTENTIQUE_API_TOKEN ?? process.env.AUTENTIQUE_API_KEY
  if (!token) throw new AutentiqueTokenAusenteError()
  return token
}

const MUTATION_CRIAR = `
  mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
    createDocument(document: $document, signers: $signers, file: $file) {
      id
      name
    }
  }
`

/** Posição do carimbo de assinatura (API v2: x/y em % da página como String, z = página 1-based). */
export type PosicaoAssinatura = {
  x: string
  y: string
  z: number
  element: 'SIGNATURE'
}

export type SignatarioInput = {
  email: string
  nome: string
  positions?: PosicaoAssinatura[]
}

/**
 * Cria um documento na Autentique com o PDF anexado e N signatários (todos com
 * action SIGN). A Autentique envia os e-mails de assinatura automaticamente.
 * `positions` (opcional) posiciona o carimbo de cada signatário na página.
 */
export async function criarDocumento({
  nome,
  pdf,
  signatarios,
}: {
  nome: string
  pdf: Buffer
  signatarios: SignatarioInput[]
}): Promise<{ id: string }> {
  const token = obterToken()

  const operations = JSON.stringify({
    query: MUTATION_CRIAR,
    variables: {
      document: { name: nome },
      signers: signatarios.map((s) => ({
        email: s.email,
        action: 'SIGN',
        name: s.nome,
        ...(s.positions ? { positions: s.positions } : {}),
      })),
      file: null,
    },
  })

  const form = new FormData()
  form.append('operations', operations)
  form.append('map', JSON.stringify({ '0': ['variables.file'] }))
  form.append('0', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), `${nome}.pdf`)

  const resposta = await fetch(AUTENTIQUE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '')
    throw new Error(`Autentique respondeu ${resposta.status}: ${corpo.slice(0, 300)}`)
  }

  const json = (await resposta.json()) as {
    data?: { createDocument?: { id?: string } }
    errors?: Array<{ message?: string }>
  }
  const id = json.data?.createDocument?.id
  if (!id) {
    throw new Error(
      `Autentique não retornou o id do documento: ${json.errors?.[0]?.message ?? 'resposta inesperada'}`
    )
  }
  return { id }
}

const QUERY_DOCUMENTO = `
  query ConsultarDocumento($id: UUID!) {
    document(id: $id) {
      id
      signatures {
        email
        action { name }
        signed { created_at }
      }
    }
  }
`

/**
 * Consulta o documento e responde se TODOS os signatários (action SIGN) já
 * assinaram. Fonte da verdade do webhook — na dúvida, consultamos a API.
 */
export async function consultarDocumento(id: string): Promise<{ assinado: boolean }> {
  const token = obterToken()

  const resposta = await fetch(AUTENTIQUE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: QUERY_DOCUMENTO, variables: { id } }),
  })

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '')
    throw new Error(`Autentique respondeu ${resposta.status}: ${corpo.slice(0, 300)}`)
  }

  const json = (await resposta.json()) as {
    data?: {
      document?: {
        signatures?: Array<{
          action?: { name?: string } | null
          signed?: { created_at?: string } | null
        }>
      }
    }
    errors?: Array<{ message?: string }>
  }

  const assinaturas = json.data?.document?.signatures
  if (!assinaturas) {
    throw new Error(
      `Autentique não retornou o documento ${id}: ${json.errors?.[0]?.message ?? 'resposta inesperada'}`
    )
  }

  // Só contam as entradas que EXIGEM assinatura (action SIGN); a lista também
  // pode incluir o remetente/visualizadores, que não assinam.
  const pendentes = assinaturas.filter((s) => s.action?.name === 'SIGN')
  const assinado = pendentes.length > 0 && pendentes.every((s) => Boolean(s.signed?.created_at))
  return { assinado }
}
