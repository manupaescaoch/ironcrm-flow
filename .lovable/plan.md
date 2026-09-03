# EVO OPS + evolução da página Operacional — Diagnóstico técnico (Etapa 1)

Nenhuma migration, nenhuma alteração de componente e nenhuma mudança de banco foi executada. Isto é apenas o diagnóstico e o plano.

## 1. O que já existe e pode ser reaproveitado

**Página Operacional** (`src/pages/Operacional.tsx`, 95 linhas) — abas Cronograma, Dashboard e Formulários. O peso está em `CronogramaTab.tsx` (1.342 linhas: grade semanal, replicação, edição em lote, filtros, soft delete via `ativo=false`) e em `OperacionalDashboard`.

**Banco (já existente, aproveitável):**
- `cronograma_atividades` — unidade, formulário, responsável, título, horário, dia_semana, turno, tipo_atividade, `mensagem`, `ativo`. Sem campos de execução.
- `cronograma_atividades_historico` — **já é uma tabela de auditoria** (atividade_id, user_id, user_name, campo, valor_anterior, valor_novo, bulk_operation_id) alimentada pelo trigger `trg_log_cronograma_changes`. Serve como o `ops_historico` pedido, sem criar tabela nova.
- `cronograma_funcionarios` — nome, telefone, setor, turno, `cargo`.
- `rotinas` + `rotina_atividades` + `rotina_execucoes` — já têm execução diária real (`data_execucao`, `concluida`, `concluida_por`, `concluida_em`, `observacao`, `foto_url`) e bucket `rotinas-comprovantes`. É a camada de execução de rotinas: será exibida no EVO OPS, não recriada.
- `tasks` + `task_history` + `task_comments` + `task_notifications` — módulo Gestão de Tarefas já com status, prioridade, prazo, recorrência, auditoria por trigger e notificações internas. Serve de referência de padrão (e o módulo continua como está).
- Autenticação, `user_roles` (admin, moderator→recepcao, user→comercial, coordenador, gerente), `user_unidades`, `get_user_unidades()`, `has_role()` — reaproveitados integralmente. Nenhum usuário, unidade ou Auth novo.

## 2. Lacuna crítica identificada

`cronograma_atividades.responsavel_id` aponta para `cronograma_funcionarios`, que **não é** um usuário do Auth. Hoje não existe vínculo entre funcionário do cronograma e conta de login. Sem esse vínculo, o EVO OPS não consegue responder "quais são as minhas tarefas de hoje".

Solução proposta (não destrutiva): adicionar `cronograma_funcionarios.user_id` (nullable, FK para o usuário) e uma tela simples de vinculação no CRM. Nada existente quebra; funcionários sem vínculo continuam funcionando como hoje.

## 3. Campos que faltam em `cronograma_atividades`

Nenhum equivalente existe hoje. Adicionar apenas colunas novas, todas com default compatível com registros antigos:

`status` (default `pendente`), `prioridade` (default `normal`), `iniciado_em`, `iniciado_por`, `concluido_em`, `concluido_por`, `prazo`, `exige_evidencia` (false), `exige_confirmacao` (false), `cancelado_por`, `cancelado_em`, `motivo_cancelamento`, `criado_por`, `descricao`, `instrucao`, `setor`.

Status: `pendente | em_andamento | concluida | atrasada | cancelada`. Prioridade: `baixa | normal | alta | critica`. `atrasada` será derivada (horário/prazo vencido sem conclusão), não persistida por cron.

Observação importante: atividades do cronograma são **recorrentes por dia da semana**. Execução precisa de data. Portanto a execução diária irá para uma tabela `ops_execucoes` (atividade_id + data), no mesmo modelo já usado por `rotina_execucoes` — os campos de status na atividade servem para o template/estado atual, e a execução do dia fica no registro diário. Isso evita duplicar linhas de cronograma.

## 4. Tabelas realmente novas

- `ops_execucoes` — execução diária da atividade (status, iniciado/concluído, cancelamento, motivo).
- `ops_comentarios` — comentários por atividade/execução.
- `ops_anexos` — evidências (bucket privado novo `ops-evidencias`).
- `ops_notificacoes` — central interna de alertas.
- `ops_push_subscriptions` — dispositivos para Web Push.

Reutilizadas em vez de criadas: `cronograma_atividades_historico` (auditoria) e `rotina_execucoes` (rotinas).

## 5. Auditoria, DELETE físico e cancelamento

- Auditoria: estender o trigger existente para cobrir os campos novos e ampliar o SELECT de `cronograma_atividades_historico` para gerente/recepção/comercial no escopo da unidade (hoje é só admin). Sem policy de UPDATE/DELETE em nenhum papel → auditoria imutável, inclusive para admin.
- DELETE físico: revogar a policy de DELETE de `cronograma_atividades` e remover o `GRANT DELETE`. O soft delete atual (`ativo=false`), usado pela edição em lote e pela RPC `admin_bulk_update_cronograma`, é preservado.
- Cancelamento: substitui exclusão. Exige `motivo_cancelamento`; grava `cancelado_por`/`cancelado_em`; status vira `cancelada`; registro permanece visível no histórico.

## 6. Permissões e escopo por unidade

Padrão já usado no projeto: `has_role()` + `get_user_unidades()`. Admin vê tudo; gerente vê a unidade; recepção e comercial veem as próprias tarefas e as do seu setor na unidade. Escrita de execução restrita ao responsável ou a admin/gerente da unidade. Frontend esconde ações, RLS bloqueia de fato.

## 7. WhatsApp — o que muda e o que não muda

Não muda nada em Automações, Z-API/D-API, follow-ups, webhooks, templates ou crons comerciais.

`cronograma_atividades.mensagem` **tem dependência ativa**: `send-cronograma-messages` roda a cada 3 minutos e monta a mensagem a partir desse campo. O campo é mantido, com o mesmo nome e a mesma função. A mudança é apenas de interface: "Ação WhatsApp" passa a "Ação da Atividade" com as opções Vincular formulário, Adicionar instrução, Exigir confirmação, Exigir evidência, Observação — e o envio por WhatsApp continua disponível como uma dessas ações, para não quebrar as 20 rotinas que dependem dele.

## 8. EVO OPS, PWA e Web Push

O projeto hoje não tem manifest nem service worker. O EVO OPS será uma área nova em `/ops`, com layout próprio (header + bottom navigation: Meu Dia, Cronograma, Tarefas, Alertas), mesma autenticação, estética minimalista clara (#F5F5F7 / #111111 / azul EVO como ação). PWA instalável com manifest, ícones e service worker registrados apenas em produção (nunca no preview). Web Push com chaves VAPID guardadas no backend, disparos: nova tarefa, lembrete 30 min antes, atraso e escalonamento para o gerente em tarefa crítica.

## 9. Riscos

1. `mensagem` e o cron de 3 minutos — mitigado mantendo o campo e o fluxo.
2. Cronograma recorrente sem data de execução — mitigado por `ops_execucoes`.
3. Responsável ≠ usuário — mitigado por `cronograma_funcionarios.user_id`.
4. Remoção do DELETE pode afetar telas que chamam delete direto — auditar chamadas antes (hoje as telas já usam soft delete).
5. Service worker servindo HTML velho — mitigado com registro só em produção.
6. Volume de push — regras limitadas às 4 previstas, com deduplicação por dia.

## 10. Plano por etapas

2. Banco e auditoria (colunas novas, `ops_*`, RLS, GRANTs, bloqueio de DELETE, `user_id` do funcionário).
3. Execução de tarefas (iniciar/concluir, evidência, confirmação).
4. Cancelamento com motivo, sem DELETE.
5. EVO OPS `/ops` + Meu Dia.
6. Cronograma e Tarefas mobile.
7. Notificações internas (sino + Alertas).
8. PWA.
9. Web Push.
10. Visão de gestão no CRM (status, atraso, filtros, resumo por unidade, seção Atenção).
11. Preparação da API segura para o Hermes.

Cada etapa é implementada, testada e apresentada antes da próxima.
