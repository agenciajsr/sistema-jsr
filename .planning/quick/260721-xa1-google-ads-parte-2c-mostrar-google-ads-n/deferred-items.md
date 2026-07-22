# Deferred Items — quick 260721-xa1

Itens fora do escopo desta tarefa (não corrigidos aqui, por regra de SCOPE BOUNDARY).

## Warnings de ESLint pré-existentes (não causados por esta tarefa)

Descobertos ao rodar `eslint` nos 2 arquivos onde só ADICIONEI comentários (Task 2).
São `@typescript-eslint/no-unused-vars` — código morto que já existia antes desta
tarefa; adicionar uma linha de comentário não pode criar unused-var. Deixados como estão.

- `src/actions/relatorios.ts:9:10` — `'hojeBrasilia' is defined but never used`
- `src/actions/relatorios.ts:9:24` — `'dataMenosDias' is defined but never used`
- `src/actions/relatorios.ts:129:14` — `'err' is defined but never used`
- `src/lib/relatorios/gerar-relatorio.ts:12:61` — `'MetricasRelatorio' is defined but never used`

Total: 4 warnings, 0 errors. Não bloqueiam build (tsc 0 erros). Limpar num passe de
lint dedicado, não neste vínculo estrutural meta+google.
