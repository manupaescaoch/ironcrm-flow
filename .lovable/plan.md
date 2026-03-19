

## Problem: Stock Double-Counting

The stock quantity is being updated **twice** for every movement:

1. **Database trigger** `atualizar_estoque_apos_movimentacao` — fires on INSERT to `movimentacoes_estoque` and updates `estoque_interno.quantidade_atual`
2. **Frontend code** in `EstoqueInterno.tsx` (lines 469-502) — manually fetches current stock and updates it again

When you add 1 unit to a stock of 1, the trigger makes it 2, then the frontend reads 2 and adds 1 again making it 3 (or reads the already-updated value). The exact result depends on timing, which explains the jump to 4.

## Solution

**Remove the manual stock update from the frontend** (lines 469-501 in `EstoqueInterno.tsx`). Keep only the movement INSERT. The database trigger already handles the stock balance correctly.

### Changes to `src/pages/EstoqueInterno.tsx`:

1. **Simplify `registrarMovimentacaoMutation`**: Remove the entire block that fetches `estoqueExistente` and manually updates `estoque_interno`. The mutation should only insert into `movimentacoes_estoque` — the trigger handles the rest.

2. **Same fix for `corrigirMutation`** in `SincronizacaoEstoque.tsx` (line ~148): Remove the manual `estoque_interno` update there too, since the trigger already handles adjustments.

This is a one-line-of-logic fix — the trigger is correct and handles all three types (entrada, retirada, ajuste). The frontend duplication is the bug.

