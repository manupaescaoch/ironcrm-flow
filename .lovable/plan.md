

# Plano de Melhorias Completas - Gestão de Tarefas

## Visao Geral

Este plano implementa todas as melhorias sugeridas para o modulo de Gestao de Tarefas, organizadas em fases para facilitar o desenvolvimento e testes.

---

## Fase 1: Banco de Dados (Novas Tabelas)

### 1.1 Tabela `task_comments` (Comentarios/Historico)
Armazena comentarios e atualizacoes de cada tarefa.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| task_id | uuid | FK para tasks |
| user_id | uuid | Quem comentou |
| user_name | text | Nome do usuario |
| content | text | Conteudo do comentario |
| created_at | timestamp | Data de criacao |

### 1.2 Tabela `task_subtasks` (Checklist)
Armazena subtarefas/itens de checklist.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| task_id | uuid | FK para tasks |
| titulo | text | Titulo do item |
| concluido | boolean | Status de conclusao |
| ordem | integer | Ordem de exibicao |
| created_at | timestamp | Data de criacao |

### 1.3 Tabela `task_history` (Auditoria)
Registra todas as alteracoes feitas nas tarefas.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| task_id | uuid | FK para tasks |
| user_id | uuid | Quem alterou |
| user_name | text | Nome do usuario |
| campo | text | Campo alterado |
| valor_anterior | text | Valor antes |
| valor_novo | text | Valor depois |
| created_at | timestamp | Data da alteracao |

### 1.4 Alteracoes na Tabela `tasks`
Adicionar novos campos:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| concluida_em | timestamp | Data de conclusao |
| arquivada | boolean | Se foi arquivada |
| recorrencia | text | Tipo de recorrencia (diaria, semanal, mensal, null) |
| recorrencia_fim | date | Data fim da recorrencia |

### 1.5 Politicas RLS
- Todas as tabelas terao RLS baseado em `unidade_id` herdado da tarefa pai
- Realtime habilitado para `task_comments` e `task_subtasks`

---

## Fase 2: KPIs e Dashboard

### 2.1 Componente `TarefasKPIGrid`
Grid de metricas no topo da pagina com 4 KPIs:

```text
+------------------+------------------+------------------+------------------+
|   Total Tarefas  | Tarefas Atrasadas|   Em Andamento   |    Concluidas    |
|       25         |        3         |        8         |       14         |
|                  |   (destaque red) |                  |  (este mes)      |
+------------------+------------------+------------------+------------------+
```

### 2.2 Logica de Calculo
- **Total**: Todas as tarefas ativas (nao arquivadas)
- **Atrasadas**: `prazo < hoje` E `status != concluida`
- **Em Andamento**: `status = em_andamento`
- **Concluidas (mes)**: `concluida_em` no mes atual

---

## Fase 3: Busca e Filtros no Kanban

### 3.1 Barra de Busca
Campo de texto que filtra tarefas por:
- Titulo (parcial, case-insensitive)
- Descricao (parcial)
- Responsavel

### 3.2 Filtros no Kanban
Adicionar dropdowns acima das colunas:
- Filtro por **Responsavel**
- Filtro por **Prioridade**
- Filtro por **Setor**

### 3.3 Ordenacao dentro das Colunas
Ordenar cards por:
1. Prioridade (Alta > Media > Baixa)
2. Prazo (mais proximo primeiro)

---

## Fase 4: Comentarios nas Tarefas

### 4.1 Secao no Modal
Adicionar aba ou secao no `TarefaModal`:
- Lista de comentarios existentes (mais recente primeiro)
- Campo para novo comentario
- Nome do usuario e data em cada comentario

### 4.2 Hook `useTaskComments`
- `fetchComments(taskId)`
- `addComment(taskId, content)`
- Realtime subscription para novos comentarios

---

## Fase 5: Subtarefas/Checklist

### 5.1 Componente `TaskSubtasks`
Lista de itens com checkbox no modal:
- Adicionar novo item
- Marcar como concluido
- Excluir item
- Reordenar (arrastar)

### 5.2 Indicador no Card
Mostrar progresso no `TarefaCard`:
```text
[ ] 3/5 itens concluidos
```

---

## Fase 6: Melhorias Visuais

### 6.1 Badge de Atrasada no Card
Se `prazo < hoje` e `status != concluida`:
- Badge vermelha "ATRASADA"
- Borda vermelha no card

### 6.2 Avatar/Iniciais do Responsavel
Mostrar iniciais do responsavel em um circulo colorido.

### 6.3 Metadados no Card
- Quem criou: "Criado por JOAO"
- Data de conclusao (quando aplicavel)

---

## Fase 7: Historico de Alteracoes

### 7.1 Trigger de Auditoria
Trigger no banco que registra alteracoes em:
- status, prioridade, responsavel, prazo, titulo

### 7.2 Visualizacao no Modal
Aba "Historico" mostrando timeline de alteracoes:
```text
15/01 14:30 - MARIA alterou status: A Fazer -> Em Andamento
14/01 09:00 - JOAO alterou prazo: 20/01 -> 25/01
```

---

## Fase 8: Exportacao

### 8.1 Botao Exportar
Adicionar botao no header da pagina com opcoes:
- Exportar PDF
- Exportar Excel

### 8.2 Conteudo do Relatorio
- Lista de tarefas com todos os campos
- Filtros aplicados
- Data de geracao

---

## Fase 9: Arquivamento

### 9.1 Acao de Arquivar
Em vez de excluir, opção de arquivar:
- Define `arquivada = true`
- Remove da visualizacao padrao

### 9.2 Filtro de Arquivadas
Toggle para mostrar/ocultar tarefas arquivadas.

---

## Fase 10: Multiplos Responsaveis (Opcional)

### 10.1 Alteracao no Banco
Alterar `responsavel` de text para array ou criar tabela de relacao.

### 10.2 UI Multi-Select
Permitir selecionar multiplos usuarios no modal.

---

## Arquivos a Criar/Modificar

### Novos Arquivos
| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useTaskComments.ts` | Hook para comentarios |
| `src/hooks/useTaskSubtasks.ts` | Hook para subtarefas |
| `src/components/tarefas/TarefasKPIGrid.tsx` | Grid de KPIs |
| `src/components/tarefas/TaskComments.tsx` | Componente de comentarios |
| `src/components/tarefas/TaskSubtasks.tsx` | Componente de checklist |
| `src/components/tarefas/TaskHistory.tsx` | Timeline de historico |
| `src/components/tarefas/TarefasFilters.tsx` | Filtros do Kanban |
| `src/components/tarefas/TarefasExport.tsx` | Exportacao PDF/Excel |

### Arquivos a Modificar
| Arquivo | Alteracoes |
|---------|------------|
| `src/hooks/useTarefasData.ts` | Adicionar campos, funcao arquivar |
| `src/components/tarefas/TarefaCard.tsx` | Badge atrasada, iniciais, progresso checklist |
| `src/components/tarefas/TarefaModal.tsx` | Tabs (Detalhes, Comentarios, Checklist, Historico) |
| `src/components/tarefas/TarefasKanban.tsx` | Filtros e ordenacao |
| `src/pages/GestaoTarefas.tsx` | KPIs, busca, exportacao, toggle arquivadas |

---

## Detalhes Tecnicos

### Migracao SQL
```sql
-- Comentarios
CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Subtarefas
CREATE TABLE task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  concluido boolean DEFAULT false,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Historico
CREATE TABLE task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text NOT NULL,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz DEFAULT now()
);

-- Novos campos em tasks
ALTER TABLE tasks ADD COLUMN concluida_em timestamptz;
ALTER TABLE tasks ADD COLUMN arquivada boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN recorrencia text;
ALTER TABLE tasks ADD COLUMN recorrencia_fim date;

-- RLS e Realtime
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE task_subtasks;
```

### Trigger de Auditoria
```sql
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_history (task_id, user_id, user_name, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, auth.uid(), 'SISTEMA', 'status', OLD.status, NEW.status);
  END IF;
  -- Repetir para outros campos...
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_audit_trigger
AFTER UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION log_task_changes();
```

---

## Ordem de Implementacao

1. **Banco de Dados** - Criar tabelas e politicas
2. **KPIs** - Adicionar metricas no topo
3. **Filtros Kanban** - Busca e filtros
4. **Comentarios** - Sistema de comentarios
5. **Subtarefas** - Checklist
6. **Melhorias Visuais** - Badges, avatares
7. **Historico** - Auditoria
8. **Exportacao** - PDF/Excel
9. **Arquivamento** - Substituir exclusao
10. **Recorrencia** - Tarefas automaticas (futuro)

