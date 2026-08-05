# Correções de segurança e pontas soltas

Plano derivado da auditoria. Ordem = risco. Cada etapa é independente; posso executar só as que você aprovar.

## Etapa 1 — Crítico: fechar `notify-nps-resposta`
Hoje qualquer pessoa pode chamar a função com o `id` de uma resposta e disparar mensagem no grupo da unidade.

- Passar a exigir autorização: aceitar chamada interna (segredo de servidor) ou JWT válido, reusando o helper `_shared/cronAuth.ts`.
- Validar que `id` é UUID antes de qualquer consulta.
- Ajustar `NpsPublico.tsx` para não chamar a função direto do navegador — o disparo passa a sair do lado servidor (a partir da RPC de submissão ou de uma função interna encadeada), mantendo o fluxo atual de "uma mensagem só para o grupo".
- Remover o código morto de `RESPONSAVEIS` / `findCoordenador` que não envia mais nada.

## Etapa 2 — Alto: webhook do resumo semanal
`resumo-semanal-webhook-resposta` autentica comparando um campo do próprio payload e loga o payload completo.

- Exigir `x-webhook-secret` (comparação em tempo constante) ou validação canônica por `instanceId` + `messageId`, no mesmo padrão já usado em `rotina-whatsapp-response`.
- Parar de logar o payload cru; logar apenas telefone mascarado e campos necessários.
- Conferir se os IDs fixos de unidade (ZN/ZS) ainda correspondem às três unidades EVO; se não, buscar por `unidade_id` real.

## Etapa 3 — Alto: segredo de cron hardcoded
`get_cron_secret()` devolve um valor fixo escrito no código (um e-mail), usado como `x-cron-secret` pelos jobs agendados, enquanto as functions validam `BACKUP_CRON_SECRET`.

- Gerar um segredo forte e passar a função a ler o valor do cofre em vez de retornar literal.
- Confirmar que todos os jobs pg_cron passam a autenticar pelo mesmo segredo que as functions esperam (evita job silenciosamente rejeitado).

## Etapa 4 — Alto: anti-flood no NPS e nos encerramentos públicos
- NPS: limitar respostas por WhatsApp em janela de tempo (mesmo número não grava várias vezes seguidas) dentro da RPC de submissão, retornando erro amigável.
- `encerramento_turno_respostas`: restringir o INSERT público (janela por unidade/turno) para impedir inserção em massa de encerramentos falsos.

## Etapa 5 — Alto: metadados da marca
- `index.html`: título, description, `og:*` e `twitter:*` passam de "CRM IRON CLUB" para EVO TRAINING CLUB CRM (título < 60 e description < 160 caracteres).

## Etapa 6 — Médio: CORS e validação de input
- Restringir `Access-Control-Allow-Origin` nas funções administrativas e nas chamadas pelo frontend (`create-user`, `delete-user`, `update-user-*`, `list-users`, `import-students`, `daily-crm-backup`) a uma lista de origens conhecidas do projeto; webhooks e formulários públicos continuam abertos por necessidade.
- Adicionar validação por schema (zod) nas funções chamadas pelo frontend que hoje validam à mão ou não validam, começando por `notify-nps-resposta`, `send-conta-pagar-whatsapp`, `resend-formulario-response`, `generate-follow-ups`.
- Revisar se `send-zapi-test`, `zapi-health`, `resolve-invite-grupo`, `resolve-and-update-grupos`, `cleanup-duplicates`, `update-uppercase-fields` exigem papel admin; adicionar checagem onde faltar.

## Etapa 7 — Médio: textos "Iron" nas telas
Trocar por EVO TRAINING CLUB em: `EncerramentoTurno`, `EncerramentoHorario`, `EncerramentoCoordenador`, `AnamnesePublicaUniversal`, rótulos de conexão em `ZapiConexoes`, e a pergunta "padrão de atendimento Iron" (esse texto também sai no WhatsApp).

## Etapa 8 — Baixo: limpeza
- Remover a política duplicada `select_formularios_anon` da tabela `formulario_campos` (foi criada na tabela errada) e manter uma única leitura pública dos campos de formulário.
- Deixar como está, documentado: nomes internos `padrao_iron`, `backups_crm_iron` e a chave de storage `iron-crm-unidade-atual` — renomear exige migração de dados e invalidaria a unidade selecionada dos usuários, sem ganho visível.
- Chave publicável embutida em duas migrations antigas: sem ação (é chave pública, e migrations não se reescrevem).

## Detalhes técnicos
- Etapas 3, 4 e 8 exigem migração de banco (função de segredo, validação anti-flood, política duplicada).
- Etapas 1, 2 e 6 alteram edge functions; após o deploy testo `notify-nps-resposta` sem token (deve retornar 401) e com token válido (deve enviar).
- Nenhuma alteração em RLS de tabelas de negócio: a auditoria não encontrou tabela sem RLS nem política aberta em dados sensíveis.
