# Correção das notificações gerenciais — 03/11/2026

## Resultado e escopo

Implantada somente a função `notify-resumo-gestao-operacional`, com duas alterações gerenciais:

1. `sendManagerFuDigest` tornou-se um emissor desativado sem efeitos colaterais. Retorna `{ "success": true, "skipped": "resumo_gerencial_legado_desativado", "results": [] }`; não consulta históricos, cria reservas, observa candidatos ou acessa o Telegram. A assinatura e o retorno compatíveis evitam quebrar o endpoint e seu modo diagnóstico existente.
2. `sendManagerExperienceFu` isola erros por acompanhamento: erro de contexto, reserva, funcionário ou persistência registra resultado de erro e permite processar a tarefa seguinte. Uma reserva já adquirida não é liberada em falha ambígua, prevenindo repetição de envio.

Não foram alterados o endpoint principal, seus demais chamadores, textos gerenciais, botões, grupos, banco, triggers, cortes de ativação ou históricos. Não houve implantação do webhook ou de qualquer outra função. Nenhuma alteração em Comercial, Recepção, Coordenador, REAG, indicadores, financeiro ou FC-2A.1.

## Testes

**35 testes automatizados aprovados, zero falhas finais:**

- 24 Deno: 4 novos testes integrados do endpoint, 2 de desativação sem consultas, 1 de emissor individual, 5 de callbacks gerenciais, 3 de calendário, 4 de callbacks técnicos e 5 de regras técnicas.
- 11 Bun: regras existentes de prazo, telefone, acompanhamento presencial e mensagens gerenciais.

**3 suítes SQL aprovadas em PostgreSQL local descartável**, sem acesso a produção:

- `docs/fu-gerencial-tests.sql`: geração M+30, duplicidade diária, rejeição de usuários sem vínculo/perfil, grupo/mensagem incorretos, confirmação idempotente sem conclusão, controle de 72 horas e histórico.
- `docs/fu-homologacao/homologacao-gerencial.tests.sql`: M+15/M+30, cortes sem retroativos, fim de semana para segunda, confirmação separada da conclusão e matrícula cancelada.
- `docs/fu-homologacao/gerencial-unit-authorization.tests.sql`: gerente vinculado a outra unidade não confirma a tarefa e nenhuma confirmação é persistida.

Os testes integrados executam o handler real do endpoint com dados fictícios, credenciais fictícias e transporte totalmente interceptado. Validam:

- ausência da lista `FOLLOW-UPS DO GERENTE` e dos acessos/reservas legados;
- M+15 e M+30 individualmente, link manual correspondente à mensagem aprovada e callback da tarefa correta;
- seleção exclusiva de GERÊNCIA, mesmo com outro setor disponível; ausência de grupo não redireciona;
- execução repetida não duplica avisos individuais;
- falha no primeiro acompanhamento não interrompe o segundo nem as três mensagens operacionais;
- falha após envio preserva a reserva e evita repetição;
- execução técnica permanece chamada; nenhuma escrita de conclusão ou confirmação pelo lembrete;
- modo diagnóstico sem envios ou gravações.

## Evidência da implantação

- Ferramenta de implantação confirmou sucesso somente de `notify-resumo-gestao-operacional`.
- SHA-256 do artefato submetido (arquivos/configuração): `0f9a2e9eb1ac8c548866f1f88fe1d203a06eb4cccbd25cd46dce4e2f79d991f6`.
- Grafo de 14 arquivos importados conferido: nenhuma referência aos candidatos FC-2A.1. Nenhuma migração foi aplicada.
- Verificação real da função implantada com autenticação cron e `{ "mode": "fu_gerente_only", "dry_run": true }`: **HTTP 200**, retorno exato do emissor desativado. Esse caminho também executa o processamento individual em modo somente leitura; não executa envios operacionais/técnicos por sair no modo diagnóstico.
- Consulta posterior confirmou agendador `resumo-gestao-operacional-diario-0800` ativo, expressão `0 11 * * *` (08:00 Recife), sem alteração.
- Contagens gerenciais antes/depois iguais: 1 M+30 pendente, 2 M+30 cancelados e 2 M+15 cancelados.
- Consulta de `telegram_message_logs` desde 11:57 UTC do dia 03/11: nenhum registro de envio gerencial legado, individual ou operacional durante a execução desta correção.
- Sinal automático do projeto: `build OK` em 12:01:53 UTC.

## Limites e próximo ciclo

A verificação pós-implantação foi somente leitura, sem antecipar a rotina real das 08:00 e sem enviar mensagens de teste a alunos ou grupos. O próximo ciclo automático de 04/11 às 08:00 Recife ainda não ocorreu; portanto, não se afirma observação dessa execução futura. A consulta de logs da função não retornou entradas; a evidência de processamento implantado é o HTTP 200 autenticado e o marcador exclusivo do código corrigido.

Não há necessidade de publicar toda a interface: a implantação exclusiva da função já aplica esta correção ao ambiente em uso e evita incluir conteúdo pendente de outras iniciativas.