# Telegram "CONTAS A PAGAR | EVO" → cadastro automático em Contas a Pagar

## Diagnóstico
- O grupo "CONTAS A PAGAR | EVO" já está conectado ao bot do CRM, mas hoje só **recebe** avisos de vencimento; o bot ignora arquivos enviados lá.
- A leitura de documentos por IA já existe (aba "Importar documento" da Nova Conta) e extrai fornecedor, CNPJ, valor, datas, linha digitável, Pix, categoria e parcelas.
- Contas a Pagar já tem anexos privados, vários documentos por conta, histórico de alterações e baixa manual.
- **Faltam:** CNPJ de cada unidade (não existe cadastro), status "Pendente de conferência", origem/remetente do Telegram, chave de acesso de NF-e e aprovação Gabi → Andreza.

## O que será feito
1. **CNPJ por unidade** — campo novo nas unidades + tela para cadastrar (preciso que você me passe os CNPJs de Madalena, Boa Viagem, Setúbal e Santa Cruz; Madalena = 62.952.303/0001-61 já veio no exemplo).
2. **Recebimento no grupo** — quando chegar PDF, XML, JPG ou foto no grupo de Contas a Pagar, o bot baixa, guarda no armazenamento privado e lê com a mesma IA da importação. Só esse grupo é aceito; cada mensagem é processada uma única vez.
3. **Unidade** — compara o CNPJ do **pagador** (nunca o do fornecedor) com o das unidades; se não bater, responde "Documento recebido. Não foi possível identificar a unidade responsável. Selecione a unidade para continuar." com botões das unidades ativas e continua o mesmo documento após o clique.
4. **Duplicidade** — antes de criar, procura conta da mesma unidade com mesma linha digitável, chave NF-e, número da nota ou mesmo fornecedor+valor+vencimento. Nota + boleto da mesma cobrança: anexa o boleto à conta existente e completa linha digitável/vencimento; divergência de valor vai para conferência.
5. **Lançamento** — conta criada com origem Telegram, remetente, data/hora de recebimento e status **Pendente de conferência**; nunca paga nem aprovada automaticamente; nota sem vencimento fica sem data (aguardando boleto). Categorias só da lista existente; fornecedor não cadastrado fica sinalizado.
6. **Resposta no grupo** — mensagens "DOCUMENTO RECEBIDO", "CONFIRMAÇÃO NECESSÁRIA" e "DOCUMENTO JÁ CADASTRADO" no formato do pedido.
7. **Conferência e aprovação** — botões "Conferido" (Gabi) e "Aprovar" (Andreza) nos detalhes da conta; só depois de aprovada ela segue o fluxo normal e entra nos avisos de vencimento.
8. **Painel da integração** — aba nova em Contas a Pagar com recebidos, processados, criados, vinculados, duplicados, aguardando unidade, erros de leitura e aguardando conferência, com botão "Reprocessar" que não duplica.

## Ativação
Tudo fica pronto **desligado**: o bot só começa a ler o grupo depois que você autorizar e os CNPJs estiverem cadastrados.

## Preciso confirmar
- CNPJs das quatro unidades.
- Gabi e Andreza: quais contas do CRM são (ou se o "aprovar" fica para administradores).
- XML de NF-e: leio os dados direto do arquivo (mais preciso que a IA).

## Detalhes técnicos
- Migração: `unidades.cnpj`; `contas_pagar` + `origem`, `telegram_remetente`, `recebido_em`, `chave_nfe`, `conferido_por/em`, `aprovado_por/em`; status `pendente_conferencia` (fora do envio de vencimento até aprovação); tabela `contas_pagar_telegram_docs` (update_id/message_id único, file_id, path, dados extraídos, unidade sugerida, status, erro, conta_id).
- `telegram-webhook`: ramo para documentos do chat_id do grupo `contas_pagar` + `callback_query` dos botões; `allowed_updates` passa a incluir `callback_query` (via setup_webhook / guard).
- Extração movida para `_shared/extrairDocumentoConta.ts`, usada pela função atual e pelo novo processador `contas-pagar-telegram-processar` (reprocessamento admin).
- Flag `app_config.contas_pagar_telegram_ativo` = false até autorização.
