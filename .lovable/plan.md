## Ajuste

Mudar a lógica de cálculo do período no `notify-resumo-semanal-crm` para sempre considerar a **semana anterior** (domingo a sábado) em relação à data de execução.

## Comportamento

- Quando rodar no sábado às 18h → envia o resumo da semana que acabou de terminar (domingo passado a sábado atual).
- Quando rodar em qualquer outro dia (testes ou disparo manual) → também usa a semana anterior completa.

## Cálculo

```
sábado = data_execução - (dia_da_semana + 1)
domingo = sábado - 6 dias
```

Exemplo: hoje é domingo 26/04 → sábado anterior = 25/04, domingo anterior = 19/04 → período **19/04 a 25/04**.

## Arquivo

- `supabase/functions/notify-resumo-semanal-crm/index.ts` — função `getWeekRange()` ajustada.

Após aplicar, redeploy + teste em dry-run para confirmar o período antes de enviar.