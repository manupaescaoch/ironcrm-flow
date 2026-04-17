

## Diagnóstico

A unidade **Iron Zona Sul** tem apenas **1 tipo de atividade cadastrado** no Cronograma Operacional: "ENCERRAMENTO DE TURNO – ESTAGIÁRIO LÍDER", às 11h, 17h e 23h, e essas mensagens **estão sendo enviadas normalmente** (último envio: hoje 02:00 UTC = 23h Brasília ontem para Mari Yoshinari; ontem 14h/20h UTC para Felipe e Jon).

**Não existe nenhuma outra atividade cadastrada na Zona Sul** — por isso "as atividades não estão indo aos responsáveis": elas simplesmente não foram criadas no sistema para a Zona Sul.

### Comparação:
- **Zona Sul**: apenas 1 título de atividade ("ENCERRAMENTO DE TURNO") cadastrado, e essa funciona.
- Outras unidades (Zona Norte) provavelmente têm cronograma completo (abertura, limpeza, conferências, etc.) e por isso recebem várias mensagens.

### Causas possíveis:
1. As atividades da Zona Sul **nunca foram cadastradas** na aba "Cronograma" do módulo Operacional.
2. Foram cadastradas mas estão **inativas** (verifiquei: só existem cópias inativas duplicadas do mesmo "Encerramento de Turno").
3. Falta replicar/copiar o cronograma da Zona Norte para Zona Sul.

## Plano de Ação

1. **Confirmar com você** se a expectativa era ter mais atividades além do "Encerramento de Turno" na Zona Sul.
2. Se sim, implementar uma das opções:
   - **Opção A**: Criar uma função "Replicar Cronograma de Outra Unidade" no módulo Operacional, permitindo copiar todas as atividades ativas da Zona Norte para a Zona Sul (com escolha de responsáveis equivalentes).
   - **Opção B**: Cadastrar manualmente as atividades faltantes na aba Cronograma → Nova Atividade, selecionando a Zona Sul no seletor de unidade.
3. Validar que após o cadastro o cron job (`*/15 * * * *`) entrega as mensagens nos horários corretos.

### Verificação técnica realizada:
- Cron job ativo (a cada 15 min) ✅
- Edge function `send-cronograma-messages` rodando sem erros ✅
- Logs mostram entregas bem-sucedidas para Felipe, Jon e Mari ✅
- Telefones dos responsáveis preenchidos ✅
- RLS e responsáveis com `cronograma_funcionarios.id` válidos ✅

**Confirme**: você quer (A) replicar o cronograma da Zona Norte para a Zona Sul automaticamente, ou (B) cadastrar manualmente quais atividades você espera ter na Zona Sul?

