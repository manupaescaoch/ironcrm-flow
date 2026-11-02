# FU técnico — Fase 1

## Implementado
- Novas matrículas que fecharem após a instalação criam duas tarefas vinculadas à interação de matrícula: M+7 e M+21. Prazos em dias corridos da data de fechamento, conforme escolha de Manu. Sem importar matrículas antigas.
- Estruturas existentes: `tasks`, `task_history`, histórico de FU no aluno, Telegram e callback operacional diário das 08h Recife. Sem novo agendamento, página exclusiva ou KPI na Operação.
- Identidade única aluno + matrícula + etapa; tarefa encerrada não pode ser excluída/reaberta. Novo ciclo cancela pendências do ciclo anterior.
- Transferência acompanha unidade atual nas tarefas pendentes, preservando unidade original e registro das encerradas. Inativação e cancelamento cancelam pendências.
- Coordenação/gerência da unidade e admin podem registrar; validação também no banco, não apenas na tela.

## Telegram
- Grupos `coordenadores` conectados identificados nas quatro unidades: Boa Viagem, Madalena, Setúbal e Santa Cruz do Capibaribe. Nenhum ID presumido, nenhum fallback para outro tipo de grupo.
- Uma mensagem individual por tarefa elegível, com os textos curtos aprovados na atualização e botões inline “💬 Abrir” (URL) e “✅ Enviado” (callback). Confirmação de envio manual é separada da entrega da notificação pelo bot e da conclusão técnica.
- Callback verifica usuário Telegram vinculado, papel admin/gerente/coordenador, unidade, grupo conectado, matrícula ativa e ID da mensagem atual. Registra data/hora, usuário CRM/Telegram e nome, com bloqueio de cliques simultâneos.
- Após confirmar, edita a mensagem original em HTML e remove os botões, sem segunda mensagem de confirmação. Falha de edição pode ser recuperada repetindo o clique, sem repetir registro ou auditoria.
- Envios confirmados não recebem novos lembretes. Acompanhamento técnico segue aberto; clicar Abrir não altera status. Avisos antigos substituídos não confirmam a tarefa.
- Reserva atômica por tarefa/dia de Recife evita duplicação concorrente. Falhas ficam registradas na tarefa e no log existente. Após resultado incerto de rede não há repetição no mesmo dia; tentativa no próximo dia evita duplicar mensagem possivelmente recebida.
- Grupo ausente fica sinalizado, sem envio alternativo. Nome do coordenador usa responsável definido na tarefa ou único funcionário ativo com usuário vinculado de papel coordenador; ausência/ambiguidade mantém `[COORDENADOR]` para edição.
- Exemplo demonstrativo anterior enviado ao grupo Boa Viagem mediante pedido explícito, com confirmação da API Telegram. Esse exemplo não tinha os novos botões, portanto não homologa o fluxo atualizado. Nenhum novo disparo de teste realizado nesta atualização.

## WhatsApp
- Telefone brasileiro normalizado e validado; texto codificado no link. Telefone inválido mantém tarefa, mas sem link.
- Link não chama integração de envio nem altera status. Mensagem pode ser editada no formulário antes de abrir o WhatsApp.
- URL e texto decodificado validados automaticamente. Não foi aberta uma conversa real no WhatsApp nem confirmado comportamento do aplicativo externo.

## CRM
- Em Gerencial → Tarefas, abrir acompanhamento técnico. O formulário possui situação, data, coordenador, canal presencial/WhatsApp, observações, dificuldades, ajustes e encaminhamentos.
- Concluído/dispensado/cancelado manualmente exige data, coordenador, canal e observações. Conclusão presencial não requer telefone ou envio.
- Registro salvo na própria tarefa, auditado em `task_history` e exibido no histórico do aluno. Acompanhamentos anteriores podem ser consultados pelo formulário.
- Não há fonte de treinos/frequência validada nessa implementação. Consulta de treinos/treinador e reclamações fora dos registros técnicos permanece manual; não se inventam resultados.

## Evidências e limites
- 8 testes Bun aprovados: dias M+7/M+21, não elegíveis, telefone/link e registro presencial.
- 15 testes Deno aprovados: 9 de regras técnicas/callback/edição e 6 existentes de FU gerencial/dias úteis. API Telegram simulada; não são testes de botão real no grupo.
- Novo ensaio PostgreSQL local: identidade vinculada, grupo errado e mensagem antiga recusados; confirmação grava data/hora/usuários; status técnico permanece pendente; auditoria única; lembretes confirmados bloqueados; cancelado recusado. Duas conexões concorrentes: exatamente uma confirmação nova e uma resposta duplicada.
- Ensaio PostgreSQL local vazio com dados fictícios: sem backfill, duas etapas, idempotência, conclusão obrigatória, presencial, proteção contra exclusão, outra unidade recusada, reserva diária, transferência/histórico, inativação e novo ciclo/cancelamento.
- Permissões no ensaio usam auth/roles fictícios; não equivalem a login real de coordenador em produção.
- Tarefas abriu com login real de admin, sem erro de página.
- Formulário completo e payload de conclusão presencial exercitados com login real e respostas de dados simuladas no navegador; todas as gravações interceptadas. Não é validação de salvamento real.
- Verificação do compilador das funções passou e preview compilou sem erro.
- Zero tarefas técnicas históricas geradas ao aplicar. Não criou alunos fictícios na produção.

## Preservação e publicação
- Nenhum gerador/template de FU Comercial, Recepção ou Gerência modificado; callback existente apenas chama rotina técnica adicional, com falha isolada. Testes existentes acima passaram, mas não foram disparados os outros FUs em produção para revalidar envio real.
- Nenhum KPI ou seção adicionada à Operação.
- Nenhuma mensagem automática enviada aos alunos e nenhum novo teste disparado em grupo real nesta atualização.
- Banco alterado e função existente atualizada no projeto. Interface está no preview; publicação do site não solicitada nem executada nesta fase.
- Pendências: homologação real no Telegram e conclusão por coordenador, confirmação de responsável por unidade quando ambíguo, avaliação externa do link no aplicativo WhatsApp.