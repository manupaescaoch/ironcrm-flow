
# Corrigir erro ao editar manualmente a Quantidade Minima no Estoque

## Problema
Ao tentar digitar manualmente o valor de "Quantidade Minima em Estoque" nos modais de criar ou editar insumo, o campo reseta para 0 toda vez que o usuario tenta limpar o valor atual. Isso acontece porque o codigo usa `parseInt(e.target.value) || 0`, que converte string vazia em 0 instantaneamente, impedindo o usuario de digitar um novo numero.

## Solucao
Alterar o tratamento do campo `quantidade_minima` para aceitar string vazia temporariamente durante a digitacao, e converter para numero apenas na hora de salvar.

## Detalhes Tecnicos

**Arquivo: `src/pages/EstoqueInterno.tsx`**

1. Alterar o `onChange` dos inputs de `quantidade_minima` nos dois modais (criar e editar) para usar `Number(e.target.value)` em vez de `parseInt(e.target.value) || 0`, permitindo que o campo fique vazio:

```typescript
// De:
onChange={e => setEditInsumo(p => ({ ...p, quantidade_minima: parseInt(e.target.value) || 0 }))}

// Para:
onChange={e => setEditInsumo(p => ({ ...p, quantidade_minima: e.target.value === '' ? 0 : parseInt(e.target.value) }))}
```

2. Ajustar o `value` para mostrar string vazia quando for 0, ou manter o valor numerico usando uma abordagem que permite o campo vazio:

```typescript
// Usar min={0} para evitar valores negativos
value={editInsumo.quantidade_minima || ''}
```

3. Aplicar a mesma correcao no modal de criar insumo (campo `novoInsumo.quantidade_minima`).

4. Garantir que o `handleEditarInsumo` e `handleCriarInsumo` usem `|| 0` como fallback antes de enviar ao banco.

Essas mesmas correcoes serao aplicadas nos outros campos numericos que possam ter o mesmo problema (`lead_time_dias`, `estoque_seguranca_dias`, `custo_unitario`, `quantidade_minima_compra`, `media_diaria_manual`).
