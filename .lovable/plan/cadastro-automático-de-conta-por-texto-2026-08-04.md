# Cadastro automático de conta por texto

Hoje, ao colar o texto e clicar em "Analisar texto", o sistema apenas preenche a aba manual e espera um clique em "Cadastrar conta". A proposta é: quando o texto vier no formato padrão e todos os dados obrigatórios forem identificados, a conta é cadastrada automaticamente.

## Como vai funcionar

Formato reconhecido (uma conta por colagem):

```text
EVO BOA VIAGEM
Descrição: SICOOB PA - OLINDA/PE
Vencimento: 12/08/2026
Valor: R$ 5.190,01
Boleto:

75696.42932 03000.023642 00145.189130 4 15360000519001
```

1. O usuário cola o texto na aba "Importar por texto" e clica no botão (renomeado para "Analisar e cadastrar").
2. O sistema interpreta o texto e verifica se descrição, valor, vencimento, categoria e forma de pagamento foram identificados.
3. Se estiver tudo identificado: a conta é cadastrada na hora, na unidade selecionada, com o envio para o grupo financeiro no WhatsApp acontecendo como já acontece hoje. A tela de sucesso aparece direto.
4. Se faltar algum dado obrigatório: nada é salvo; o sistema abre a aba manual com os campos faltantes em vermelho, como já faz hoje.
5. Se o texto mencionar uma unidade diferente da unidade selecionada: não salva automaticamente. Abre a aba manual com o aviso atual, para o usuário confirmar ou trocar a unidade antes de cadastrar.
6. Se o sistema encontrar uma conta parecida já cadastrada (mesma descrição/valor/vencimento ou mesmo boleto/Pix), o aviso de possível duplicidade continua aparecendo para confirmação — o salvamento automático não ignora essa checagem.

## Detalhes técnicos

- `src/components/contas-pagar/NovaContaModal.tsx`: a função `analisarTexto` passa a receber o resultado do parse, montar o `ContaFormState` e, quando `validateContaForm` retorna vazio e não há divergência de unidade, chamar diretamente o fluxo de `salvar` com esse estado (em vez de depender do `form` no state, o `salvar` recebe o form como parâmetro para evitar corrida de renderização).
- Mantém `buscarDuplicidade` e o `DuplicidadeDialog` no caminho automático.
- Nos casos de pendência (campos faltando ou unidade divergente), comportamento atual preservado: `setAba('manual')` + destaque de erros + toast explicativo.
- Botão da aba texto passa a exibir "Analisar e cadastrar" com estado de carregamento durante o salvamento.
- Sem mudanças de banco de dados, de RLS ou de edge functions.
