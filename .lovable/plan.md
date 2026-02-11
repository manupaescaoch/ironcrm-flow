

# Editar Datas Diretamente na Tabela de Vencimentos

## O que sera implementado
Permitir que o usuario clique diretamente nas datas de Fechamento e Vencimento na tabela para edita-las inline, sem precisar abrir o modal.

## Como vai funcionar

### Para o usuario
1. As datas de **Fechamento** e **Vencimento** na tabela terao um estilo clicavel (icone de lapis sutil ao lado)
2. Ao clicar em uma data, ela se transforma em um campo de data editavel (input date) no lugar
3. Ao confirmar (pressionar Enter ou clicar fora), a data e salva automaticamente no banco
4. Um toast confirma a atualizacao ou informa erro
5. O botao de lapis do modal continua disponivel para quem preferir editar ambas as datas de uma vez

### Detalhes Tecnicos

**Arquivo: `src/components/vencimentos/VencimentosTable.tsx`**

1. Criar um componente interno `InlineEditableDate` que:
   - Mostra a data formatada por padrao com um icone de lapis discreto ao hover
   - Ao clicar, troca para `<Input type="date" />` com o valor atual
   - No `onBlur` ou `onKeyDown (Enter)`, faz a chamada ao Supabase para salvar
   - Usa `supabase.from('interacoes').update({ [campo]: novaData }).eq('id', itemId)`
   - Chama `onRefresh()` apos salvar com sucesso

2. Substituir as celulas estaticas de Fechamento e Vencimento pelo componente `InlineEditableDate`:
   - Celula Fechamento: campo `data_fechamento`
   - Celula Vencimento: campo `data_vencimento`

3. Feedback visual:
   - Campo em edicao tera borda azul sutil
   - Loading spinner durante o salvamento
   - Toast de sucesso/erro via `sonner`

