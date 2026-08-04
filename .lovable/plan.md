# Ações da conta em menu único (⋮)

Substituir a fileira de ícones da tabela de Contas a Pagar por um menu de três pontinhos, igual ao exemplo enviado.

## O menu terá
- **Marcar como Pago** (abre o modal de baixa; só aparece se a conta estiver pendente)
- **Editar**
- **Reagendar** — novo: escolher nova data de vencimento sem abrir o formulário inteiro
- **Excluir** (em vermelho, com confirmação)

Copiar dados de pagamento e Ver detalhes continuam acessíveis: o clique na linha (ou no card no celular) segue abrindo os detalhes, e "Copiar dados de pagamento" entra no mesmo menu como item adicional.

No celular, os botões do card também passam a usar o mesmo menu ⋮, mantendo o padrão em todas as telas.

## Reagendar
Diálogo simples com a data de vencimento atual pré-preenchida. Ao salvar, atualiza o vencimento, registra a alteração no histórico da conta (como já ocorre nas edições) e atualiza a lista/KPIs. Não dispara nova mensagem no WhatsApp.

## Detalhes técnicos
- `src/components/contas-pagar/ContasTable.tsx`: trocar os botões por `DropdownMenu` (shadcn) com ícones `Check`, `Pencil`, `CalendarClock`, `Trash2`, `Copy`; aplicar em desktop e mobile.
- Nova prop `onReagendar` e `onExcluir` na tabela, ligadas em `src/pages/ContasPagar.tsx` (excluir reutiliza o AlertDialog/confirmação existente).
- Novo componente `ReagendarModal.tsx` usando a mutation de atualização existente (`useContasPagar` → update) enviando apenas `data_vencimento`.
- Sem mudanças de banco de dados.
