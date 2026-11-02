# FC-2A.1 — Rastreabilidade de experimentais

## Objetivo e aprovação
Criar ciclos identificáveis e resultados explícitos **Pendente / Compareceu / Não compareceu**, preservando operação e histórico. Esta entrega é somente diagnóstico e proposta: **nenhuma migração, mudança de código ou implantação foi executada**. Implementação depende da aprovação deste plano.

## Diagnóstico
- A edição de interação transforma null em false e pode registrar falta sem escolha explícita.
- Reagendamento sobrescreve data/hora da mesma interação, sem trilha completa de ciclos.
- Triggers instalados podem substituir horário e unidade pela informação atual do lead; há 19 triggers em interações, incluindo efeitos de presença nos follow-ups.
- Telegram grava resposta e atualização da interação separadamente, podendo divergir em falha intermediária.
- Cron existente consulta a cada cinco minutos, enviando ao COMERCIAL a partir de 30 minutos após a aula (janela atual até seis horas).
- O fluxo negativo existente envia **WhatsApp comercial ao lead** via REAG. Não foi encontrado aviso separado à recepção; nenhum novo destinatário será criado por inferência.

O relatório técnico entregue detalha schema instalado, todos os caminhos identificados, permissões, triggers, riscos e testes.

## O que implementar após aprovação
1. Criar um ciclo por novo agendamento, congelando lead, unidade, interação e data/hora originais.
2. Registrar confirmações explícitas com origem, responsável real quando disponível, horário servidor e histórico de correções.
3. Ao reagendar, preservar o ciclo anterior e criar sucessor pendente. Botão antigo nunca responde pelo novo ciclo, mesmo se houver retorno ao mesmo horário.
4. Atualizar os caminhos de criação, edição, presença, cancelamento, remoção e integração EVO Chat. Salvar descrição sem alterar presença não cria confirmação.
5. Manter Telegram atual, webhook único, botões e grupo COMERCIAL. Confirmar de forma atômica e preservar chamada única ao REAG existente.
6. Adaptar somente os indicadores operacionais para ler novos ciclos, separando legado inconclusivo e taxa parcial comprovada. Preservar os 13 campos comerciais anteriores e os nomes/estrutura dos campos operacionais.

## Detalhes técnicos
### Schema aditivo proposto
- `experimental_ciclos`: UUID, interação/lead/unidade, data/hora originais, criação/origem, responsável nullable, predecessor nullable, situação ativo/substituído/cancelado, resultado pendente/compareceu/nao_compareceu, versão e último evento.
- `experimental_ciclo_eventos`: ledger append-only com vínculo/snapshot do ciclo, tipo de evento, resultado anterior/novo, timestamp, origem, identificador real do responsável, idempotência, versão, motivo de correção e referência à mensagem Telegram existente.
- Referências nullable em `interacoes.experimental_ciclo_atual_id` e `experimental_presenca_telegram.ciclo_id`. **Sem backfill.**
- Identidade/slot originais imutáveis; resultado/situação são projeções atualizadas junto à evidência na mesma transação. Um ciclo ativo por interação. Não deduplicar por telefone.
- Tabelas com GRANTs, RLS por unidade e admin no servidor; clientes sem escrita direta. Operações manuais e de serviço com permissões distintas, verificando ciclo/interação/lead/unidade/data/hora.
- FKs/guards preservam evidência: origem com ciclo não poderá ser apagada em cascata; orientar cancelamento/inativação.

### Escrita e integridade
- Operações atômicas para agendar, confirmar, corrigir, cancelar e reagendar; lock/versionamento e chave idempotente.
- Confirmação Telegram resolve o controle exato por chat/message/ciclo, não a mensagem mais recente da interação. Guard de ciclo anterior e grupo correto.
- Correção somente manual autorizada com motivo; guardar antes/depois. Clique equivalente é noop; contrário não corrige silenciosamente.
- Para novos ciclos, guard independente bloqueia mutações diretas de campos protegidos fora das operações autorizadas; contexto interno não pode ser flag forjável do frontend.
- Compatibilização estreita dos triggers de hora/unidade para não sobrescrever intenção validada em **novos ciclos**; ramos legados e demais triggers permanecem com critérios atuais.
- Compareceu legado preservado; novas operações pendentes escrevem null explicitamente. **Não alterar default nesta primeira implantação.**
- Uma atualização de projeção por confirmação; preservar efeitos atuais de D+/M+/G+, matrícula e sincronização Telegram, sem nova régua/agendador.

### Legado e indicadores
- Não converter os 121 false de outubro nem reclassificar os 218 grupos antigos em revisão.
- Não criar ciclos históricos fictícios. Reagendamento novo de interação antiga começa rastreabilidade no sucessor, com referência legada limitada, sem inventar predecessor.
- Mensagens antigas seguem ramo legado seguro sem criar ciclo artificial nem tocar sucessor.
- Não duplicar eventos entre leitura de interações legadas e ciclos rastreáveis. Metadados separam cobertura e taxa parcial dos comprovados; histórico inconclusivo continua separado.

## Implantação e rollback
1. Aprovar plano e esclarecer qualquer novo destino de aviso à recepção; por padrão preservar WhatsApp atual ao lead.
2. Ensaiar schema/RPCs/guards e regressões em banco isolado, sem mensagens reais.
3. Aplicar migração aditiva sem ativar escritores nem preencher histórico.
4. Integrar todos os escritores da unidade piloto antes de ativação coordenada; manter autenticação e credenciais existentes.
5. Adaptar leitura analítica, comparar campos anteriores e homologar idempotência/consistência.
6. Homologação de mensagens reais somente com autorização específica ou acompanhamento de ciclo natural elegível, sem testes fictícios em produção.

Rollback mantém tabelas/evidências/chaves. Desabilitar novos ciclos no piloto, mas manter operações seguras para ciclos já rastreados; não voltar para escrita direta cega, apagar histórico ou repetir mensagens/callbacks. Não alterar registros históricos para “desfazer” implantação.

## Testes de aceitação
Cobrir os 25 cenários solicitados, incluindo presença/falta manual e Telegram, repetição, ciclo antigo, remarcação antes/depois de resultados, duas unidades/horários, edição sem resposta, default false, correção auditada, autorização, conflito/concorrência, falha de rede e reentrega. Acrescentar testes de triggers hora/unidade, escrita direta negada, exclusão sem cascata, paginação, Recife e privacidade. Preservar REAG e follow-ups existentes; comparação dos 13 campos e segregação FC-2A antiga/nova.

## Fora do escopo
Backfill, mudança de preços/planos/regras comerciais, reinterpretação histórica, novos destinatários por inferência, novas automações, novos tokens, mudanças nas Fases 2.1/2.2A/2.2B e início da FC-2B.