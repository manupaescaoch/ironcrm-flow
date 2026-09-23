# Resumo operacional separado por unidade

## Objetivo
Enviar o resumo diário do Telegram em três mensagens independentes: EVO Madalena, EVO Boa Viagem e EVO Setúbal.

## Alterações
- Remover o consolidado único e montar uma mensagem por unidade.
- Manter, em cada mensagem, a ordem solicitada: alunos, meta, realizado, faltam, matrículas, comparação semanal, comparecimento, conversão, vendas, ticket médio, receitas recorrentes e foco do dia.
- Calcular “Vendas do mês” como matrículas do mês × ticket médio.
- Exibir a receita recorrente projetada do mês e a referência do mês anterior com os dados disponíveis da unidade.
- Enviar as três mensagens individualmente ao mesmo destinatário no Telegram e registrar o resultado de cada envio.

## Validação
- Publicar a função atualizada.
- Executar um teste sem alterar o agendamento diário e confirmar que as três unidades foram enviadas separadamente.
