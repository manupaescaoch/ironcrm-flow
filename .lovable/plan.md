# Meta Mínima e Supermeta

## O que será alterado
- Renomear a meta atual de alunos do mês para **Meta Mínima**, preservando todos os valores já cadastrados.
- Adicionar uma **Supermeta** separada para cada unidade, preenchida manualmente no mesmo botão **Editar meta**.
- Exibir os dois níveis no Dashboard e na visão consolidada de Gestão da Rede.
- Atualizar os cálculos e mensagens para mostrar o avanço até a Meta Mínima e, depois de alcançá-la, o avanço até a Supermeta.
- Manter compatibilidade com os resumos operacionais existentes.

## Regras
- A Supermeta não poderá ser menor que a Meta Mínima.
- Unidades sem Supermeta cadastrada continuarão funcionando apenas com a Meta Mínima.
- Os números atuais da “Meta de alunos no mês” serão mantidos como Meta Mínima; nenhum dado será apagado.

## Detalhes técnicos
- Adicionar um campo opcional de supermeta na configuração mensal por unidade.
- Atualizar os tipos, leitura e gravação dos indicadores.
- Validar o resultado na tela em computador e celular.
