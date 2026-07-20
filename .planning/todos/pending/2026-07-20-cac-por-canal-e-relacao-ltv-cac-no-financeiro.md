---
created: 2026-07-20T03:14:54.255Z
title: CAC por canal e relação LTV/CAC no Financeiro
area: general
files:
  - src/lib/financeiro/executiva.ts
  - src/actions/financeiro.ts
  - src/app/(app)/financeiro/visao-analitica.tsx
  - src/lib/db/schema.ts
---

## Problem

Última pendência da camada transversal do dashboard executivo (CAC · LTV · MRR · churn).
MRR, churn e LTV já foram entregues na quick 260719-wwm; **falta o CAC por canal** e a
relação LTV/CAC.

O bloqueio é de dado, não de cálculo: o sistema já sabe **de onde** cada cliente veio
(`clientes.origem_cliente`, preenchido no cadastro), mas **não sabe quanto a JSR investe
para captar** — não existe hoje nenhum lugar para lançar o gasto com tráfego pago próprio,
comissão de indicação, etc. Sem esse número não há divisão a fazer.

Valor para o negócio: a relação LTV/CAC responde "cada real investido em aquisição volta
quantas vezes?" (acima de 3x = saudável) e mostra em qual canal vale colocar mais verba.

## Solution

1. **Lançamento de investimento em aquisição** — tabela nova (ex.: `investimentos_aquisicao`:
   canal, mês/competência, valor) + tela simples no Financeiro para o lançamento mensal por
   canal. Canais devem casar com os valores usados em `clientes.origem_cliente`.
2. **Cálculo** — CAC do canal = investimento do canal no período ÷ clientes ganhos daquele
   canal no mesmo período. Lógica pura e testável em `src/lib/financeiro/` seguindo o padrão
   de `executiva.ts` (Vitest, mesma disciplina de TDD usada em churn/LTV).
3. **UI** — cards de CAC por canal e da relação LTV/CAC na Visão Executiva do Financeiro,
   junto dos cards de churn e LTV já existentes em `visao-analitica.tsx`; dado agregado via
   `src/actions/financeiro.ts` (queries sequenciais, regra do pool).

Atenção: com ~10 clientes a amostra é pequena — prever visão acumulada por período
(3/6 meses) como já foi feito no churn, para o número não oscilar demais.

Todo texto de UI em pt-BR com acentos.
