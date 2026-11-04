# Fase 1F — plano exato de implantação controlada

## Aprovação solicitada
O escopo técnico foi aprovado, **não a execução**. Este plano incorpora os dois ajustes solicitados e exige autorização expressa posterior antes de migrar ou implantar **somente as seis funções de banco e os dois endpoints descritos abaixo**, sem publicar ou habilitar a interface. Nenhuma alteração em tabelas, colunas, RLS, grupos, automações, filas, REAG, Financeiro, FC-2A.1 ou réguas.

## Pré-verificação realizada
- Banco ativo: PostgreSQL 17.6; consultas vinculadas à produção.
- As duas RPCs novas não existem no banco. Os dois endpoints retornam **404 NOT_FOUND** em consultas GET sem credencial válida; não foi enviada confirmação.
- As três RPCs Telegram atuais existem, com assinatura preservável e execução sem concessão a PUBLIC/anon/authenticated. Originais e privilégios foram preservados localmente para reversão.
- O trigger `contato_tarefa_evidencia` existe, AFTER UPDATE em `tasks`. Só seu corpo de função será substituído; o trigger não será recriado.
- Comparação integral das três RPCs Telegram: somente verificação direta de vínculo em `user_unidades`; Recepção acrescenta `moderator` exclusivamente BV/M+3/M+32, conforme Fase 1E. Nenhuma outra diferença de corpo encontrada.
- Flag e lista de teste ausentes/vazias no ambiente atual: funcionalidade desligada. **3 testes passaram**, sem falhas. Não serão alterados esses valores.
- Backup mais recente **informado pelo usuário**: **04/11/2026 04:49:58 UTC**. Sua restauração não foi ensaiada; não é possível afirmar recuperabilidade comprovada. O horário não constitui verificação independente do inventário.

## Backup e alternativa de recuperação
- Não existe ferramenta disponível para consultar/verificar integridade desse snapshot ou restaurá-lo isoladamente. Backups restaura somente o mesmo banco de produção. **Não realizar restauração em produção como teste.**
- Alternativa documentada em `docs/fu-phase1f/recovery.md`: exportação atual pela página More → Database → Manage → Settings → Export data, download privado e restauração em projeto compatível separado pertencente ao usuário, isolado de canais e automações; validar importação, schema, contagens e login autorizado.
- O export contém banco completo e contas com hashes de senha, mas não Storage, código de funções, secrets ou configuração de provedores. Limites: banco 15 GB, export 5 GB, um a cada 24h; backend precisa estar ativo. Arquivos de Storage são baixados separadamente.
- Esse ensaio depende de export e destino disponibilizados pelo usuário; **não foi executado e não comprovaria o snapshot das 04:49:58**, apenas o export atual. O ensaio estrutural da Fase 1E também não comprova recuperação de dados.
- Reversão de funções com originais preservados será o mecanismo preferencial. Caso a autorização exija integridade comprovada do snapshot como condição absoluta, a implantação permanece bloqueada; a alternativa não será tratada como prova equivalente.

## Ressalvas antes de aprovar
1. As três substituições Telegram passam a valer imediatamente para callbacks existentes, mesmo com a interface desligada. Não mudam grupos, botões, mensagens, cron ou webhook.
2. Os novos endpoints usarão controle de piloto no servidor: **JWT válido → flag servidor ativa + UUID na lista autorizada → corpo estrito → SQL com papel/unidade/identidade**. Usuários não listados, inclusive admins, não podem executar essas novas confirmações; ausência, lista vazia/malformada ou erro de configuração bloqueiam. A lista frontend não concede acesso servidor.
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

Empacotar os entrypoints e o runtime candidato revisado da Fase 1F sob os dois diretórios implantáveis, com compartilhamento local sob `_shared`; ajustar caminhos relativos de importação. Usar CORS, `getClaims()` e handler aprovados, envolvidos pelo bloqueio em `docs/fu-phase1f/pilotHandler.ts`/`pilotPolicy.ts`. Não copiar arquivos para diretórios de implantação enquanto execução não for autorizada.

Configuração **exclusivamente no servidor**, sem prefixo VITE: `FU_CRM_CONFIRMATION_ENABLED` e `FU_CRM_CONFIRMATION_TEST_USERS`. Ausência mantém bloqueado; iniciar desligado, lista vazia. Preparados apenas os leitores candidatos, sem configurar valores no serviço nesta fase. Posterior inclusão de UUIDs reais exige contas explicitamente autorizadas; nenhum UUID real foi escolhido. Desligar flag/bloquear endpoints interrompe novas requisições, não transações já iniciadas. Aplicação de valores no serviço pode exigir atualização do runtime; verificar bloqueio com nova requisição antes de assumir efeito imediato.

O bloqueio cobre **somente os dois novos endpoints**. Não altera RPCs Telegram, webhook, chamadas de serviço existentes, papéis, RLS ou fluxo legado comercial. As RPCs novas continuam restritas ao serviço; sua autorização SQL não será substituída pela lista. Não publicar interface.

## Validação com interface desligada
- Endpoint disponível, CORS, método inválido e ausência/token inválido: rejeição observada, sem confirmação.
- Configuração desligada/lista vazia e conta não listada: 403 antes de SQL, inclusive por chamada direta. Para testar a rejeição de conta real não listada, usar apenas sessão autorizada e configuração que não a inclui; não executar confirmação.
- Corpo inválido sob sessão autorizada quando disponível: 400, sem executar RPC.
- Referências sintéticas inexistentes: resposta de rejeição; nunca utilizar IDs de alunos/tarefas reais em chamadas mutantes.
- Revalidar permissões SQL de execução, verificações de papel/unidade e logs; comparar estrutura antes/depois para garantir ausência de tabelas/colunas/RLS novos.
- Reexecutar testes isolados pertinentes com papéis/unidades fictícios. Não reexecutar exportação completa de banco nem automações.
- Não afirmar que autorização 403 entre unidades foi homologada no transporte hospedado se o teste seguro não atingir esse ramo; registrar como pendência de fixture autorizada. Não criar dados sintéticos em produção nesta etapa.

### Evidências locais dos novos ajustes
**16 testes novos de bloqueio servidor + 5 regressões do handler + 3 testes de flag frontend: 24 aprovados, 0 falhas.** Cobrem ambas as famílias: padrão desligado, lista vazia/malformada, conta não listada (sem exceção admin), JWT inválido, identidade injetada rejeitada, autorização SQL preservada e interrupção por configuração servidor na próxima requisição do handler. Transporte/SQL dessas novas verificações são simulados; não apresentar como homologação hospedada ou nova prova SQL real. Nenhuma mensagem ou escrita em produção.

## Reversão
1. Desligar flag servidor/esvaziar lista, verificar rejeição e bloquear/remover os dois novos endpoints; aguardar chamadas iniciadas e revogar execução das novas RPCs através de migração, antes de restaurar a função de evidência. Flag frontend permanece desligada.
2. Restaurar os quatro corpos originais preservados e conferir ACLs/trigger; manter os originais fora de implantação automática.
3. Preservar confirmações, histórico e evidências já gravados legitimamente. Não desfazer dados, repetir mensagens ou reprocessar filas.
4. Restaurar as funções antigas também restaura suas limitações de validação por contexto de serviço; registrar esse efeito.

## Liberação restrita — não autorizada neste plano
- Usuários: **nenhum selecionado ou habilitado**; aguardar identificação explícita de contas de teste autorizadas.
- Usar listas servidor e frontend alinhadas; servidor é a barreira obrigatória, JWT/papel/unidade continuam exigidos. Publicar frontend ou alterar valores não integra esta autorização de escopo.
- Preparar posterior versão com flag e lista exata: Enviado CRM BV/M+3/M+32, Técnico M+7/M+21, Gerência M+15/M+30 e confirmação transacional comercial D+1/D+7/D+15, sempre conforme papel/unidade. REAG permanece legado.
- Testes futuros: matrícula/tarefas fictícias autorizadas, identidade, unidade, duplicado, persistência, concorrência e separação confirmação/conclusão, sem mensagens.
- Reversão da interface exige nova versão; bloquear endpoints é a interrupção imediata, pois uma página já aberta pode manter configuração antiga.
- Apresentar contas, testes e riscos residuais e **aguardar nova autorização antes de publicar**.

## Entrega após execução autorizada
Relatório com hashes/versões, migração aplicada, endpoints, respostas/logs, ACLs/estrutura, flag desligada, erros e pendências. Separar rigorosamente resultados hospedados de testes locais e de verificações não realizadas.

**Estado atual: nenhuma migração, implantação ou publicação realizada; nenhum aluno, grupo ou registro real alterado.**
