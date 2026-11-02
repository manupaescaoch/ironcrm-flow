# Roadmap

## FC-2A.1 — diagnóstico e proposta, sem implementação
- [ ] Mapear todos os caminhos de escrita, consumidores, permissões e triggers de experimental/presença/reagendamento.
- [ ] Entregar relatório técnico e plano de schema, compatibilidade, implantação, rollback e testes.
- [ ] Implementar rastreabilidade — aguarda aprovação explícita do plano; nenhuma mudança operacional nesta execução.

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
