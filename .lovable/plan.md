# Corrigir caixa de mensagem e variável [NOME] nas automações

## Causa raiz do problema atual

O componente global de textarea (`src/components/ui/textarea.tsx`) força `value.toUpperCase()` dentro do próprio `onChange` e aplica a classe CSS `uppercase`. Isso explica os dois sintomas de uma só vez:

- todo texto digitado sai em maiúsculas, mesmo com `normal-case` aplicado na tela;
- o cursor salta para o fim, porque reescrever `e.target.value` durante o `onChange` de um campo controlado descarta a posição do caret.

Ou seja, o ajuste anterior na tela não resolveu porque o problema está no componente base, não na tela.

## O que será feito

### 1. Opt-out de maiúsculas no textarea base
Adicionar ao textarea base uma propriedade opcional `preserveCase`. Quando ativada, o componente não converte o texto e não aplica a classe `uppercase`. Nenhum outro campo do sistema muda de comportamento — a regra de maiúsculas continua valendo em todo o resto.

Ativar essa propriedade apenas nas três caixas de mensagem de automação:
- criação de automação
- edição de automação
- edição em massa (campo Mensagem)

Com isso o texto passa a aceitar minúsculas e o cursor para de saltar.

### 2. Variável [NOME]
Padronizar o token visível como `[NOME]` (maiúsculo), mas continuar aceitando o que o usuário digitar manualmente em qualquer forma (`[nome]`, `{nome}`, `[Nome]`).

Acima da caixa de texto, nas três telas:
- botão pequeno "+ Inserir nome" que insere `[NOME]` exatamente na posição do cursor;
- texto de apoio curto explicando que a variável é trocada pelo primeiro nome do responsável no envio.

### 3. Prévia antes de salvar
Quando a mensagem contiver a variável, mostrar abaixo da caixa um bloco "Prévia" com a mensagem já resolvida com o primeiro nome do responsável selecionado. A prévia é recalculada na hora se o responsável for trocado.

### 4. Validação de salvamento
Se a mensagem contiver `[NOME]` e não houver responsável selecionado, exibir alerta na tela e bloquear o botão de salvar. Mensagens sem a variável não sofrem nenhuma validação nova.

Na edição em massa, onde a mensagem é aplicada a vários envios com responsáveis diferentes, o alerta é informativo: a substituição acontece por envio, usando o responsável de cada linha.

### 5. Substituição no envio
No envio automático, a variável é trocada pelo primeiro nome do responsável vinculado àquela automação, com apenas a primeira letra em maiúscula (`JOSA MARIA` -> `Josa`). Se o responsável for trocado depois, o nome usado passa a ser o novo automaticamente, porque a troca acontece no momento do envio e não no cadastro.

## Exemplo

Configurado:
```text
[NOME], encerrou o turno?

Registre agora no formulário de encerramento tudo o que aconteceu durante o período. 👊
```

Enviado:
```text
Josa, encerrou o turno?

Registre agora no formulário de encerramento tudo o que aconteceu durante o período. 👊
```

## Detalhes técnicos

- `src/components/ui/textarea.tsx`: nova prop `preserveCase?: boolean`; quando `true`, não roda `toUpperCase()` no handler e não adiciona a classe `uppercase`.
- `src/lib/mensagemPlaceholder.ts`: `NOME_TOKEN` passa a `[NOME]`; `aplicarPlaceholders` capitaliza o primeiro nome (`Primeira letra maiúscula, resto minúsculo`); nova função `contemNomeToken(texto)` para validação/prévia; `inserirToken` já existe e é reaproveitada.
- `src/pages/admin/CronogramaAutomacoes.tsx`, `src/components/cronograma-admin/NewAtividadeDialog.tsx`, `src/components/cronograma-admin/BulkEditDialog.tsx`: `preserveCase` no textarea, botão "+ Inserir nome" acima do campo, bloco de prévia e regra de bloqueio do salvar.
- `supabase/functions/send-cronograma-messages/index.ts`: ajustar a substituição já existente para capitalizar o primeiro nome; redeploy da função.
