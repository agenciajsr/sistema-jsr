// Migration 0035 — Processos do cliente (Onboarding + Retenção/Gestão de crise).
// Cria processo_modelo_itens (modelo editável) + processo_itens (instância por
// cliente) + clientes.motivo_atencao, e SEMEIA o modelo com o checklist que o
// usuário usava no ClickUp. Idempotente (IF NOT EXISTS + seed só se vazio).
// Uso: npx tsx --env-file=.env.local scripts/aplicar-migration-0035.ts
import postgres from 'postgres'

const MODELO_ONBOARDING = [
  { titulo: 'Criar grupo no WhatsApp com o cliente', opcional: false },
  { titulo: 'Criar a pasta do cliente no Google Drive', opcional: false },
  { titulo: 'Colocar o contrato assinado no Google Drive', opcional: false },
  { titulo: 'Agendar a reunião de kickoff', opcional: true },
  { titulo: 'Setup do Meta Ads', opcional: false },
  { titulo: 'Setup do Google Ads', opcional: true },
  { titulo: 'Estratégia de criação de campanhas', opcional: false },
  { titulo: 'Finalização do processo de onboarding', opcional: false },
]

const MODELO_RETENCAO = [
  { titulo: 'Diagnóstico: entender o motivo da insatisfação/risco', opcional: false },
  { titulo: 'Reunião de alinhamento com o cliente', opcional: false },
  { titulo: 'Plano de ação corretivo (o que muda e até quando)', opcional: false },
  { titulo: 'Acompanhamento próximo (check-ins semanais)', opcional: false },
  { titulo: 'Revisão de resultados com o cliente', opcional: false },
]

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    await sql.begin(async (tx) => {
      await tx`
        CREATE TABLE IF NOT EXISTS processo_modelo_itens (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tipo text NOT NULL,
          titulo text NOT NULL,
          ordem integer NOT NULL DEFAULT 0,
          opcional boolean NOT NULL DEFAULT false,
          ativo boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `
      await tx`
        CREATE TABLE IF NOT EXISTS processo_itens (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
          tipo text NOT NULL,
          titulo text NOT NULL,
          ordem integer NOT NULL DEFAULT 0,
          opcional boolean NOT NULL DEFAULT false,
          status text NOT NULL DEFAULT 'pendente',
          concluido_em timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `
      await tx`
        CREATE INDEX IF NOT EXISTS processo_itens_cliente_tipo_idx
        ON processo_itens (cliente_id, tipo)
      `
      await tx`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS motivo_atencao text`

      const [{ total }] = await tx`SELECT count(*)::int AS total FROM processo_modelo_itens`
      if (total === 0) {
        for (const [i, item] of MODELO_ONBOARDING.entries()) {
          await tx`
            INSERT INTO processo_modelo_itens (tipo, titulo, ordem, opcional)
            VALUES ('onboarding', ${item.titulo}, ${i}, ${item.opcional})
          `
        }
        for (const [i, item] of MODELO_RETENCAO.entries()) {
          await tx`
            INSERT INTO processo_modelo_itens (tipo, titulo, ordem, opcional)
            VALUES ('retencao', ${item.titulo}, ${i}, ${item.opcional})
          `
        }
        console.log(`Seed: ${MODELO_ONBOARDING.length} itens de onboarding + ${MODELO_RETENCAO.length} de retenção.`)
      } else {
        console.log(`Modelo já tem ${total} itens — seed pulado.`)
      }
    })
    console.log('Migration 0035 aplicada com sucesso.')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
