## Objetivo

Fazer com que, ao disparar uma atividade do Cronograma Operacional do tipo "ENVIO DA GRADE DE HORÁRIO PARA COORDENADOR DE HORÁRIO", a edge function gere automaticamente uma variação aleatória de título e frase principal, mantendo intactos unidade, horário, responsável e (quando presente) coordenador de horário.

## Escopo

Alteração apenas em `supabase/functions/send-cronograma-messages/index.ts`. Nenhuma mudança em banco, horários, responsáveis, unidades ou em qualquer outro disparo. As linhas atualmente salvas no campo `cronograma_atividades.mensagem` continuam sendo o "valor base" — extraímos os dados dinâmicos dela e regeneramos a mensagem com variação.

## Como identificar a tarefa

Critério na edge function:
- `atividade.titulo` contém (case-insensitive) `"GRADE DE HORÁRIO"`, OU
- `atividade.mensagem` contém `"Grade do próximo horário"`.

Quando bate, ignoramos o texto fixo salvo e geramos a versão variada.

## Dados dinâmicos usados

- **Nome do responsável**: `resp.nome` (primeiro nome).
- **Unidade**: `unidadeMap.get(atividade.unidade_id)`.
- **Horário da grade**: `atividade.horario.substring(0,5)`.
- **Coordenador de horário**: extraído da `atividade.mensagem` salva via regex (`/Coordenador de horário[:\*\s]+([^\n]+)/i`). Se não houver, a linha do coordenador é simplesmente omitida — sem inventar nome.

## Geração da mensagem

Nova função `generateGradeMessage({ nome, unidade, horario, coordenador })`:

1. Sorteia um par `(titulo, fraseAbertura)` entre as 12 variações fornecidas pelo usuário (📋 Conferência da próxima grade, 🧭 Alinhamento do próximo horário, 📌 Próximo horário chegando, ✅ Checagem da grade, 📋 Organização do próximo horário, 🕒 Preparação da próxima grade, 📍 Alinhamento de horário, ⚡ Hora de alinhar a grade, 📋 Grade em conferência, 🧠 Organização antes da entrada, 📌 Próxima grade no radar, ✅ Conferência antes do horário).
2. Sorteia uma frase de fechamento entre as variações ("Se tiver alguma pendência, resolve antes do início do horário.", "Qualquer pendência, ajusta agora para não virar problema depois.", "Se tiver algo fora do lugar, resolve antes da entrada dos alunos.", "Se aparecer alguma pendência, ajusta antes do horário começar.", "Pendência vista antes vira ajuste. Pendência vista depois vira dor de cabeça.", "Se tiver algo pendente, resolve agora.", "Qualquer ajuste necessário, faz antes do início.", "Não deixa pendência passar para o próximo horário.", "Pendência identificada agora já precisa ser resolvida.").
3. Monta:

```
{titulo}

{primeiroNome}, {fraseAbertura usando {horario_grade}}

📍 Unidade: {unidade}
🕒 Horário da grade: {horario}
🧭 Coordenador de horário: {coordenador}   ← apenas se existir

{fraseFechamento}
```

## Integração no fluxo existente

Dentro do loop de envio (`for (const atividade of atividadesNaJanela)`), antes do bloco `else if (atividade.mensagem)`:

```ts
const isGrade =
  /grade de hor[áa]rio/i.test(atividade.titulo || '') ||
  /grade do pr[óo]ximo hor[áa]rio/i.test(atividade.mensagem || '');

if (isGrade) {
  const coordMatch = (atividade.mensagem || '').match(
    /Coordenador de hor[áa]rio[:\*\s]+([^\n*]+)/i
  );
  message = generateGradeMessage({
    nome: resp.nome,
    unidade: unidadeNome,
    horario: atividade.horario?.substring(0, 5) ?? '',
    coordenador: coordMatch ? coordMatch[1].trim() : null,
  });
}
```

A verificação de whey continua antes; a de grade vem em seguida; depois mantém-se o `else if (atividade.mensagem)` para todas as outras atividades.

## Garantias

- Nenhum dado cadastrado é alterado (somente leitura).
- Horário, unidade, responsável e coordenador continuam corretos.
- Aleatoriedade via `Math.random()` — cada disparo escolhe uma combinação diferente.
- Rate limit, status check Z-API, logs e tabela `cronograma_envios` permanecem como estão.

## Validação

1. Inspecionar o `console.log` da função após próximo disparo natural.
2. Disparo manual via `force_hour` para qualquer horário `:40` e conferir nas mensagens recebidas que o título e a abertura variam, e que unidade/horário/coordenador batem com o cadastro.
