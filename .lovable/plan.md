

## Problem

The database **function** `atualizar_estoque_apos_movimentacao()` exists, but the **trigger** that calls it on `movimentacoes_estoque` inserts is missing. When we removed the frontend manual update (to fix double-counting), we left the system with no mechanism to update stock balances at all.

This explains why the quantity stays stuck at 3 regardless of entries or withdrawals.

## Solution

Create the missing trigger via a database migration:

```sql
CREATE TRIGGER trigger_atualizar_estoque
  AFTER INSERT ON public.movimentacoes_estoque
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_estoque_apos_movimentacao();
```

Then fix the current "Copo Café" balance by recalculating from movement history. Based on the data: 12 entries, multiple withdrawals — the correct balance needs to be computed and set via an adjustment.

### Steps

1. **Create migration** to add the trigger `trigger_atualizar_estoque` on `movimentacoes_estoque` AFTER INSERT
2. **Fix existing balances** — run a one-time data correction for all items whose `quantidade_atual` is out of sync (using the synchronization tool already in the app, or a direct SQL update)

No frontend code changes needed — the mutation and trigger function are already correct.

