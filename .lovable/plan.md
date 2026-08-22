# Pausar Follow-up e Migrar Unidade no perfil do lead

## Objetivo
No perfil do lead, permitir (1) pausar/retomar os follow-ups automáticos e (2) transferir o lead de uma unidade para outra.

## 1. Pausar FU
- Novo campo no lead: `pausado_fu` (sim/não) + quem pausou e quando.
- Botão no cabeçalho do perfil: "Pausar FU" / "Retomar FU", com selo visível quando pausado.
- Ao pausar: os follow-ups automáticos (confirmação de experimental, D+1/D+7/D+15/D+30, boas-vindas, feedback pós-experimental) deixam de ser enviados para esse lead.
- Ao retomar: os envios voltam a seguir a régua normal, sem reenviar o que já venceu durante a pausa.
- Envio manual pelo painel continua possível, com aviso de que o lead está pausado.

## 2. Migrar unidade
- Ação "Migrar unidade" no menu do perfil, com diálogo para escolher a unidade de destino (apenas unidades às quais o usuário tem acesso) e um motivo opcional.
- A migração atualiza a unidade do lead e, em cascata, das interações e follow-ups pendentes do lead, para que ele apareça no CRM da unidade correta.
- Verificação de duplicidade: se já existir lead com o mesmo telefone na unidade de destino, a migração é bloqueada com mensagem clara (a regra atual de duplicidade é por unidade).
- Registro da migração no histórico do lead (unidade de origem, destino, usuário e data).

## Detalhes técnicos
- Migração de banco: `leads.pausado_fu boolean not null default false`, `leads.pausado_fu_em timestamptz`, `leads.pausado_fu_por uuid`.
- Filtro `pausado_fu = false` (ou `is.not.true`) nas edge functions: `send-follow-ups-automaticos`, `confirmacao-experimental-automatica`, `notify-feedback-experimental`, boas-vindas de matrícula.
- Novo RPC `migrar_lead_unidade(p_lead_id, p_unidade_destino, p_motivo)` (security definer) que valida acesso via `user_has_unidade_access`, checa duplicidade por `canonical_phone` na unidade destino e atualiza `leads`, `interacoes`, `follow_ups`.
- UI: alterações em `src/pages/LeadDetail.tsx` mais um novo `src/components/lead/MigrarUnidadeDialog.tsx`; unidades vindas de `useUnidade()`.
- Hooks de FU (`useFollowUpsMatriculados`, `useFollowUpsGerente`, `useDashboardFollowUps`) passam a marcar/ocultar leads pausados.
