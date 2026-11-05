# Mapeamento final — 05/11/2026

Somente leitura em produção; nenhum endpoint, segredo, dado, permissão, agendamento ou interface alterado. Nenhuma automação executada manualmente. Backup de 05/11 confirmado pelo usuário; restauração não ensaiada independentemente.

## Agendamentos atuais

15 ativos e 1 inativo em cron.job. Horários abaixo em UTC.

| ID | Função | Agenda | Credencial enviada |
|---|---|---|---|
| 10 | notify-resumo-semanal-crm | sábado 21:00 | Bearer JWT com papel anon; sem x-cron-secret |
| 20 | confirmacao-experimental-automatica | cada 15 min | get_cron_secret() → app_config.cron_secret |
| 26 | notify-resumo-gestao-operacional | diário 11:00 | configuração do banco |
| 28 | daily-crm-backup | diário 05:00 | configuração do banco; handler aceita somente BACKUP_CRON_SECRET ou admin JWT |
| 29 | notify-task-deadlines | cada 15 min | configuração do banco |
| 30 | notify-feedback-experimental | cada 30 min | configuração do banco |
| 31 | notify-boas-vindas-matricula | cada 30 min | configuração do banco |
| 32 | send-cronograma-messages | cada 3 min | configuração do banco |
| 33 | send-follow-ups-automaticos | seg–sex 12:00 | configuração do banco |
| 35 | healthcheck-follow-ups | seg–sex 12:35 | configuração do banco |
| 36 | send-follow-ups-automaticos | seg–sex 13:30 | x-cron-secret literal diferente da configuração atual do banco; igualdade com BACKUP_CRON_SECRET não verificada |
| 37 | cron-contas-pagar-vencimento | diário 13:00 | apikey; sem x-cron-secret; fora do escopo de alteração |
| 38 | cron-contas-pagar-fila | cada 5 min | apikey; sem x-cron-secret; fora do escopo de alteração |
| 39 | telegram-webhook-guard | cada hora, minuto 07 | configuração do banco |
| 40 | presenca-experimental-telegram | cada 5 min | configuração do banco |
| 21 (inativo) | retry-anamneses-pendentes | cada 5 min | configuração do banco |

11 dos 15 ativos enviam a configuração do banco. A comparação anterior registrou banco = CRON_JOB_SECRET e BACKUP_CRON_SECRET diferente; não foi reexecutada comparação dos segredos nesta etapa.

Quatro emissores SQL com triggers identificados: fu_matriculados_nova_matricula → notify-boas-vindas-matricula; notify_experimental_presenca_http → presenca-experimental-telegram; notify_nps_resposta_http → notify-nps-resposta; notify_ops_push_http → ops-push-send. Todos enviam a configuração do banco. Não são quatro agendas extras.

Chamadas internas adicionais: anamnese-publica e retry-anamneses-pendentes enviam BACKUP_CRON_SECRET para notify-anamnese-experimental; submit-formulario-publico envia BACKUP_CRON_SECRET para notify-formulario-encerramento. notify-rotinas-diarias e daily-crm-backup também leem BACKUP_CRON_SECRET diretamente. ops-push-send, telegram-comunicado e experimentalPresencaBotoes leem a configuração do banco; os botões acionam o REAG existente, que não será alterado. As 21 funções da regra compartilhada aceitam ambos os segredos.

## Divergências e limites

- O resumo semanal CRM tem consumidor ativo identificado: job 10. O handler atual é aposentado/sem envio; usa anon Bearer, não uma chave de automação válida. Nenhuma desativação feita.
- notify-resumo-semanal-pergunta, notify-rotinas-diarias e send-formulario-lembretes não têm agendamento atual encontrado; retry-anamneses-pendentes tem agenda inativa. Consumidores externos não inventariáveis pelo repositório precisam ser confirmados pelo responsável.
- Backup diário envia a chave do banco para um handler que exige BACKUP_CRON_SECRET diferente: incompatibilidade de credencial a esclarecer antes da implantação/rotação. A confirmação do backup pelo usuário não prova o sucesso desse job específico.
- As últimas execuções SQL de todos os jobs ativos constam succeeded; isso confirma submissão HTTP, não sucesso do endpoint. Há uma resposta HTTP 403 às 05:00 UTC sem atribuição inequívoca ao backup; logs específicos não retornaram entradas. Não foi inferida correlação definitiva apenas por horário.
- O literal do job 36 não coincide com o banco. Identificar sua correspondência com BACKUP_CRON_SECRET exige comparação segura ainda não disponível nesta leitura.
- O candidato contém apenas funções puras injetáveis, sem exports/adaptadores compatíveis com o helper atual nem patches para os 19 handlers. Não está pronto para implantação direta.
- notify-rotinas-diarias possui autorização paralela por literal fixo que a mudança do helper não elimina.

## Testes e quatro administrativas

10/10 testes Deno aprovados com valores fictícios. Admin passa, usuário comum recebe 403, ambas as chaves passam e chave revogada falha no protótipo. Não são testes integrados dos endpoints ou da interface. As quatro administrativas são notify-task-deadlines, send-confirmacao-recepcao, send-fu-digest-comercial e notify-resumo-gestao-operacional; as demais quatro chamadas legítimas do aplicativo devem manter JWT com papel/unidade próprios. Com ambas as chaves ausentes, o protótipo bloqueia inclusive admin com 500; compatibilidade deve ser definida e testada antes de substituir o helper.

## Sequência proposta — depende de autorização e pacote completo

1. Completar os adaptadores e os 19 patches fora da implantação; capturar versões exatas atuais para reversão e testar integração com agendas, triggers, admin e unidade em ambiente isolado.
2. Resolver o Bearer anon do job 10, a credencial literal do job 36 e a incompatibilidade do backup; confirmar consumidores externos/sem agenda. Qualquer mudança de agenda ou endpoint fora dos 19 exige aprovação própria.
3. Após autorização, implantar individualmente as quatro administrativas: notify-task-deadlines → send-confirmacao-recepcao → send-fu-digest-comercial → notify-resumo-gestao-operacional. Validar negativas sem efeitos e acompanhar ciclos naturais; ações legítimas somente em ambiente isolado, sem envio de teste real.
4. Implantar as onze cron-only: confirmacao-experimental-automatica → healthcheck-follow-ups → notify-feedback-experimental → notify-nps-resposta → notify-resumo-semanal-crm → notify-resumo-semanal-pergunta → notify-rotinas-diarias → presenca-experimental-telegram → retry-anamneses-pendentes → send-cronograma-messages → send-formulario-lembretes. Não avançar com credencial/consumidor não resolvido; não reativar agendas ausentes.
5. Implantar as quatro com JWT e vínculo de unidade: ops-notify-task → send-task-whatsapp → notify-anamnese-experimental → notify-formulario-encerramento; validar formulários e ações legítimas isoladamente. Conferir resposta/leitura sem envio em produção e observar uso natural.
6. Rotação é etapa separada e não autorizada. Só planejar após mapa completo: manter as duas chaves atuais enquanto introduz a nova, migrar consumidores do banco e literais, depois consumidores exclusivos de BACKUP. Revogar todas as chaves anteriores em todos os armazenamentos/literais; manter somente uma das antigas não revoga a outra.

Interromper diante de 401/403 inesperado em serviço legítimo, falha de unidade/papel, export incompatível ou comportamento de mensagem alterado. Reverter somente o endpoint recém-implantado ao artefato anterior exato, na ordem inversa, sem reprocessar filas nem restaurar dados operacionais. Reversão reintroduz a vulnerabilidade original e exige contenção/aprovação; não usar restauração integral do banco como reversão de código. Sem rotação nesta implantação, não há troca de chave para desfazer.