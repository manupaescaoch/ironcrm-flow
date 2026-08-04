# Renomear unidades para EVO e reposicionar Indicações

## 1. Menu lateral
Mover o item "Indicações" para logo abaixo de "CRM" (hoje ele fica depois de Contas a Pagar). Ordem final: Dashboard, CRM, Indicações, Comissões, Contas a Pagar, Tarefas, ...

## 2. Nomes das unidades
Hoje as três unidades estão cadastradas como `Iron Boa Viagem`, `Iron Madalena` e `Iron Setúbal`. Serão renomeadas para:

- EVO BOA VIAGEM
- EVO MADALENA
- EVO SETÚBAL

Como todo o sistema referencia unidade por `unidade_id`, a mudança de nome não quebra vínculos de leads, metas, contas ou relatórios — apenas a exibição.

## Detalhes técnicos
- `src/components/Layout.tsx`: reordenar `allNavItems`.
- Migração SQL: `UPDATE public.unidades SET nome = ...` para os três registros.
- Ajustar os pontos que removem o prefixo "IRON" do nome da unidade, para aceitar "EVO" (com fallback ao antigo):
  - `src/lib/parseContaTexto.ts` (detecção da unidade no texto colado)
  - `src/components/contas-pagar/NovaContaModal.tsx` (aviso de unidade divergente)
  - `supabase/functions/send-formulario-lembretes/index.ts` (regex `^iron\s+`)
- `src/pages/NpsPublico.tsx` e `notify-nps-resposta`: a lista de unidades usa apenas MADALENA / BOA VIAGEM / SETÚBAL (sem prefixo), então continuam funcionando; o casamento por nome na função NPS será ajustado para ignorar o prefixo EVO/IRON.

Fora de escopo: textos institucionais de mensagens/telas que citam "Iron Club" (rodapés, templates de WhatsApp, logo do NPS). Se quiser, faço essa troca de marca em uma etapa seguinte.
