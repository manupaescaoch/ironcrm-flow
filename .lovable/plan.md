

# Adicionar botão "Inativar Aluno" na tabela de Vencimentos

## Objetivo
Adicionar um botão de ação na tabela de vencimentos para marcar o aluno (lead) como inativo (`ativo = false`) quando ele não renovar o plano. Isso aparecerá junto aos botões existentes de Editar, Renovar e Ver detalhes.

## Alterações

### 1. `src/components/vencimentos/VencimentosTable.tsx`
- Adicionar botão com ícone `UserX` (já importado na page) na coluna de ações
- Ao clicar, abrir um `AlertDialog` de confirmação pedindo confirmação antes de inativar
- Ao confirmar, executar `supabase.from('leads').update({ ativo: false }).eq('id', item.leadId)`
- Exibir toast de sucesso e chamar `onRefresh`
- Botão aparece em vermelho para indicar ação destrutiva

### 2. Nenhuma alteração de banco necessária
- A coluna `ativo` já existe na tabela `leads`
- As RLS policies de UPDATE já permitem usuários com acesso à unidade atualizarem leads
- O trigger `enforce_leads_update_permissions` permite admin alterar qualquer campo; para não-admin, precisamos verificar se `ativo` está na lista de campos bloqueados -- sim, está bloqueado para não-admin/não-owner. Apenas admin e o criador do lead poderão inativar.

### Detalhes técnicos
- O `enforce_leads_update_permissions` bloqueia alteração de `ativo` por não-admin/não-owner. Isso é o comportamento correto (só admin/recepção que criou o lead pode inativar).
- Componente usado: `AlertDialog` do shadcn para confirmação

