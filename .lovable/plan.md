## Objetivo
Adicionar ao CRM uma barra horizontal rolável de filtros rápidos de status, permitindo ao usuário alternar visualmente quais categorias de leads aparecem na tabela.

## Filtros a criar
Cada item será um chip/pill clicável que filtra a lista de leads:

1. **Convertidos** — `status_funil === 'convertido'`
2. **Em Negociação** — `status_funil === 'negociacao'`
3. **Perdidos** — `status_funil === 'perdido'`
4. **Exp. Agendado** — `status_funil === 'aula_agendada'`
5. **Exp. Realizado** — `status_funil === 'aula_realizada'`

## Comportamento
- Os chips ficam em uma linha horizontal com scroll (`overflow-x-auto`) logo acima da tabela de leads.
- Clicar em um chip ativa/desativa aquele filtro (toggle).
- Quando ativo, o chip muda de aparência (ex: fundo mais escuro ou cor de destaque) para indicar seleção.
- É possível ativar múltiplos chips simultaneamente (comportamento multi-select), combinado com os demais filtros existentes (busca, origem, cadastrador, período).
- Um chip "Todos" ou estado inicial sem filtros ativos mostra todos os leads.
- O filtro deve trabalhar em conjunto com o `filteredLeads` já existente (`useMemo`), reutilizando `filterStatus` (array de strings) ou criando um novo estado específico para esses chips rápidos.

## Implementação
1. **Estado**: reaproveitar `filterStatus: string[]` (já existe e é usado no Popover de status) ou criar estado derivado apenas para os chips. A abordagem mais simples é mapear cada chip para seu `status_funil` correspondente e adicionar/remover do `filterStatus` existente ao clicar.
2. **UI**: inserir um novo container `div` com `flex gap-2 overflow-x-auto` entre a seção de KPIs e o card da tabela (ou dentro do card de filtros), contendo botões estilizados como chips.
3. **Contagem**: exibir o número de leads correspondente ao lado de cada label do chip (ex: "Convertidos (12)") para dar contexto.
4. **Estilo**: usar as cores semânticas já definidas no projeto (via Tailwind tokens) para cada categoria, alinhado aos KPI cards já existentes (verde para convertido, âmbar para negociação, vermelho para perdido, azul/sky para agendado, roxo para realizado).

## Arquivo a modificar
- `src/pages/CRM.tsx` — adicionar a barra de chips e conectar à lógica de filtro existente.

## Não incluído neste plano
- Mudanças no backend ou novas tabelas.
- Alteração nos filtros de período, origem ou cadastrador.
- Exportação com base nos novos filtros (já funciona via `filteredLeads`).