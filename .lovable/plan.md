
Objetivo: corrigir os 2 problemas do print: (1) comercial não consegue lançar Escala; (2) Rotinas da recepção chegam atrasadas/em lote.

Diagnóstico confirmado
- Escala: o frontend já libera comercial (`canEditEscala`), mas as regras de banco da tabela `escala` ainda permitem inserir/editar/excluir só para admin/coordenador.
- Rotinas: o envio diário está concentrando mensagens e há falhas silenciosas de envio quando o responsável não é resolvido corretamente por nome/telefone.

Plano
1) Corrigir permissão de Escala no banco (migração)
- Atualizar políticas de INSERT/UPDATE/DELETE da tabela `public.escala` para incluir comercial (`app_role = 'user'`).
- Restringir por unidade para segurança:
  - admin: acesso total;
  - coordenador/comercial: apenas `unidade_id IN get_user_unidades(auth.uid())`.
- Manter política de SELECT atual.

2) Corrigir confiabilidade das notificações de Rotinas
- Ajustar `notify-rotinas-diarias` para:
  - respeitar frequência/dia da rotina antes de enviar;
  - manter bloqueio de envio para rotina já concluída no dia;
  - registrar logs claros de: elegíveis, ignoradas, enviadas e falhas.
- Ajustar `send-task-whatsapp` para:
  - melhorar match de responsável (normalização robusta de nome + fallback);
  - retornar status explícito (`sent`, `user_not_found`, `no_phone`, `provider_error`).

3) Expor falhas reais no app (sem erro silencioso)
- Em `useRotinasData`, ao enviar WhatsApp na criação da rotina, validar retorno da função e mostrar toast quando não enviar.
- No fluxo de Escala (incluindo importação), usar mensagens amigáveis de permissão para o usuário saber exatamente o motivo.

Validação fim a fim
- Login com comercial: criar/editar/excluir/importar Escala.
- Criar rotina para recepção e validar envio imediato.
- Executar envio diário e confirmar que não há disparo indevido/em rajada.
- Confirmar botão WhatsApp continua atualizando execução da rotina corretamente.
