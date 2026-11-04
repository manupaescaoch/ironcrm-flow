# Fase 1E — fechamento técnico e preparação para publicação

**Data:** 04/11/2026. **Situação:** preparação e testes locais concluídos; publicação e implantação não executadas nem autorizadas.

## 1. Resultado e limites

- Moderator autorizado nos **candidatos** para BV/M+3/M+32 da Recepção, somente na unidade vinculada. Admin/user preservados. Sem autorização Gerencial/Técnica por esse papel e sem ampliação de RLS.
- Nova confirmação da interface desligada por padrão e restrita a uma lista explícita de usuários de teste; funciona sem depender do modo de desenvolvimento.
- Estrutura pública atual exportada somente por `pg_dump --schema-only`, sem copiar linhas de alunos, funcionários, configurações ou credenciais. Restaurada em PostgreSQL descartável com 110 tabelas, 146 triggers, 280 políticas, 302 índices e 366 constraints.
- Nenhuma migração, implantação, publicação, envio real, reprocessamento de filas ou escrita de produção. Consultas de metadados e exportação de estrutura foram somente leitura.

**Não declarar homologação total de produção:** a plataforma Auth e o transporte de dados hospedados não foram integralmente reproduzidos. A interface usou um transporte interceptado para o servidor local, com assinatura JWT real e SQL real. Não foram usados logins reais nem testados dispositivos Telegram/WhatsApp.

## 2. Arquivos alterados/criados nesta fase

### Interface
- `src/lib/fuConfirmationRollout.ts` — flag e lista pública de usuários de teste, padrão desligado.
- `src/lib/fuConfirmationRollout.bun.test.ts` — três regras de liberação.
- `src/lib/fuConfirmationClient.ts` — decisão por usuário, independente de DEV.
- `src/lib/commercialFollowUpStore.ts` — seleção do caminho transacional somente para usuário incluído; REAG preservado.
- `src/components/dashboard/PersistedFuSection.tsx` — Recepção/moderator pode visualizar Enviado quando liberado; autorização SQL independente.
- `src/pages/Operacao.tsx` — exposição técnica condicionada à mesma liberação.

### Candidatos e testes
- `docs/fu-phase1d/confirmations.candidate.sql` — moderator em Recepção e vínculo consultado diretamente dentro da função service-only.
- `docs/fu-phase1d/README.md` — autorização da Fase 1E.
- `docs/fu-phase1e/telegram-scope.candidate.sql` — três RPCs candidatas, mesmas assinaturas e roteamento.
- `docs/fu-phase1e/prepare.py`, `run-isolated.sh`, `structural.py`, `persistence.py`, `integration_test.ts` — ambiente descartável e ensaios.
- `docs/fu-phase1e/README.md`, `resultado.md`, `roadmap.md`, `AGENTS.md` — operação, resultados e regras técnicas.
- Memória do projeto atualizada para registrar os limites autorizados.

Nenhum candidato foi inserido na história de migrações ou diretório de funções implantáveis.

## 3. Migrações candidatas

1. `docs/fu-phase1d/confirmations.candidate.sql`: `fu_crm_confirmar_envio` e `fu_comercial_confirmar_transacional`, EXECUTE somente service_role.
2. `docs/fu-phase1d/evidence-origin.candidate.sql`: correção de `contato_tarefa_evidencia`, preparado anteriormente e ensaiado agora com o coletor real, sem alterar o arquivo nesta fase.
3. `docs/fu-phase1e/telegram-scope.candidate.sql`: substituições candidatas de `fu_matriculados_confirmar_envio`, `fu_tecnico_confirmar_envio`, `fu_gerencial_confirmar_envio`.

**Divergência reproduzida pelo esquema completo:** `get_user_unidades(actor)` depende de `auth.uid()` ser o próprio usuário ou admin. O endpoint usa serviço sem JWT do usuário no cliente privilegiado; o helper retorna vazio para não admins. Corrigido nos candidatos por `EXISTS` em `user_unidades`, dentro de funções privilegiadas que já validam papel e identidade. O helper público não foi alterado; nenhuma RLS foi ampliada.

## 4. Matriz final de confirmação SQL candidata

| Papel | BV/M+3/M+32 | M+7/M+21 Técnico | M+15/M+30 Gerência | D+1/D+7/D+15 Comercial |
|---|---|---|---|---|
| admin | Sim | Sim | Sim | Sim |
| user / Comercial | Unidade vinculada | Não | Não | Unidade vinculada |
| moderator / Recepção | Unidade vinculada | Não | Não | Não |
| gerente | Não | Unidade vinculada | Unidade vinculada | Não |
| coordenador | Não | Unidade vinculada | Não | Não |
| sem papel | Não | Não | Não | Não |
| usuário de outra unidade | Não | Não | Não | Não |

Admin mantém a exceção administrativa existente. Mesmo admin deve fornecer identidade correta de tarefa/aluno/matrícula/unidade/etapa. RPCs não aceitam execução direta de anon/authenticated. Telegram exige também usuário conectado e grupo/mensagem original válidos.

## 5. Testes executados

| Verificação | Resultado |
|---|---|
| Build e tipagem automática da aplicação | OK nos registros do preview |
| Deno check dos candidatos runtime e integração | OK |
| Lint dos arquivos TS/TSX alterados e handlers candidatos | Zero erros/avisos |
| Bun: 12 arquivos existentes e novos | 93 aprovados, zero falhas |
| Deno: réguas, segurança, evidência, Telegram, indicadores e handlers | 84 aprovados, zero falhas em execução com `--no-check` |
| SQL: matriz completa, CRM primeiro, Telegram primeiro, disputa concorrente, histórico/evidência | 250 asserções aprovadas |
| SQL: autoria, etapas, timestamp, histórico legado, rollback e agregados | 26 asserções aprovadas |
| SQL: moderator Telegram, unidade errada, grupo/mensagem original e releitura CRM | 21 asserções aprovadas |
| HTTP/JWT/handler/SQL com identidades fictícias | 1 teste integrado aprovado |
| Chromium: interface Recepção → HTTP local → JWT → SQL → atualização/reload | 1 fluxo aprovado, sem erros de página |

**Total:** 178 testes automatizados Bun/Deno, 297 asserções SQL e um fluxo Chromium. A contagem não significa 178 fluxos de produção homologados.

**Tipagem adicional não certificada:** o conjunto Deno legado com verificação de tipos encontrou dependência `npm:@types/node` não resolvida no modo manual. Sua execução sem verificação de tipos passou; a tipagem dos candidatos alterados e da aplicação passou separadamente. Não foi executado lint global nem build manual, pois a aplicação é verificada automaticamente pelo ambiente.

## 6. Evidências de integração

- JWT ES256 assinado com chave efêmera local, verificado pelo `getClaims` real do SDK. Token vencido, inválido e payload adulterado são recusados com 401.
- Gerente/coordenador/sem papel/outra unidade são recusados com 403 para Recepção. Admin/user/moderator acessam a Recepção conforme matriz; payload com autor injetado é recusado com 400.
- Endpoint deriva autor do JWT, chama SQL com papel de serviço, registra timestamp do banco, confirmação, histórico e evidência.
- Concorrência retorna exatamente uma confirmação nova e uma duplicada, com mesmo timestamp e um único histórico/evidência.
- Resposta descartada após gravação seguida de repetição retorna duplicado, sem novo histórico.
- Chromium usa sessão exclusivamente fictícia. A chamada da interface é encaminhada ao handler HTTP local e ao SQL real; as leituras são transportadas por interceptação local. A tela mostrou confirmação, removeu o botão Enviado e manteve Acompanhamento aberto; recarregar leu a confirmação persistida.
- Nenhum link WhatsApp foi aberto. Nenhuma API real de bot foi chamada. `net.http_post` do ambiente local é inerte.

Logs e capturas de execução estão em `/tmp/fu-phase1e` e `/tmp/browser/fu-phase1e`; são temporários. Scripts reprodutíveis ficam no projeto.

## 7. Compatibilidade Telegram e histórico

Não alterados: webhook, prefixos fmc/ftc/fgc, handlers, grupos, mensagens ou destinos. Os ajustes **SQL candidatos** acima estão documentados integralmente no arquivo correspondente: somente consulta de unidade diretamente e autorização moderator Recepção. Papéis Técnico/Gerencial permanecem iguais.

Após confirmação CRM, Telegram autorizado reconhece os mesmos campos, retorna duplicado e permite ao handler existente atualizar o aviso original. Não chama sendMessage nem gera novo histórico. Recuperação visual existente continua independente da persistência. Testes Deno existentes de botões/recuperação passaram, mas a edição de uma mensagem real não foi ensaiada.

Evidência mantém a chave `manual:<família>:<tarefa>`; origem CRM/Telegram corresponde ao primeiro confirmador. BV usa boas_vindas; M+3/M+32 usam experiencia. Histórico mantém campos `fu_matriculados_envio_aluno` para BV e `fu_recepcao_envio_aluno` para M+3/M+32. Não houve backfill de registros antigos.

Consumidores comerciais revisados: store e identidade de histórico, hooks de confirmação, cartões, timelines e atividades. Mantidos status concluido, concluido_em, concluido_por, tipo Follow Up, descrição existente, ID determinístico e flags alreadyConfirmed/historyPending. Igualdade de ID SHA-256/UUID SQL foi verificada para D+1/D+7/D+15. Falha de INSERT reverte a nova confirmação; histórico legado ausente continua sendo sinalizado, sem reparação automática. Não foi ensaiada uma matriz exaustiva de timestamps históricos fracionários.

## 8. Feature flag e monitoramento

Dois valores públicos de build: ENABLED literal true e TEST_USERS com lista explícita de UUIDs. Ausentes/vazios → desligado; usuário fora da lista → desligado. Não contém token/segredo, não concede papel e não substitui JWT/SQL.

Não é flag remota: alterar a liberação exige nova versão da interface. Nenhum usuário real foi incluído agora. Com a flag desligada, o Comercial continua a confirmação legada e REAG permanece legado sempre. Monitoramento futuro pode usar respostas HTTP dos endpoints e task_history/contato_execucoes existentes, sem novo indicador; não foi instalado painel/alerta de produção.

## 9. Riscos residuais e pendências

1. Auth hospedado e transporte oficial completo de dados/RPC ainda não certificados em uma pilha local integral. JWT criptográfico, handler e SQL foram ensaiados, não a implantação real do endpoint.
2. Chromium integrado cobre moderator/M+3; a matriz dos demais papéis foi validada por SQL e HTTP, não por sete logins completos na interface.
3. Concorrência usa processos independentes e ordens CRM/Telegram; não força todas as interleavings por barreira determinística.
4. Feature flag permite produção, mas requer nova versão para reversão; não é kill switch remoto.
5. Regras reais de geração podem criar tarefas no fixture; foram preservadas e as tarefas geradas aproveitadas. Nenhuma afirmação de nova elegibilidade ou corte foi feita a partir de dados reais.
6. Funções/candidatos estão disponíveis somente em desenvolvimento. Liberar a interface antes de implantá-los é proibido pelo plano.
7. Callback real, latência, falhas de transporte hospedado e dispositivos reais permanecem pendentes de aprovação de ensaio adequado.

## 10. Plano de publicação — somente após aprovação

1. Revisar e aprovar explicitamente os três SQL candidatos, os dois endpoints e os limites residuais acima.
2. Confirmar backup e capturar definições originais para reversão; nenhuma cópia de dados pessoais para testes.
3. Registrar/aplicar migrações aprovadas e implantar endpoints com flag da interface desligada.
4. Homologar os endpoints no transporte oficial com usuários de teste autorizados; sem alunos/grupos reais e sem reprocessar filas.
5. Definir a lista de usuários de teste e publicar versão restrita da interface; conferir autoria, unidade, estágio, persistência e erros.
6. Monitorar respostas e histórico/evidências existentes. Ampliar usuários somente após nova aprovação.
7. Não incluir FC-2A.1, Financeiro, REAG, textos, prazos, elegibilidade, grupos ou filas antigas.

## 11. Plano de reversão

1. Publicar interface com flag desligada/lista vazia ou restaurar versão anterior; Comercial volta ao caminho legado, REAG intacto.
2. Bloquear/remover os novos endpoints quando necessário, após retirar acesso da interface. Não apagar confirmações já feitas.
3. Restaurar definições SQL originais aprovadas de evidência e das três RPCs Telegram; retirar EXECUTE dos novos candidatos se for preciso. Preservar assinaturas de consumidores legados.
4. Manter todos os históricos/evidências existentes. Não desfazer confirmação em massa, não reenviar avisos e não reprocessar contatos.
5. Validar novamente consultas, permissões e ausência de duplicidade antes de qualquer retomada.

**Aguardando aprovação explícita. Produção permanece sem mudanças desta fase.**