# Simplificar o cadastro de Nova Conta

O modal passa a ter apenas o essencial:

**Obrigatórios**
- Descrição
- Vencimento
- Valor

**Dados de pagamento (todos opcionais, preencha o que tiver)**
- Código Pix (copia e cola)
- Chave Pix
- Linha digitável
- Código de barras
- Link de pagamento

Removidos da tela: Fornecedor, Categoria, Centro de custo, Competência, Observações, Forma de pagamento, Número da fatura, Banco/Agência/Conta/Favorecido, anexo de documento.

## Comportamento

- A unidade continua sendo a selecionada no sistema (não editável).
- A forma de pagamento é definida automaticamente pelo dado informado: Pix (código/chave), Boleto (linha digitável/código de barras) ou Link. Isso mantém os filtros e a listagem funcionando como hoje.
- A importação por texto continua igual: se identificar descrição, vencimento e valor, cadastra automaticamente; os dados de pagamento reconhecidos (Pix, boleto, link) vão para os campos correspondentes.
- A mensagem enviada ao grupo do WhatsApp segue o formato atual (Unidade → Descrição → Vencimento → Valor → dado de pagamento) e passa a incluir o link de pagamento quando houver.
- A checagem de duplicidade permanece por descrição + valor + vencimento + código Pix / linha digitável.
- Contas já cadastradas mantêm todos os dados antigos; o drawer de detalhes só exibe os campos preenchidos.

## Detalhes técnicos

- Migração: adicionar `link_pagamento` (texto, opcional) em `contas_pagar` e remover a obrigatoriedade de `fornecedor`, `categoria` e `forma_pagamento` (passam a aceitar vazio).
- `ContaFormFields.tsx`: reduzir o formulário e a validação aos 3 campos obrigatórios; manter os 5 campos de pagamento; `contaFormToPayload` deriva `forma_pagamento`.
- `NovaContaModal.tsx`: remover o slot de upload de documento e a lógica de campos extras.
- `parseContaTexto.ts`: reconhecer também "Link"/URL de pagamento.
- `ContasTable.tsx`, `ContaDetalhesDrawer.tsx`, `ContasFiltros.tsx`, `SucessoConta.tsx`: tolerar fornecedor/categoria vazios e exibir o link quando existir.
- `_shared/contasPagarMensagem.ts`: incluir bloco de link de pagamento; redeploy das funções de envio.
