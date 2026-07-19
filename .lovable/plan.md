# Plano — Reformular "Cronograma de Atividades" no painel de Automações

## Objetivo
Transformar a lista atual (agrupada apenas por dia da semana) em uma visualização por **tipo de atividade**, com seleção múltipla, edição em massa, filtros avançados e histórico de alterações. A visão antiga por dia continua disponível.

---

## 1. Banco de dados

### 1.1 Nova coluna `tipo_atividade`
- Adicionar `tipo_atividade text` em `cronograma_atividades`.
- Backfill via função de normalização do título:
  - Remove sufixos "— Unidade X", "— Turno Y", nomes de responsável, horários.
  - Uppercase, sem acentos, trim.
  - Mapear variações conhecidas: "ENVIO DA GRADE DE HORÁRIO...", "ENCERRAMENTO DE TURNO", "RELATÓRIO DIÁRIO", "ABERTURA DE TURNO", "CONFERÊNCIA DE AGENDA", etc.
- Trigger `set_tipo_atividade` (BEFORE INSERT/UPDATE OF titulo) para preencher automaticamente quando vazio.
- Índice em `(tipo_atividade, unidade_id, ativo)`.

### 1.2 Coluna `turno`
- Já não existe em `cronograma_atividades`. Adicionar `turno text` (nullable) — exibição/edição opcional; não obrigatório.

### 1.3 Histórico de alterações
- Nova tabela `cronograma_atividades_historico`:
  - `atividade_id`, `user_id`, `user_name`, `campo`, `valor_anterior`, `valor_novo`, `bulk_operation_id uuid`, `created_at`.
- Trigger em `cronograma_atividades` que loga mudanças de: `ativo`, `horario`, `dia_semana`, `responsavel_id`, `formulario_id`, `mensagem`, `unidade_id`, `turno`, `titulo`, `tipo_atividade`.
- RPC `admin_bulk_update_cronograma(ids uuid[], patch jsonb, add_dias int[], replace_dias int[])` — admin-only, retorna nº afetado + `bulk_operation_id`.
- Bulk delete → soft delete via `ativo=false` + registro no histórico.

Todas as políticas RLS de admin mantidas; `GRANT` correspondentes.

---

## 2. Frontend — `src/pages/admin/CronogramaAutomacoes.tsx`

### 2.1 Estrutura da aba "D-API Operacional"
Manter a seção "Jobs automáticos (pg_cron)" no topo. Reformular apenas a seção "Cronograma de atividades".

### 2.2 Cabeçalho da seção
```
Cronograma de atividades
511 automações cadastradas
320 ativas · 191 pausadas · 12 tipos
```
Seletor de visualização (Tabs): **[Por atividade]** (padrão) | **[Por dia da semana]**.

### 2.3 Barra de filtros
- Busca (nome da atividade / título / responsável)
- Select: Unidade, Responsável, Dia da semana, Status (ativas/pausadas/todas), Turno
- Range de horário (from-to)
- Botão "Limpar filtros"
- Select de ordenação: nome | qtd total | horário | qtd ativas | qtd pausadas

### 2.4 Visão "Por atividade" (accordion)
Cada bloco:
- Header: nome do tipo, contadores (total / ativas / pausadas), unidades envolvidas, checkbox tri-state.
- Body ao expandir: tabela com colunas
  Checkbox | Dia | Horário | Responsável | Unidade | Turno | Status | Ações (editar individual).
- Atalhos por bloco: [Todos os dias] [Seg–Sex] [Fim de semana] [Apenas ativas] [Apenas pausadas] [Limpar seleção].
- Aviso "Possível duplicidade" quando dois itens compartilham `(tipo, unidade, responsável, dia, horário, turno)`.

### 2.5 Visão "Por dia da semana"
Manter o componente atual (`AtividadesSection`) intocado.

### 2.6 Barra fixa de ações em massa (aparece com N selecionados)
Rodapé sticky:
`"N automações selecionadas"` + botões: Ativar, Pausar, Alterar horário, Alterar responsável, Alterar unidade, Alterar turno, Alterar mensagem, Alterar dias, Duplicar, Excluir.

### 2.7 Modal de edição em massa (`BulkEditDialog`)
Campos:
- Resumo: nome da atividade, qtd afetada, unidades/responsáveis/dias/horários envolvidos.
- Campo em edição + valor atual (quando único) + novo valor.
- Para dias da semana: checkboxes Dom–Sáb + toggle **Substituir dias** / **Adicionar dias**.
- Confirmação: "Você está prestes a alterar X automações de ...".
- Após sucesso: toast "X automações atualizadas".

### 2.8 Modal de exclusão em massa
Confirmação obrigatória com nº e listagem resumida.

### 2.9 Estado / UX
- Botões desabilitam durante mutations (evitar duplo clique).
- Invalidate `queryClient` após cada mutação.
- Checkbox tri-state (indeterminate) quando parte selecionada.

### 2.10 Histórico
Aba/dialog "Histórico de alterações" acessível pelo topo da seção — lista as últimas operações (usuário, data, atividade, campo, antes/depois, qtd afetada).

---

## 3. Arquivos

**Novos**
- `src/components/cronograma-admin/AtividadesPorTipo.tsx` — accordion + seleção
- `src/components/cronograma-admin/BulkActionsBar.tsx`
- `src/components/cronograma-admin/BulkEditDialog.tsx`
- `src/components/cronograma-admin/AtividadesFilters.tsx`
- `src/components/cronograma-admin/HistoricoDialog.tsx`
- `src/hooks/useAllCronogramaAtividades.ts` (estender o hook atual do arquivo com filtros + bulk mutations)
- `src/lib/cronogramaTipos.ts` — normalizador de título → tipo

**Alterados**
- `src/pages/admin/CronogramaAutomacoes.tsx` — nova visão, filtros, cabeçalho enriquecido, tabs de visualização

---

## 4. Critérios de aceite (checklist)
1. Bloco único por tipo de atividade — ok
2. Seleção por dias específicos — ok
3. Alterar horário em massa — ok
4. Ativar/pausar em massa — ok
5. Filtros por unidade/responsável — ok
6. Modal informa qtd afetada — ok
7. Exclusão exige confirmação — ok
8. Visão antiga por dia disponível — ok
9. Somente selecionados são alterados — ok
10. Registro no histórico — ok

---

## 5. Detalhes técnicos
- Toda operação em massa usa RPC `admin_bulk_update_cronograma` (SECURITY DEFINER + `has_role admin`) para atomicidade e log único.
- `tipo_atividade` é backfilled uma vez; usuário pode ajustar via edição individual mais tarde (fase 2).
- Ordenação e filtros feitos client-side sobre o `useQuery` existente (poucos milhares de linhas).

Aprovar para começar pela migração?
