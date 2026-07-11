# Itens Diferidos — Quick 260710-u8b

Erros de lint pré-existentes, NÃO causados por esta task (arquivos gerados pelo shadcn, fora do escopo do redesenho de navegação/painel). Confirmado via `git status` — apenas os arquivos alvo da task foram modificados.

1. `src/components/ui/sidebar.tsx:611:26` — `Error: Cannot call impure function during render` (regra do plugin React do ESLint sobre componente gerado pelo shadcn).
2. `src/hooks/use-mobile.ts:14:5` — `react-hooks/set-state-in-effect` — `setState` síncrono dentro de effect (hook gerado pelo shadcn).

Ambos existem no baseline (commit adb5efa) e independem das mudanças deste incremento. Devem ser tratados numa task de manutenção dedicada aos componentes shadcn, se desejado.
