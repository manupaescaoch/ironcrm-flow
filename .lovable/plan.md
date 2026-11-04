# Fase 1F — plano exato de implantação controlada

## Aprovação solicitada
Implantar **somente as seis funções de banco e os dois endpoints descritos abaixo**, sem publicar ou habilitar a interface. Nenhuma alteração em tabelas, colunas, RLS, grupos, automações, filas, REAG, Financeiro, FC-2A.1 ou réguas.

## Pré-verificação realizada
- Banco ativo: PostgreSQL 17.6; consultas vinculadas à produção.
- As duas RPCs novas não existem no banco. Os dois endpoints retornam **404 NOT_FOUND** em consultas GET sem credencial válida; não foi enviada confirmação.
- As três RPCs Telegram atuais existem, com assinatura preservável e execução sem concessão a PUBLIC/anon/authenticated. Originais e privilégios foram preservados localmente para reversão.
- O trigger `contato_tarefa_evidencia` existe, AFTER UPDATE em `tasks`. Só seu corpo de função será substituído; o trigger não será recriado.
- Comparação integral das três RPCs Telegram: somente verificação direta de vínculo em `user_unidades`; Recepção acrescenta `moderator` exclusivamente BV/M+3/M+32, conforme Fase 1E. Nenhuma outra diferença de corpo encontrada.
- Flag e lista de teste ausentes/vazias no ambiente atual: funcionalidade desligada. **3 testes passaram**, sem falhas. Não serão alterados esses valores.
- Backup mais recente **informado pelo usuário**: **04/11/2026 04:49:58 UTC**. Sua restauração não foi ensaiada; não é possível afirmar recuperabilidade comprovada. O horário não constitui verificação independente do inventário.

## Ressalvas antes de aprovar
1. As três substituições Telegram passam a valer imediatamente para callbacks existentes, mesmo com a interface desligada. Não mudam grupos, botões, mensagens, cron ou webhook.
2. Os endpoints validam JWT e o banco valida papel/unidade. A lista de teste limita a interface, **não o acesso direto de outros usuários já autorizados por papel/unidade**. Nenhum bloqueio adicional de servidor será inventado nesta implantação. Se a restrição também precisar valer para chamadas diretas, interromper e aprovar esse ajuste separadamente.
3. CRM e Telegram preservam diferenças existentes: matrícula é vinculada a lead/unidade explicitamente no novo CRM; Telegram mantém sua validação atual. Técnico/Gerência encerrados podem rejeitar um clique repetido antes de retornar duplicado. Não corrigir esses comportamentos fora do pacote aprovado.
4. Evidência de origem usa contexto transacional de serviço; ensaio local não certifica todas as condições do transporte hospedado. Validação hospedada será limitada a rejeições sem escrita.
5. O backup diário cobre banco, não arquivos de Storage. Uma restauração integral perderia alterações posteriores ao horário do backup e reverteria também o schema. Não é o procedimento normal de reversão deste pacote.

**Se qualquer ressalva não corresponder ao escopo aprovado, não implantar; solicitar decisão específica.**

## Ordem de implantação após aprovação deste plano
### 1. Revalidar a base
Reconsultar hashes das quatro funções originais e seus privilégios, trigger e dependências. Interromper se houver alteração relevante desde esta pré-verificação. Confirmar novamente que a flag continua desligada.

### 2. Aplicar uma migração atômica
Concatenar, sem modificar os corpos aprovados, nesta ordem:
1. `docs/fu-phase1d/confirmations.candidate.sql`: criar `fu_crm_confirmar_envio` e `fu_comercial_confirmar_transacional`, execução apenas de serviço, autorização e idempotência internas.
2. `docs/fu-phase1d/evidence-origin.candidate.sql`: substituir somente `contato_tarefa_evidencia`, reconhecendo origem CRM e objetivo M+3/M+32; preservar chaves e histórico.
3. `docs/fu-phase1e/telegram-scope.candidate.sql`: substituir `fu_gerencial_confirmar_envio`, `fu_matriculados_confirmar_envio`, `fu_tecnico_confirmar_envio`; preservar assinaturas e ACLs existentes.

Aplicar pela ferramenta de migrações. Sem backfill ou atualização direta de registros. Revalidar definições, ACLs e anexação do trigger depois da aplicação.

### 3. Implantar somente dois endpoints
- `fu-crm-confirmar-envio`: entrada task/lead/matrícula/unidade/etapa; ator extraído do JWT verificado; chama `fu_crm_confirmar_envio` pelo serviço.
- `fu-comercial-confirmar`: entrada follow-up/lead/unidade/etapa; ator extraído do JWT verificado; chama `fu_comercial_confirmar_transacional` pelo serviço.

Empacotar os entrypoints, runtime e handler aprovados sob os dois diretórios implantáveis, com compartilhamento local sob `_shared`; ajustar apenas caminhos relativos de importação. Usar CORS e validação `getClaims()` existentes. Sem secrets novos e sem alterações no webhook Telegram ou outros endpoints. Não publicar interface.

## Validação com interface desligada
- Endpoint disponível, CORS, método inválido e ausência/token inválido: rejeição observada, sem confirmação.
- Corpo inválido sob sessão autorizada quando disponível: 400, sem executar RPC.
- Referências sintéticas inexistentes: resposta de rejeição; nunca utilizar IDs de alunos/tarefas reais em chamadas mutantes.
- Revalidar permissões SQL de execução, verificações de papel/unidade e logs; comparar estrutura antes/depois para garantir ausência de tabelas/colunas/RLS novos.
- Reexecutar testes isolados pertinentes com papéis/unidades fictícios. Não reexecutar exportação completa de banco nem automações.
- Não afirmar que autorização 403 entre unidades foi homologada no transporte hospedado se o teste seguro não atingir esse ramo; registrar como pendência de fixture autorizada. Não criar dados sintéticos em produção nesta etapa.

## Reversão
1. Bloquear/remover os dois novos endpoints e revogar execução das novas RPCs através de migração, antes de restaurar a função de evidência.
2. Restaurar os quatro corpos originais preservados e conferir ACLs/trigger; manter os originais fora de implantação automática.
3. Preservar confirmações, histórico e evidências já gravados legitimamente. Não desfazer dados, repetir mensagens ou reprocessar filas.
4. Restaurar as funções antigas também restaura suas limitações de validação por contexto de serviço; registrar esse efeito.

## Liberação restrita — não autorizada neste plano
- Usuários: **nenhum selecionado ou habilitado**; aguardar identificação explícita de contas de teste autorizadas.
- Preparar posterior versão com flag e lista exata: Enviado CRM BV/M+3/M+32, Técnico M+7/M+21, Gerência M+15/M+30 e confirmação transacional comercial D+1/D+7/D+15, sempre conforme papel/unidade. REAG permanece legado.
- Testes futuros: matrícula/tarefas fictícias autorizadas, identidade, unidade, duplicado, persistência, concorrência e separação confirmação/conclusão, sem mensagens.
- Reversão da interface exige nova versão; bloquear endpoints é a interrupção imediata, pois uma página já aberta pode manter configuração antiga.
- Apresentar contas, testes e riscos residuais e **aguardar nova autorização antes de publicar**.

## Entrega após execução autorizada
Relatório com hashes/versões, migração aplicada, endpoints, respostas/logs, ACLs/estrutura, flag desligada, erros e pendências. Separar rigorosamente resultados hospedados de testes locais e de verificações não realizadas.

**Estado atual: nenhuma migração, implantação ou publicação realizada; nenhum aluno, grupo ou registro real alterado.**
