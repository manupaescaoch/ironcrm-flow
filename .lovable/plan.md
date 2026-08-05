# Caixa de mensagem do Cronograma de Automações

Três correções no modal "Editar Atividade" (e no modal de nova atividade / edição em massa) da página `/admin/cronograma-automacoes`.

## 1. Cursor pulando para o final do texto

Causa confirmada: o modal recebe o objeto do grupo recriado a cada render do componente pai (`atvToGrupo` cria um novo objeto sempre). O `useEffect` que preenche os campos depende desse objeto, então a cada re-render (refetch da lista, troca de seleção, etc.) o texto é reescrito no estado e o cursor volta para o fim.

Correção: reinicializar os campos apenas quando o modal abre ou quando muda a atividade editada (identificador estável), não a cada render.

## 2. Permitir letras minúsculas

Hoje a caixa de texto força visualmente MAIÚSCULAS (regra global do componente de textarea) e o texto do envio fica em caixa alta.

Correção: a caixa de mensagem passa a respeitar exatamente o que foi digitado (maiúsculas e minúsculas), tanto na tela quanto no envio. Vale para o campo de mensagem do modal de edição, do modal de nova atividade e da edição em massa. Os demais campos do sistema continuam em maiúsculas como hoje.

Observação: mensagens já salvas anteriormente estão gravadas em caixa alta no banco — elas continuarão assim até serem reescritas.

## 3. Nome do responsável automático com `[nome]`

- Na caixa de mensagem haverá um botão "Inserir [nome]" que coloca o marcador na posição do cursor.
- Abaixo da caixa, um preview mostra a mensagem já com o nome do responsável selecionado (primeiro nome), para o usuário conferir antes de salvar.
- No envio, o marcador é substituído automaticamente pelo primeiro nome do responsável da atividade. Aceita `[nome]`, `{nome}` e `[NOME]`.
- Assim a mensagem serve para qualquer responsável, sem risco de nome errado (como o "CASTRS" atual).

## Detalhes técnicos

- `src/pages/admin/CronogramaAutomacoes.tsx`: ajustar deps do `useEffect` do `EditGrupoDialog` para `[open, grupo?.key]`; textarea com `normal-case`; botão de inserir marcador via `selectionStart` de uma ref; preview com substituição do nome.
- `src/components/cronograma-admin/NewAtividadeDialog.tsx` e `BulkEditDialog.tsx`: mesmo tratamento no campo de mensagem (`normal-case` + botão `[nome]`).
- `supabase/functions/send-cronograma-messages/index.ts`: ao usar `atividade.mensagem`, aplicar substituição dos marcadores pelo primeiro nome de `resp.nome` antes de enviar; redeploy da função.
