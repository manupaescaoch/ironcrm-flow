# Fase 5 — Homologação geral (04/11/2026)

Somente leitura no banco. Nada publicado, nenhuma alteração em RLS, grants, funções, dados, integrações ou automações.

## Testes
- 113 testes automáticos (14 arquivos, Fases 1–4) aprovados, 0 falhas.
- Fase 1: configuração do piloto ausente → endpoints `fu-crm-confirmar-envio` e `fu-comercial-confirmar` continuam bloqueados (403), sem usuários liberados.
- Não executado: login real por perfil (não existem contas de teste por perfil; perfis "Recepção"/"Comercial" não são papéis próprios — usam `moderator`/`user`).

## Vulnerabilidades confirmadas (pela definição no banco)
| Gravidade | Item | Risco |
|---|---|---|
| Crítica | `get_cron_secret()` executável por qualquer usuário logado, sem checagem | Revela o segredo das automações; permite acionar crons/envios |
| Alta | `admin_cleanup_duplicate_leads`, `admin_standardize_origem`, `admin_standardize_treinador`, `admin_update_cadastrador` sem checagem de admin | Qualquer usuário logado inativa leads ou renomeia dados de todas as unidades, contornando proteções |
| Média | `task_history` INSERT só exige estar logado | Insere histórico falso em tarefa de outra unidade, com `user_id`/`user_name` de outra pessoa (alterar/apagar não é possível) |
| Média | `get_user_phone_by_name` | Expõe telefone de funcionários a qualquer logado |
| Baixa | `generate_follow_ups_for_lead`, `claim/release_whatsapp_envio`, `reservar_envio_conta` sem checagem | Escrita indevida limitada (D+30 bloqueado por trigger) |
| Baixa | `encerramento_tecnico_arquivar` (anônimo) | Só copia snapshot ao histórico; necessário ao formulário público, sem exclusão |

Necessárias/protegidas: `has_role`, `get_user_unidades`, `user_has_unidade_access`, `folha_*`, `ops_*`, `admin_*cron*`, `admin_bulk_update_cronograma`, `inativar_aluno`, `migrar_lead_unidade`, `submit_nps_resposta` e `encerramento_tecnico_existente` (formulários públicos).

## Correções pendentes de autorização (mínimas)
1. `REVOKE EXECUTE ON get_cron_secret FROM anon, authenticated` (uso só pelo servidor).
2. Adicionar `IF NOT has_role(auth.uid(),'admin') THEN RAISE` nas 4 funções `admin_*`.
3. Política INSERT de `task_history`: exigir `user_id = auth.uid()` e acesso à unidade da tarefa.
4. Revogar `get_user_phone_by_name` e funções de reserva de envio de `authenticated` após confirmar que só o servidor as chama.

## Pendências de homologação
- Contas de teste por perfil/unidade para validar acessos reais.
- Teste restrito do botão Enviado: requer autorização para criar a configuração do piloto com a conta de teste.

## Checklist de publicação
1. Aprovar/aplicar itens 1–2 (antes de publicar).
2. Build OK + 113 testes.
3. Publicar interface; conferir login, Dashboard, CRM e troca de unidade.
Reversão: republicar versão anterior pelo histórico; correções SQL revertem restaurando a definição/grant original salva.
