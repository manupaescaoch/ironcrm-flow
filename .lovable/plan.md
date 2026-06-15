# Régua dinâmica de Follow-up de Matriculados

Substituir o uso direto dos registros `M+7` / `M+30` da tabela `follow_ups` por uma régua **calculada em tempo real** a partir da data de matrícula de cada aluno. Isso resolve o problema atual (alunos aparecendo como `M+7` com 28d de atraso) sem precisar reescrever histórico.

## Régua aplicada (dias desde a matrícula)

| Dias desde matrícula | Etapa exibida | Status visual            | Mensagem        |
|----------------------|---------------|--------------------------|-----------------|
| 0–1                  | D+1           | hoje / 0d atrasado       | Boas-vindas     |
| 2–7                  | D+7           | em Xd / hoje             | Acompanhamento D+7 |
| 8–15                 | D+7           | Xd atrasado              | Acompanhamento D+7 |
| 16–45                | D+30          | Xd atrasado / hoje       | Acompanhamento D+30 |
| > 45                 | —             | não aparece no painel    | nenhuma         |

Pontos-chave da regra:

- D+1 nunca é retroativo: só aparece para quem matriculou hoje ou ontem.
- Aluno antigo com >15d de atraso em D+7 migra automaticamente para D+30 (porque a etapa é recalculada a cada render a partir de "dias desde a matrícula", não de uma data prevista fixa).
- Aluno com mais de 45 dias de matrícula simplesmente não entra no painel.

## Fonte da data de matrícula

`data_fechamento` da interação mais recente do lead com `fechou_matricula = true`. Filtros aplicados:

- `leads.is_matriculado = true`
- `leads.ativo = true`
- `unidade_id = unidadeAtual.id`
- existe pelo menos uma `interacoes.fechou_matricula = true` com `data_fechamento` não nulo

Se houver mais de uma matrícula (renovações), usa a **mais recente** como referência.

## Controle de "já enviado" e reagendamento

Para que um aluno não reapareça depois que a recepção marcar o follow-up:

- Continua usando `public.follow_ups`, mas com `tipo IN ('D+1','D+7','D+30')` no contexto matriculado. O que diferencia do follow-up de lead é o campo `lead.is_matriculado = true`.
- Ao clicar **check**: upsert em `follow_ups` com `lead_id` + `tipo = etapa_calculada` + `status = 'concluido'` + `concluido_em = now()`.
- Ao montar o painel: oculta o aluno se já existir `follow_ups` (`lead_id`, `tipo = etapa_calculada`, `status = 'concluido'`).
- **Reagendar**: grava `data_prevista` futura com `status = 'pendente'`; enquanto essa data não chegar, o aluno fica fora do painel para aquela etapa.
- Se o aluno avançar para a próxima etapa (ex.: já estava em D+7 concluído e agora caiu na faixa D+30), ele volta a aparecer com a nova tag, porque a checagem de "concluído" é por `tipo`.

## Limpeza dos M+7 / M+30 antigos

Os ~105 `follow_ups` pendentes com `tipo IN ('M+7','M+30')` ficam ignorados pelo painel novo. Para não poluir relatórios, marcamos todos como `status = 'cancelado'` com `cancelado_motivo = 'migracao_regua_d'`. Nada é apagado.

## Mensagens (rascunho, ajustável)

- **D+1 — boas-vindas**
  "Oi, {nome}! Seja bem-vindo(a) à IRON CLUB. Tô passando pra confirmar sua matrícula e tirar qualquer dúvida do primeiro treino. Qualquer coisa, me chama por aqui."
- **D+7 — acompanhamento inicial**
  "Oi, {nome}! Faz uma semana desde sua matrícula na IRON. Como tá sendo a adaptação aos treinos? Se precisar ajustar algo ou tiver alguma dúvida, me fala."
- **D+30 — fechamento do primeiro mês**
  "Oi, {nome}! Já fechou um mês de IRON. Bora bater um papo rápido sobre evolução, frequência e próximos passos do seu treino?"

## Arquivos afetados

- `src/hooks/useFollowUpsMatriculados.ts` — reescrito. Passa a buscar matriculados + `data_fechamento` mais recente; calcula etapa via régua; filtra concluídos/reagendados por `tipo`.
- `src/components/dashboard/FollowUpMatriculadosSection.tsx` — usa as tags `D+1/D+7/D+30`, mensagens novas e faz upsert no check.
- `src/components/dashboard/FollowUpMatriculadosKPI.tsx` — sem mudança estrutural (recebe a nova contagem).
- Migração SQL — apenas para cancelar `follow_ups` antigos com `tipo IN ('M+7','M+30')` e `status = 'pendente'`.

## Fora do escopo

- Sem envio automático: WhatsApp continua manual (abre `wa.me` com mensagem preenchida).
- Não mexe no painel de follow-up de experimental (leads).
- Não altera a edge function `generate-follow-ups` (que cuida só do funil de leads).
