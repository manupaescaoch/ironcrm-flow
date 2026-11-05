# Roadmap

## Preparação final frontend — 05/11/2026
- [x] Paginar sete loaders de indicadores sem alterar cálculos; seis regressões novas aprovadas (2.501 registros, falha de página, corte e escopo). Os 79 testes anteriores não foram repetidos.
- [x] Extrair patches aprovados contra origin/_agent-publish em docs/frontend-package; aplicação local sem conflitos, excluindo funções/migrações/permissões e outras frentes.
- [x] Verificar prévia: drafts.create é suportado, porém parte do projeto inteiro; nenhum rascunho criado. Deve receber candidato isolado e confirmar banco de teste próprio antes de qualquer homologação.
- [ ] Montar candidato no rascunho e homologar hospedado — depende de criação de rascunho/base de teste isolada e autorização para contas fictícias; nunca usar base principal como fallback.

## Homologação frontend Fases 2–4 — 05/11/2026
- [ ] Liberação final: consulta às superfícies hospedadas confirmou apenas o projeto principal, sem rascunho isolado disponível. Homologação hospedada não executada nem simulada; requer ambiente com base de teste isolada, cinco perfis e duas unidades fictícias. Não repetir os 79 testes aprovados. Totais de períodos extensos e pacote por trechos exclusivamente aprovados continuam pendentes; não publicar ou liberar Enviado/FC-2A.1.
- [x] Homologação final: remover somente a chamada de geração no carregamento do Dashboard; reprodução anterior mostrou 10 chamadas, após correção nenhuma chamada de função no carregamento/períodos. 78 regressões existentes + 1 teste novo aprovados. Cinco perfis, duas unidades, 30 combinações tela/perfil, cinco trocas A→B e cinco navegações móveis concluídas com transporte fictício.
- [x] Persistência fictícia: cinco perfis editaram nome, PATCH validou unidade e linha retornada foi relida após recarga; filtro CRM Últimos 7 dias sobreviveu à recarga. Dashboard: últimos 7 dias, mês atual, mês anterior e personalizado sem invocar funções. Não certifica RLS/auth/persistência hospedados.
- [x] Reutilizar 60 testes existentes; 18 regressões novas de acesso aprovadas (78 total). Chromium com login/transporte fictícios: admin, recepção, comercial, coordenador, gerente e perfil ausente; 30 combinações tela/perfil, CRM preenchido e troca A→B, sem rede de produção.
- [x] Reproduzir perfil ausente montando Executivo/Usuários; corrigir somente os três gates restritos de App.tsx e confirmar mesma reprodução sem montagem privilegiada. Build automático OK.
- [x] Candidatos à publicação: filtros/listas/edição básica CRM–Kanban–LeadDetail, indicadores Executivo/Comissões/Operacional e menu/gates; não dependem das 20 funções preparadas. Enviado/FC-2A.1 permanecem desligados; nenhuma função ou configuração alterada.
- [x] Preparar matriz: CRM/Comissões para cinco perfis; Executivo para admin/coordenador/gerente; Dashboard Operacional e Usuários para admin; testar perfil ausente e unidade não permitida. Contas fictícias existem somente no transporte interceptado, não no auth hospedado.
- [ ] Homologação hospedada de permissões e persistência — requer ambiente isolado com contas dos cinco perfis e duas unidades, sem dados reais; criação de contas/banco não autorizada nesta etapa.
- [ ] Publicação — depende de homologação hospedada do pacote e autorização: publicar o checkout inteiro incluiria outras frentes. Patches isolados em docs/frontend-package; corte de linhas corrigido localmente. Nenhum processo agendado ou função alterado.

## Mapeamento final dos agendamentos — 05/11/2026
- [x] Integrar os 19 endpoints e o backup fora de supabase/functions; 46 testes fictícios aprovados, fontes implantáveis inalteradas, reversão local preservada sem afirmar identidade com versões hospedadas.
- [x] Ler cron.job e emissores SQL sem executar automações; identificar 15 agendas ativas, 1 inativa e 4 emissores por trigger.
- [x] Conferir candidato e executar 10 testes fictícios; documentar incompatibilidade de exports, correções ainda não integradas e mapa em docs/fase6-automacoes/mapeamento-final.md.
- [ ] Implantação/rotação — bloqueadas por autorização específica, versão hospedada para reversão, credencial literal do retry comercial e consumidores externos não confirmados; backup e resumo aposentado compatibilizados no pacote local.

## Fase 2 — filtros, cadastros e persistência
- [x] Investigar CRM/Kanban/detalhe e reproduzir filtros/busca/zero-row/concorrência com dados fictícios; não alegar cobertura exaustiva.
- [x] Corrigir somente falhas reproduzidas; 27 Bun e fluxo Chromium de filtros/cadastro/arquivamento/recarga aprovados, unidade escopada.
- [x] Entregar relatório em docs/fase2-filtros-persistencia.md; sem migrações/RLS/publicação/dados reais, preservando Fase 1 e áreas excluídas. Persistência/perfis reais e caminhos não reproduzidos permanecem não certificados.

## Fase 1F — implantação controlada
- [x] Export atual concluído e disponível conforme confirmação do usuário em 04/11 16:03 UTC; arquivo não inspecionado.
- [ ] Validar recuperação do export em destino isolado — não executado; usuário aceitou risco residual em 04/11 16:02 UTC, mantendo export disponível como condição obrigatória.
- [x] Reconfirmar quatro definições SQL originais e ACLs preservadas localmente; candidatos servidor bloqueiam por padrão sem lista autorizada.
- [x] Consolidar checklist final: arquivos/endpoints, bloqueio servidor candidato, recuperação, ordem, verificações e interrupções; implantação segue bloqueada.
- [x] Documentar limites de verificação do backup e alternativa isolada de recuperação — snapshot não verificável pelas ferramentas; export/destino dependem do usuário.
- [x] Preparar bloqueio servidor default-off e lista explícita de contas de teste, além de JWT/papel/unidade; 16 testes novos + 5 regressões Deno e 3 Bun aprovados, sem produção.
- [x] Revisar plano final com impacto Telegram e reversão; nenhuma execução em produção autorizada pela aprovação de escopo.
- [x] Ler autorização, consultar definições/ACLs e trigger instalados, preservar snapshot e conferir flag desligada (3 testes aprovados).
- [x] Registrar backup informado pelo usuário: 04/11/2026 04:49:58 UTC; recuperabilidade não ensaiada.
- [x] Aplicar somente seis funções aprovadas (0047) e implantar dois endpoints default-off — export confirmado pelo usuário, originais/ACLs revalidados.
- [x] Validar transporte hospedado sem escrita: 401 sem JWT válido e 403 com sessão válida nos dois endpoints; estrutura/ACLs/trigger preservados, logs sem erro observado; 24 testes locais passaram. Autorização SQL hospedada com fixture permanece fora da liberação.
- [ ] Preparar/publicar liberação restrita — depende de usuários autorizados e nova autorização específica; interface permanece desligada.

## Fase 1E — preparação isolada, sem produção
- [x] Incluir moderator exclusivamente em confirmações Recepção com unidade, preservando demais permissões; candidatos CRM/Telegram corrigem vínculo direto em serviço sem modificar helper/RLS.
- [x] Preparar ativação padrão desligada compatível com produção e lista explícita de usuários de teste.
- [x] Restaurar estrutura pública real sem registros pessoais; testar SQL, JWT assinado, interface com transporte local, concorrência, persistência e regressões. Auth hospedado/PostgREST completos e dispositivos reais permanecem não certificados.
- [x] Entregar arquivos, candidatos, matriz, evidências, riscos, planos de publicação e reversão no relatório da Fase 1E.
- [ ] Implantação/publicação: proibida até aprovação explícita; nova preparação pode exigir homologação do transporte hospedado e liberação dos usuários de teste.

## Auditoria de abertura, confirmação e indicadores FU — 04/11/2026
- [x] Fase 1D: aviso comercial corrigido, SQL/endpoints candidatos fora da implantação, Enviado CRM com ativação somente desenvolvimento inativa, 90 Bun + 93 Deno, 70 verificações SQL e quatro ensaios navegador aprovados. Lint direcionado sem erros (um aviso legado Fast Refresh), tipagem candidata Deno e build automático OK. Nenhuma produção alterada.
- [ ] Fase 1D implantação: depende de aprovação posterior; Fase 1E autorizou moderator em candidatos isolados, mas produção permanece intacta; validar transporte hospedado antes de liberar usuários de teste.
- [x] Fase 1C: 147 testes (84 Bun + 63 Deno), 33 verificações SQL isoladas e três ensaios de navegador aprovados; metadados atuais consultados somente leitura; relatório entregue com lint global reprovado e lacuna comercial reproduzida. Sem código funcional, implantação, publicação ou escrita de produção.
- [x] Implementação isolada das propostas autorizada na Fase 1D; Zod/lint relevante resolvidos, concorrência SQL CRM × Telegram e handler local aprovados. Implantação e fixture completo seguem pendentes na Fase 1D.
- [x] Fase 1B: contato vinculado à identidade, confirmação comercial com atualização condicional/releitura, Operação lendo tarefas persistidas, detalhe por ID e falhas visuais Telegram contidas; 84 Bun + 31 Deno aprovados e novos ensaios Chromium com transporte fictício.
- [ ] Homologar Fase 1B em versão real e implantar/publicar somente após aprovação. Confirmação web das tarefas internas e transação comercial+histórico exigem proposta separada; permissões reais por perfil e concorrência SQL não certificadas nesta fase.
- [x] Auditar tela, confirmação, Telegram, permissões e consultas somente leitura; reproduzir contato anterior em Técnico/Gerência, telefone inválido e sucesso falso comercial com transporte fictício; 47 testes existentes aprovados. Concorrência SQL e dispositivos reais não homologados.
- [x] Entregar diagnóstico com matriz, causas comprovadas, limitações e propostas; nenhum arquivo funcional ou registro real alterado.
- [x] Aplicar correções de código autorizadas na Fase 1B; preservadas regras, históricos, grupos, permissões e FC-2A.1. Limitações e proposta complementar no relatório.

## Cancelamento — remoção da pergunta de autorização de contato
- [x] Remover perguntas e linhas de autorização, preservando histórico e preferências; 3 testes Deno, 72 Bun e fluxo de 14 etapas com envio interceptado aprovados.
- [ ] Implantar função e publicar após nova aprovação; pedido anterior não executado. Nenhum dado real ou grupo alterado.

## Auditoria real de todos os follow-ups — 03/11/2026
- [x] Conferir agendadores, gatilhos, execução HTTP, tarefas e logs por etapa/unidade, sem chamadas que enviem ou alterem dados.
- [x] Reexecutar simulações isoladas: 56 Deno + 11 Bun aprovados; distinguir produção, testes, confirmação e conclusão.
- [x] Entregar matriz, falhas e propostas; HTTP 400 comercial (triggered_at) e Recepção (time), Comercial Aflitos desconectado e coordenadores sem vínculo; nenhuma correção adicional.
- [ ] Corrigir pedidos cron comercial/Recepção e decidir tratamento da fila vencida — depende de aprovação específica, não autoriza reenvios.
- [ ] Confirmar próximo ciclo automático gerencial pós-correção — depende de 04/11 às 08:00 Recife; não antecipar nem enviar testes.

## Correção gerencial aprovada — 03/11/2026
- [x] Desativar somente o emissor legado G+7/G+30, preservando históricos, agendador e demais rotinas.
- [x] Testar avisos individuais, isolamento de falhas, autorização, idempotência e confirmação independente: 24 Deno, 11 Bun e 3 suítes SQL isoladas aprovados.
- [x] Implantar somente notify-resumo-gestao-operacional; diagnóstico autorizado por cron em dry_run retornou 200 e resumo_gerencial_legado_desativado, sem envios/gravações.
- [x] Entregar evidências e limitações: agendador 08:00 preservado; próximo ciclo automático ainda não ocorreu e não foi antecipado.

## FC-2A.1 — interrompida pelo usuário; fora da publicação
- [ ] Apresentar opções reais de usuários EVO OPS por unidade; nenhuma vinculação automática.
- [ ] Completar endpoint autenticado e operações atômicas candidatas, apenas em ambiente isolado.
- [ ] Integrar e testar os 17 escritores, Telegram/REAG e recuperação sem rede real.
- [ ] Ampliar testes dos triggers inversos, RLS, escopo, concorrência e idempotência.
- [ ] Preparar indicadores de ciclos preservando os 13 campos e histórico inconclusivo.
- [ ] Entregar homologação, bloqueios e proposta gradual; nenhuma produção/piloto/mensagem autorizada.

## FC-2A.1 — diagnóstico e proposta, sem implementação
- [x] Mapear caminhos de escrita, consumidores, permissões e 19 triggers instalados; identificar diferença entre REAG real ao lead e aviso à recepção descrito.
- [x] Entregar relatório técnico e plano de schema, compatibilidade, implantação, rollback e testes, sem código/migração/implantação.
- [x] Preparar candidato aditivo e dispatcher inativo com inventário de 17 fronteiras de escrita; 29 testes bloqueiam piloto incompleto. Chamadores ainda não conectados, sem ativação.
- [x] Identificar EVO OPS como canal; aviso idempotente ensaiado com conta sintética, sem alterar REAG. Destinatário real não vinculado nas unidades.
- [x] Ensaiar os 19 triggers instalados com rede inerte: 45 asserções SQL/concorrência e 58 regressões do resumo passaram; evidências preservadas.
- [ ] Vincular responsável real da recepção — depende de escolha/vínculo de usuário autorizado por unidade; não inventar destino.
- [ ] Conectar e homologar todos os chamadores + análises de novos ciclos — depende de preparação complementar do endpoint autenticado/criação-edição e resolução dos comportamentos legados descritos no relatório; não autoriza piloto.
- [x] Apresentar resultados parciais e bloqueios; migração produção/piloto/mensagens continuam proibidos e exigem aprovação específica posterior, sem backfill ou FC-2B.

## Falha de tempo excedido na página Telegram
- [x] Limitar chamadas externas sem repetir envios e tratar falhas de carregamento na tela.
- [x] Quatro testes passaram; página autenticada permanece visível sob 504 simulado e conexão real confirmou Conectado sem erros; implantados health/admin/send.

## FC-2A — experimentais operacionais somente analíticos
- [x] Validar fontes e ciclos; false histórico é padrão, falta conclusiva exige resposta por slot e ambiguidades ficam em revisão.
- [x] Adicionar objeto operacional independente com contagens, revisão, pendências e taxa conservadora; preservar os 13 campos antigos.
- [x] Executar 58 testes e SQL independente de outubro/novembro, analisar os 71 pendentes antigos, implantar somente resumo e entregar relatório; 13 campos idênticos, taxa indisponível por revisão.

## FC-1 — segurança e clareza do resumo comercial
- [x] Proteger motivos livres somente na resposta e preservar todos os cálculos existentes.
- [x] Validar marco técnico e fechamentos explícitos; adicionar metadados/indicador separado, sem mudanças de dados.
- [x] Testar e comparar outubro/novembro antes/depois com SQL independente; implantar somente a função e entregar relatório (28 testes únicos, 12 requisições reais; campos antigos idênticos).
- [ ] Aplicar máximo de 366 dias — depende de confirmação dos períodos dos consumidores externos e aprovação de eventual impacto; comportamento atual preservado.

## Auditoria de consistência do funil comercial — somente leitura
- [x] Conciliar outubro e novembro entre função publicada e consultas independentes; auditar histórico, unidades, origens, datas e segurança (200/400/401 reais; 12 testes existentes; sem escrita em dados).
- [x] Entregar diagnóstico, evidências, limitações e correções recomendadas, sem implementar alterações; relatório de 02/11/2026 salvo em Files.

## Datas de conversão/perda e resumo comercial
- [x] Adicionar trigger independente sem backfill e exigir motivo de perda na lista atual.
- [x] Implementar funil-comercial-resumo com token existente e somente agregados; testar e implantar (12 testes + SQL isolado; endpoint real 200/400/401).

## FU Fase 2.2B — preparação da transição pós-matrícula
- [x] Inventariar legados e matriz de substituição sem mudar Operação ou mensagens.
- [x] Implementar configuração de serviço por unidade/família e homologação obrigatória, inicialmente em observação.
- [x] Integrar decisão por ciclo e histórico, preservando conversão comercial e registros anteriores.
- [x] Testar LEGADO/OBSERVAÇÃO e NOVO isolado, regressões sem envios reais; entregar relatório com limites.
- [ ] Ativar NOVO — depende de homologação e aprovação explícita; fora desta etapa.

## FU Fase 2.2A — controle de contatos em observação
- [x] Diagnosticar evidências e identidade existentes; preservar segurança e fluxos legados.
- [x] Implementar elegibilidade, reserva atômica e histórico central mínimo, com configuração por fluxo/unidade inicialmente em observação.
- [x] Integrar contatos automáticos e confirmações manuais/presenciais sem contar avisos internos.
- [x] Validar intervalos, concorrência, histórico e regressões sem envios reais; implantar observação e entregar relatório.
- [ ] Ativar bloqueios efetivos — depende de aprovação após análise da observação; fora da ativação desta etapa.

## FU Fase 2.1 — P01 e P02
- [x] Restringir os três endpoints por identidade, perfil e unidade, preservando chamadas legítimas do agendador.
- [x] Registrar REAG por experimental antes do envio, com reserva atômica, estado rastreável e bloqueio de tentativas ambíguas.
- [x] Validar segurança, banco e regressões isoladas sem mensagens reais; aplicar correções e entregar relatório (86 testes + ensaio SQL).

## FU Matriculados — boas-vindas Comercial
- [x] Reutilizar matrícula, tarefas e Telegram existentes com geração única e sem retroativos/renovações.
- [x] Avisar Comercial por unidade e confirmar envio manual com autorização, histórico e edição original.
- [x] Validar geração, destino, idempotência e callbacks sem disparos de teste à produção: banco isolado, 23 Deno, 17 Bun, página autenticada e automação instalada em modo sem envio.
- [ ] Homologar Abrir/Enviado no Telegram real — depende de matrícula nova elegível ou autorização de teste controlado; Comercial Aflitos ainda não conectado.

## FU gerencial M+30 — experiência do aluno
- [x] Adaptar estrutura existente sem duplicar acompanhamento e preservar outros FUs.
- [x] Integrar avisos individuais GERENTE e confirmação Abrir/Enviado com autorização por unidade.
- [x] Registrar acompanhamento e histórico, presencial, conflitos e reclamações vinculadas ao aluno.
- [x] Validar geração, idempotência, permissões e botões simulados sem disparos indevidos à produção.
- [ ] Homologar clique real no Telegram e conclusão real pelo gerente — depende de nova matrícula elegível ou autorização de teste controlado; nenhum disparo de teste feito.

## FU técnico do Coordenador Geral — Fase 1
- [x] Atualizar textos, botões Abrir/Enviado e confirmação manual separada da conclusão, com histórico e bloqueio de lembretes confirmados.
- [x] Validar callbacks simulados, duplicidade concorrente, permissões e edição da mensagem sem novos disparos na produção.
- [x] Analisar matrícula efetiva, tarefas/histórico, grupos e agendador existentes.
- [x] Implementar geração idempotente M+7/M+21 e registro técnico nas tarefas existentes.
- [x] Integrar avisos individuais no Telegram da unidade e links WhatsApp manuais.
- [x] Validar regras em banco fictício, permissões simuladas e formulário; abrir Tarefas com login real e informar limites.
- [ ] Homologar botões reais no Telegram e conclusão real por coordenador — depende de matrícula nova elegível ou autorização de teste controlado; exemplo anterior enviado a Boa Viagem, mas não valida os novos botões.

- [x] Bloquear temporariamente Folha de Pagamentos e Ajuda de Custo para todos exceto administradores, sem alterar dados financeiros.

- [x] Separar os dados de pagamento dos avisos de cobrança no Telegram para facilitar copiar e colar.

- [x] Conferir callback OAuth BTG real — função publicada respondeu 400 para pedido sem state; autorização e troca do código usam o mesmo retorno. URL disponível no botão Copiar retorno para o BTG; consentimento real ainda depende das credenciais e cadastro no banco.

- [ ] Conectar DDA do BTG ao Contas a Pagar por unidade — implementar cadastro/consentimento e consulta; concluir após credenciais do aplicativo BTG, autorização real e validação dos boletos importados.

- [x] Corrigir visibilidade e controles da lista de FU de matriculados na Operação.

- [x] Ajustar FU de matriculados e pendentes para dias úteis, com fins de semana transferidos para a semana seguinte sem duplicidade.

- [x] Enviar os follow-ups a realizar aos gerentes pelo Telegram de segunda a sexta.

- [x] Gestão da Rede: separar a meta mensal em Meta Mínima e Supermeta
- [x] Cronograma: campos Prioridade e Setor na nova atividade, edição, edição rápida, edição em lote e detalhes (auditoria já coberta pelo histórico da atividade)
- [x] Formulários operacionais: unidades renomeadas para Madalena, Boa Viagem e Setúbal, com Setúbal habilitado em todos os formulários
- [ ] Etapa 11 EVO OPS: API Hermes (Edge Function segura)
- [ ] Corrigir instância operacional da Z-API (assinatura vencida) para envios automáticos de encerramento

- [ ] Usuário cria bot no BotFather e fornece token; salvar como TELEGRAM_BOT_TOKEN e testar conexão na página Telegram

## Folha – experiência mensal (pedido 29/10)
- [x] Seletor de ano + meses Jan–Dez, status aberta/fechada, rolagem no celular
- [x] Abrir em aba Folha no mês atual, tabela de conferência (PC) e cartões (celular)
- [x] "Preparar folha de [mês]": revisar ativos, criar só lançamentos ausentes, sem copiar variáveis
- [x] Fluxo destacado: preparar → lançar → conferir → fechar → Clara
- [x] Aviso de edições não salvas ao trocar mês/ano/unidade
- [x] Validar com dados fictícios simulados
- [ ] Publicar — aguardando aprovação da interface

## Ajuda de Custo (pedido 29/10)
- [x] Página, menu, cálculo, preparar, fechar próprio, lotes por parcela (preview + pacote pendente)
- [ ] Aplicar banco/função e publicar — aguardando aprovação de Emanuel
- [x] Fase 3 — indicadores (dev concluída; publicação pendente da homologação final)
