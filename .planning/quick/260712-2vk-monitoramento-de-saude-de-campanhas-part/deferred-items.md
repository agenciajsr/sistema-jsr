# Itens diferidos — quick-260712-2vk

Descobertas fora do escopo desta task (arquivos NÃO tocados por este plano).
Pré-existentes; não são regressões. Registradas para avaliação futura.

## Lint (npm run lint) — erros/avisos pré-existentes

- `src/lib/meta/client.ts:160` — `prefer-const` ('nextUrl' nunca reatribuído). Erro pré-existente, fora do escopo (arquivo de integração Meta, não alterado aqui).
- `src/lib/dashboard/data.ts` — 3 avisos `no-unused-vars` (`adAccounts`, `parseActions`, `ChaveHeroi`). Pré-existentes, fora do escopo.

## Conhecidos e explicitamente permitidos pelo plano (não são regressões)

- `src/components/ui/sidebar.tsx` — `react-hooks/purity`.
- `src/hooks/use-mobile.ts` — `react-hooks/set-state-in-effect`.
- `src/lib/inngest/functions/sync-meta-ads.ts:17` — `no-explicit-any`.
