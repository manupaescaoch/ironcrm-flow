# Fase 1E — preparação isolada

Não aplicar candidatos nem implantar/publicar sem aprovação explícita. Não enviar mensagens reais.

Os candidatos de confirmação e evidência continuam em `../fu-phase1d/`. `moderator` pode confirmar BV/M+3/M+32 de Recepção na unidade vinculada; não recebe autorização Técnica, Gerencial ou Comercial D+. Nenhuma RLS genérica é ampliada.

## Liberação

`VITE_FU_CRM_CONFIRMATION_ENABLED=true` e `VITE_FU_CRM_CONFIRMATION_TEST_USERS=<UUIDs separados por vírgula>` são necessários simultaneamente. Ausência da flag ou lista vazia mantém a nova confirmação desligada. Funciona independentemente de DEV, inclusive em produção. A lista é pública, não contém segredo e não substitui JWT/SQL. Comercial mantém o caminho legado quando desligada; REAG sempre permanece legado. Mudança destes valores exige nova versão da interface; não é um interruptor remoto.

## Ambiente descartável

`prepare.py` exporta **somente estrutura** via conexão gerenciada de leitura e restaura em `/tmp/fu-phase1e`, socket local e porta 55441, com Auth sintético e HTTP externo inerte. Mantém tabelas públicas, relacionamentos, funções, índices, constraints, triggers, RLS e grants exportados, sem dados pessoais. Plataforma Auth é scaffolding, não o serviço hospedado. O dump fica apenas em `/tmp`.

`structural.py` usa exclusivamente esse socket. `integration_test.ts` utiliza chaves efêmeras locais e o verificador JWT real do SDK, handler candidato, transporte local e SQL real. Nenhum token de funcionário é utilizado.

## Telegram

Roteamento/callbacks e destinos intactos. `telegram-scope.candidate.sql` prepara somente substituições de três RPCs: consulta direta de vínculo em `user_unidades` dentro da função service-only (o helper atual exige `auth.uid()` e bloqueia o serviço sem JWT de usuário); Recepção inclui moderator somente BV/M+3/M+32. Papéis Técnico/Gerencial intactos, demais validações de matrícula/grupo/mensagem preservadas. Estas substituições são exclusivamente candidatas locais, não alterações de produção. Sem reenvio nem histórico novo após confirmação CRM.