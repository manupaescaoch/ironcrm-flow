# Remover a página Vencimentos

## Mapeamento (verificado no código)

Tudo abaixo é usado **somente** pela página Vencimentos — nenhum outro módulo (Contas a Pagar, Comissões, Dashboard) importa esses arquivos:

- `src/pages/ControleVencimentos.tsx` — a página
- `src/hooks/useVencimentosData.ts` — hook e tipos (`VencimentoItem`, `VencimentosSummary`, `VencimentoStatus`, `VencimentoTipo`), importados apenas pelos componentes da pasta `vencimentos/`
- `src/hooks/usePagamentosData.ts` — não é importado por nenhum arquivo (código morto ligado ao tema)
- `src/components/vencimentos/` (10 arquivos): `VencimentosTable`, `VencimentosFilters`, `VencimentosKPICard`, `VencimentoBadge`, `HistoricoPagamentos`, `RenovacaoModal`, `EditarVencimentoModal`, `ConfirmarPagamentoModal`, `InlineEditableDate`, `InlineEditablePlano`

Referências a limpar:

- `src/App.tsx`: import de `ControleVencimentos` (linha 30) e a rota `/vencimentos` (linhas 364-371)
- `src/components/Layout.tsx`: item de menu "Vencimentos" (linha 53) e o ícone `CalendarClock` do import (usado só ali)

## Compartilhado — será mantido intacto

- Componentes `ui/*`, `UnidadeContext`, `lib/brasilia`, `lib/utils`
- Tabelas do banco `pagamentos_mensais`, `interacoes`, `alunos`/`leads` e a edge function `update-vencimentos` — **nada de banco será removido**, apenas o frontend. Nenhuma migração será criada.
- Palavras "vencimento" em Contas a Pagar (`ContasTable`, `ContaFormFields`, `parseContaTexto`, etc.) são do domínio de contas a pagar e não têm relação — ficam como estão.

## Passos

1. Remover import + rota `/vencimentos` no `App.tsx`
2. Remover item de menu e ícone não usado no `Layout.tsx`
3. Excluir `src/pages/ControleVencimentos.tsx`, `src/hooks/useVencimentosData.ts`, `src/hooks/usePagamentosData.ts` e a pasta `src/components/vencimentos/`
4. Rodar busca final por "vencimentos"/"ControleVencimentos" e typecheck para garantir zero referências soltas

## Observação

A funcionalidade de controle de vencimentos/renovação de planos deixará de existir na interface (incluindo o histórico de pagamentos e a renovação inline). Os dados permanecem no banco. Se quiser preservar alguma parte (ex.: histórico de pagamentos em outra tela), diga antes de eu aplicar.
