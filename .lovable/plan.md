
Objetivo: substituir o fluxo atual de “perguntar se altera/exclui os demais” por uma seleção em lote no calendário, igual ao padrão da referência: selecionar vários cards, ter ações de Editar, Excluir e Selecionar todos, e remover o botão/diálogo atual de exclusão em massa por recorrência.

Plano

1. Remover a lógica atual de “irmãos”
- Tirar de `CronogramaTab.tsx`:
  - `findSiblings`
  - estado `bulkConfirm`
  - diálogo “Apenas este dia / Alterar todos / Excluir todos”
  - qualquer decisão automática baseada em título+horário+responsável
- Resultado: editar/excluir deixam de depender de recorrência implícita.

2. Criar seleção manual de atividades
- Adicionar estado de seleção por `id` em `CronogramaTab.tsx`:
  - conjunto/lista de ids selecionados
  - helpers para selecionar/desselecionar um item
  - limpar seleção ao trocar semana ou após ação concluída
- Permitir selecionar clicando no card em modo seleção, sem abrir popup.
- Manter clique normal abrindo detalhes quando não estiver em modo seleção.

3. Adicionar barra de ações no topo do cronograma
- Incluir controles visíveis acima da grade:
  - `Selecionar`
  - `Selecionar todos`
  - `Editar`
  - `Excluir`
  - `Cancelar seleção`
- Comportamento:
  - `Selecionar todos`: marca todas as atividades visíveis da semana atual
  - `Editar`: habilitado somente quando houver itens selecionados
  - `Excluir`: habilitado somente quando houver itens selecionados
- Remover o conceito de “exclusão em massa” automática e deixar só essa ação manual.

4. Ajustar UX visual da seleção
- Destacar cards selecionados com borda/ring/check para ficar claro.
- No modo seleção, impedir abertura do popup de detalhes.
- Exibir contador: “X atividades selecionadas”.

5. Editar múltiplos itens de forma explícita
- Reaproveitar o formulário de edição, mas em modo lote.
- Regra proposta:
  - se 1 item selecionado: abre edição normal completa
  - se 2+ itens selecionados: abre edição em massa
- Na edição em massa, atualizar apenas campos comuns e seguros:
  - título
  - horário
  - responsável
  - formulário
  - mensagem
- Não alterar `dia_semana` em massa, porque agora a seleção já define exatamente quais registros serão afetados.

6. Excluir múltiplos itens de forma explícita
- Ao clicar em `Excluir`, abrir apenas um diálogo simples de confirmação:
  - “Deseja excluir X atividades selecionadas?”
- Confirmando, usar `bulkDeleteAtividades` com os ids selecionados.
- Se houver só 1 item selecionado, usar o mesmo fluxo com texto singular ou a mutação individual.

7. Compatibilizar popup e edição individual
- No popup de evento, manter apenas ações individuais de editar/excluir.
- Remover qualquer herança do fluxo “apenas este dia / todos”.
- Se o usuário quiser agir em vários, ele entra no modo seleção.

8. Hooks e dados
- `useCronogramaAtividades.ts` já tem quase tudo necessário:
  - `updateAtividade`
  - `bulkUpdateAtividades`
  - `deleteAtividade`
  - `bulkDeleteAtividades`
- Não vejo necessidade de alteração no banco.
- Só pode ser útil ajustar mensagens de toast para refletir seleção manual (“atividades selecionadas”).

Detalhes técnicos
- Arquivo principal a refatorar: `src/components/cronograma/CronogramaTab.tsx`
- Hook provavelmente só precisará de ajustes menores de mensagens: `src/hooks/useCronogramaAtividades.ts`
- A seleção deve considerar somente atividades renderizadas/visíveis na semana atual, evitando “selecionar todos” de registros fora do contexto.
- A referência enviada sugere um toolbar de ações em massa no topo; seguirei esse padrão em vez do popup de recorrência atual.

Resultado esperado
- Some o problema do “Apenas este dia” porque esse fluxo deixa de existir.
- O usuário escolhe exatamente quais atividades quer alterar/excluir.
- A interface fica mais previsível: selecionar > editar/excluir > confirmar.
