# Correções finais de segurança — preparadas, NÃO aplicadas (04/11/2026)

Arquivos: `correcoes.candidate.sql` + `apply-guards.sql` (aplicar), `originais.sql` (reversão), `run-isolated.sh` + `assert_after.py` (ensaio).

## Consumidores legítimos identificados
- `get_cron_secret`: crons (postgres), funções internas SECURITY DEFINER (notify_*_http, fu_*), `ops-push-send` (service_role). Interface: nenhum uso.
- 4 funções `admin_*`: só `cleanup-duplicates` (service_role). Interface: nenhum uso direto.
- `task_history`: gravado só pelo trigger `log_task_changes` (SECURITY DEFINER); interface apenas lê; `delete-user` usa service_role.
- Telefones/reservas (`get_user_phone_by_name`, `claim/release_whatsapp_envio`, `reservar_envio_conta`, `generate_follow_ups_for_lead`): só endpoints com service_role ou funções internas.

## Ensaio isolado (banco local descartável)
- Antes: logado comum leu o segredo, executou função admin e forjou histórico em outra unidade (vulnerabilidades reproduzidas).
- Depois: 36/36 aprovados — bloqueios para anon/comum; admin, service_role, cron, funções internas e trigger continuam funcionando.

## Rotação da chave
Recomendada (lida por qualquer logado até a correção). Exige trocar juntos o valor em `app_config.cron_secret` e o secret `CRON_SECRET` usado por 7 endpoints; aplicar somente após a correção 1 e com autorização (alteração de dado de produção).

## Implantação (após autorização)
1. Migração única: `correcoes.candidate.sql` + `apply-guards.sql`.
2. Verificar: grants via `has_function_privilege`; cron de 15 min e push retornam 200; limpeza de duplicados (admin) funciona; edição de tarefa grava histórico.
3. Rotacionar a chave (app_config + secret) e conferir próximo cron.
Interromper se qualquer cron retornar 401/403 ou o histórico parar de gravar.

## Reversão
Executar `originais.sql`, restaurar EXECUTE para anon/authenticated nas 10 funções e recriar a política `insert_task_history_system`; remover `admin_assert_admin`.
