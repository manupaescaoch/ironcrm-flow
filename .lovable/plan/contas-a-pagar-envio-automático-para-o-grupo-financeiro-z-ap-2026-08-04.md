# Contas a Pagar — envio automático para o grupo financeiro (Z-API Comercial)

## O que já foi confirmado no código

- As credenciais da Z-API Comercial **já estão como secrets** no backend: `ZAPI_COMERCIAL_INSTANCE_ID`, `ZAPI_COMERCIAL_TOKEN`, `ZAPI_COMERCIAL_CLIENT_TOKEN`. Nenhuma tabela ou tela guarda ou lê essas credenciais — não há nada para "mover". O helper `supabase/functions/_shared/zapi.ts` já resolve o canal `comercial` (Z-API) e tem `sendText`, `checkZapiStatus` e `logEnvio` (grava em `whatsapp_envios_log`).
- `unidade_whatsapp_config` guarda apenas IDs de grupos (`grupo_fu_id`, `grupo_anamnese_id`) — nunca credenciais. É o padrão que o grupo financeiro vai seguir.
- `contas_pagar` tem: `descricao`, `fornecedor`, `valor`, `data_vencimento`, `forma_pagamento` (boleto/pix/transferencia/cartao/debito_automatico/dinheiro/outro), `linha_digitavel`, `codigo_barras`, `chave_pix`, `codigo_pix`, `status` (pendente/paga/cancelada), `deleted_at`, `unidade_id`. **Não existem hoje campos de banco/agência/conta/favorecido** — só `fornecedor`.
- O cadastro acontece no cliente (`useContasPagar.ts` → `insert` em `contas_pagar`), retornando a linha inserida.

## Banco de dados (uma migração)

1. `contas_pagar`: adicionar colunas opcionais `banco`, `agencia`, `conta_bancaria`, `favorecido` (texto), usadas quando a forma é transferência — necessárias para o template.
2. Nova tabela `contas_pagar_envios` (fila + histórico), com RLS por unidade e GRANTs:
   - `conta_id`, `tipo_envio` (`CADASTRO` | `VENCIMENTO`), **unique (conta_id, tipo_envio)**
   - `status`: `aguardando_envio` | `enviando` | `enviado` | `falhou` | `cancelado_pago` | `cancelado_cancelada`
   - `tentativas`, `proxima_tentativa_em`, `ultima_tentativa_em`
   - `instancia_id` (só o Instance ID, nunca token), `grupo_destino`, `zapi_message_id`, `mensagem_enviada`, `erro_msg`
   - leitura para usuários da unidade; escrita só pelo backend (service role)
3. `unidade_whatsapp_config`: colunas `grupo_contas_pagar_id` / `grupo_contas_pagar_nome`. Como o grupo financeiro é único para todas as unidades, também haverá fallback global via secret `WHATSAPP_GRUPO_CONTAS_PAGAR` — mesma abordagem já usada nos grupos de anamnese.
4. Reserva atômica de envio: função `reservar_envio_conta(conta_id, tipo)` (security definer) que faz `INSERT ... ON CONFLICT DO NOTHING` e um `UPDATE ... WHERE status IN ('aguardando_envio','falhou')` retornando a linha — garante que clique duplo ou dois crons paralelos nunca gerem dois envios.
5. Cancelamento automático: trigger em `contas_pagar` que, ao marcar `paga`/`cancelada`/`deleted_at`, muda o envio `VENCIMENTO` ainda `aguardando_envio`/`falhou` para `cancelado_pago`/`cancelado_cancelada`.

## Resolução do ID do grupo (uma única vez)

Edge function `resolve-grupo-contas-pagar` (admin-only): recebe o link de convite, consulta a Z-API Comercial (`group-invitation-metadata?url=...`, com fallback para `join-group` caso a instância ainda não seja membro), extrai o `phone`/`groupId` do grupo e grava em `unidade_whatsapp_config` / secret. Depois disso, todos os envios usam somente o ID armazenado; o link nunca é usado de novo. A função devolve apenas nome e ID do grupo — nunca credenciais.

## Edge functions de envio

- `send-conta-pagar-whatsapp` (núcleo): recebe `conta_id` + `tipo_envio`, **reconsulta a conta no banco** (aborta se paga/cancelada/excluída), reserva o envio, monta a mensagem, verifica `checkZapiStatus` do canal comercial (se a integração estiver fora, grava erro e não usa outra integração), envia com `sendText` para o ID do grupo, grava resultado em `contas_pagar_envios`, em `whatsapp_envios_log` e uma linha em `contas_pagar_historico`. Em falha: `tentativas+1`, `proxima_tentativa_em = now() + 5min`, status `falhou` após a 3ª tentativa.
- `cron-contas-pagar-vencimento`: diária, busca todas as contas de todas as unidades com `data_vencimento = hoje` (America/Sao_Paulo), `status = 'pendente'`, `deleted_at is null`, sem envio `VENCIMENTO` concluído, e dispara **uma mensagem por conta** (com intervalo entre envios para proteger o chip).
- `cron-contas-pagar-fila`: a cada 5 minutos, reprocessa envios `falhou`/`aguardando_envio` com `proxima_tentativa_em <= now()` e `tentativas < 3`.
- Agendamento real via `pg_cron` + `pg_net` (insert tool, não migração): 10:00 BRT = `0 13 * * *` UTC para o diário, `*/5 * * * *` para a fila.

## Mensagem

```text
*{NOME_DA_UNIDADE}*

Descrição: {DESCRIÇÃO EM CAIXA ALTA}
Vencimento: {dd/mm/aaaa}

{TIPO_DE_PAGAMENTO}:
{DADO_PARA_PAGAMENTO}

Valor: R$ 149,99
```

- Nome da unidade lido de `unidades` pelo `unidade_id` da conta (nunca fixo).
- Pix → `Pix:` + `codigo_pix` ou `chave_pix` **copiados byte a byte**, sem trim, sem quebra, sem reformatação. Boleto → `Linha digitável:` preservando os espaços originais. Transferência → `Transferência:` com banco, agência, conta e favorecido. Sem dado → `Forma de pagamento: Outro` e `Dados para pagamento não informados.`
- Valor formatado `pt-BR`. Nunca incluir categoria, responsável, dados internos ou links.

## Frontend

- Após o insert bem-sucedido, `useContasPagar` chama `send-conta-pagar-whatsapp` com `tipo_envio: CADASTRO`. A falha do WhatsApp **nunca** falha o cadastro.
- `SucessoConta` / toast: "Conta cadastrada com sucesso. Mensagem enviada ao grupo do WhatsApp." ou "Conta cadastrada com sucesso, mas não foi possível enviar a mensagem ao grupo." + botão "Tentar enviar novamente".
- `ContaDetalhesDrawer`: bloco "Envios ao WhatsApp" com tipo, data/hora, grupo, instância, status, tentativas e motivo do erro; botão "Reenviar para o WhatsApp" visível apenas para Admin e Comercial (`can_manage_contas_pagar`).
- Nenhum erro exibido ao usuário conterá token ou client-token — o backend devolve mensagens sanitizadas.
- Edição não reenvia a mensagem de cadastro; o cron das 10h sempre lê os dados atuais, então mudança de valor/data é absorvida automaticamente.

## Precisa de você

O grupo financeiro é **um só para as duas unidades** (Madalena e Boa Viagem) ou cada unidade tem o seu grupo? Vou implementar assumindo **um grupo único** (com suporte a override por unidade já pronto no banco) se não houver correção.
