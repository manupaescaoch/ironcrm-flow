# Resultado Fase 1F — 04/11/2026

## Implantado
- Migração atômica `drizzle/migrations/0047_fu_phase1f_controlled_confirmations.sql`: seis funções aprovadas. Comparação encontrou somente uma quebra de linha diferente no INSERT do histórico técnico; SQL idêntico desconsiderando whitespace, sem diferença funcional.
- Endpoints `fu-crm-confirmar-envio` e `fu-comercial-confirmar`, compartilhando `_shared/fuCrmConfirmation`.
- SHA-256 de submissão: CRM `866cd8db604b1128e2d6b41f2a457428ef25f0a68c894961343db86e79b38e6c`; Comercial `0e4e241dc9c660f9680e8c2e72c07ba1af4cdad718a2b23ff9b78e9d3181ec33`. Não equivalem a leitura independente do código hospedado.
- Configuração servidor ausente, portanto bloqueado por padrão, sem usuários liberados. Nenhum secret de liberação criado. Interface não publicada/habilitada.

## Verificações
- Hashes das quatro funções originais/ACLs conferidos antes da aplicação: sem divergência. Originais preservados para reversão.
- Execução de cinco RPCs: anon/authenticated=false; service_role=true; SECURITY DEFINER com search_path fixo.
- Estrutura antes/depois: 110 tabelas, 1569 colunas, 280 políticas, 146 triggers. Trigger de evidência AFTER UPDATE em tasks preservado. Contagens não substituem comparação exaustiva de definições; migração contém somente funções/grants aprovados.
- Ambos endpoints responderam 401 para token inválido e requisição sem sessão. Sessão válida da própria conta do solicitante: ambos retornaram 403 “Confirmação não liberada para esta conta”, antes de SQL. Corpo vazio, sem IDs reais, nenhuma tarefa confirmada.
- 21 testes Deno (16 bloqueio + 5 regressões) e 3 Bun passaram. Testes locais de autorização SQL usam transporte simulado; rejeição 403 de papel/unidade através de SQL hospedado permanece não exercitada, pois piloto desligado.
- Logs consultados: inicialização normal, sem erro apresentado. Build automático OK.
- Scan prévio: três avisos de políticas existentes (encerramento técnico e task_history). Linter global posterior: 70 achados/5 tipos; não são certificação de segurança nem erros de implantação. Não ampliar escopo/RLS para corrigi-los. Novas RPCs não são executáveis por anon/authenticated.

## Erros e pendências
- Nenhum erro de migração, implantação ou runtime observado nas verificações executadas.
- Export concluído/disponível conforme confirmação do usuário; arquivo e restauração não inspecionados. Risco aceito pelo usuário. Backup das 04:49:58 não validado.
- Liberação de contas de teste/interface e confirmação hospedada com fixture autorizada dependem de autorização separada. Nenhum usuário liberado.
- Sem mensagens, automações manuais, reprocessamento ou confirmação de tarefas reais. REAG, Financeiro, grupos, réguas e FC-2A.1 fora do pacote.

## Reversão
Bloquear endpoints/drenar chamadas; revogar novas RPCs se necessário; restaurar quatro originais e ACLs por migração autorizada. Não apagar evidências/histórico. Procedimento completo e riscos do restore integral em `recovery.md`.