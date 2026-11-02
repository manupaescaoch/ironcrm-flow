# FU gerencial M+30 — implementação e validação

## Entrega
- Tarefas existentes recebem acompanhamento gerencial por aluno/matrícula/M+30. Prazo: data de fechamento +30 dias corridos, sábado/domingo deslocados para segunda. Apenas novos eventos após ativação em 02/11/2026; nenhum backfill.
- Reutilizados tarefas, histórico, callback operacional diário, utilitários de telefone e Telegram, webhook único e padrão Abrir/Enviado técnico. Não foram adicionados cron, página, KPI ou seção de Operação.
- Para ciclos gerenciais novos, suprimir somente a apresentação G+30 sobreposta em lista/painel legados. Registros G+30 anteriores, G+7, Comercial, Recepção M+30, técnico M+7/M+21, experimentais e faltantes permanecem independentes.
- Abrir usa telefone cadastrado com texto preenchido editável. Enviado exige Telegram vinculado e papel admin/gerente da unidade; valida mensagem original, registra responsável/hora uma vez e edita essa mensagem removendo botões. Não confirma entrega WhatsApp nem conclui acompanhamento.
- Em Tarefas, abrir o acompanhamento gerencial; preencher gerente, data, canal, percepção, reclamações, melhorias e providências; selecionar Concluído e Salvar. Presencial não exige confirmação WhatsApp. Confirmação e conclusão aparecem no histórico do aluno.

## Grupos identificados
GERÊNCIA | BOA VIAGEM, GERÊNCIA | MADALENA, GERÊNCIA | SETÚBAL e GERÊNCIA | SANTA CRUZ: conectados. Destino é exclusivamente group_type gerencia da unidade atual, sem fallback.

## Histórico e limites
- Consultar contatos e respostas persistidos por unidade/aluno, confirmações técnicas/gerenciais, follow-ups concluídos, mensagens e envios comerciais, NPS e contatos agendados. Evidência é guardada no contexto da tarefa.
- Contato/resposta recente: adiar gerencial para dia útil posterior ao término de 72h (conservador para registros sem hora). Conflito agendado no dia: adiar somente gerencial respeitando pelo menos 24h. Nenhum outro FU é reagendado.
- NPS baixo aberto gera prioridade; conversa aberta gera alerta. Objetivo G+30 já concluído no ciclo bloqueia novo envio até revisão/dispensa.
- Reclamações sem vínculo inequívoco ao aluno e WhatsApp pessoal fora do CRM não podem ser detectados automaticamente. Conferência do histórico e perguntas já respondidas permanece manual; não há análise semântica ou alegação de entrega WhatsApp.
- Gerente não identificado inequivocamente permanece [GERENTE] para edição manual; não inventar pessoa.

## Evidências
- 9 testes gerenciais Bun +8 técnicos: 17 passaram.
- 22 testes Deno: gerencial individual por unidade, diário, sem contato automático, callbacks/remoção/edição/permissão simulados e regressões técnicos/gerente legado/dias úteis passaram.
- PostgreSQL isolado fictício: executada a migração efetivamente aplicada com fixtures próprias; geração única, sem retroativo, prazo M+30, técnico preservado, confirmação sem conclusão, mensagem/grupo/usuário inválidos recusados, repetição idempotente, histórico único, conclusão presencial, coordenador recusado, proteção contra escrita direta, 72h, reclamação e inativação passaram.
- Banco real: colunas/funções presentes; zero tarefas gerenciais retroativas após aplicação. Nenhum aluno/tarefa fictício criado em produção.
- Página Tarefas abriu com sessão real admin sem erro. Formulário gerencial testado com aluno fictício e todos os writes interceptados; link e payload de conclusão presencial conferidos visualmente. Não é teste de salvamento real.
- Compilação observada: build OK. Funções verificadas pelo Deno e implantadas somente webhook único e callback operacional existente.

## Não verificado / pendências
- Nenhum teste enviado a grupo de produção. Clique real Abrir/Enviado, edição no Telegram real e conclusão com sessão real de gerente ainda não homologados: precisam de matrícula nova elegível ou autorização de teste controlado.
- Testes isolados cobrem permissões, não substituem login real de gerente/usuário de outra unidade.
- Interface está no preview; publicação do site não foi solicitada nem realizada nesta etapa.