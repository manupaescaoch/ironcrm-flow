
# Incluir Nome da Unidade nas Mensagens WhatsApp de Tarefas

## O que muda
As mensagens de WhatsApp enviadas ao atribuir ou transferir tarefas passarao a incluir o nome da unidade, facilitando a identificacao para quem recebe.

### Exemplo da mensagem atualizada:
```
📋 *Nova Tarefa Atribuída*
📍 Unidade: *ZONA NORTE*

Você foi designado para: *BOLETO NANITAS 18/02 O VENCIMENTO*

📝 *Descrição:*
45090.02004 00159.596626 20218.042008 7 13610000036750

Atribuída por: Sistema

Acesse o sistema para ver os detalhes.
```

## Detalhes Tecnicos

**1. Edge Function (`supabase/functions/send-task-whatsapp/index.ts`)**
- Aceitar novo parametro `unidade_nome` no body da requisicao
- Adicionar linha `📍 Unidade: *${unidade_nome}*` nas mensagens de nova tarefa e tarefa transferida

**2. Hook (`src/hooks/useTarefasData.ts`)**
- Adicionar parametro `unidadeNome` na funcao `sendWhatsAppNotification`
- Passar `unidade_nome` no body da chamada a edge function
- Nos pontos onde `sendWhatsAppNotification` e chamado (`createTask` e `updateTask`), passar `unidadeAtual.nome` como parametro
