
## Plano: Criar Pagina de Gestao de Tarefas - Iron Club

### Objetivo
Criar uma pagina completa de gestao de tarefas para a equipe do Iron Club, com tres visualizacoes principais (Kanban, Calendario e Lista), permitindo organizar tarefas por responsavel, prioridade, prazo, status e setor.

---

### 1. Estrutura do Banco de Dados

#### Nova Tabela: `tasks`

| Campo | Tipo | Obrigatorio | Default | Descricao |
|-------|------|-------------|---------|-----------|
| id | uuid | Sim | gen_random_uuid() | Identificador unico |
| titulo | text | Sim | - | Titulo da tarefa |
| descricao | text | Nao | null | Descricao detalhada |
| responsavel | text | Sim | - | Nome do responsavel |
| setor | text | Sim | - | Area da empresa |
| prioridade | text | Sim | 'media' | Alta, Media, Baixa |
| status | text | Sim | 'a_fazer' | Status da tarefa |
| prazo | date | Nao | null | Data limite |
| unidade_id | uuid | Sim | FK | Referencia para unidade |
| created_by | uuid | Nao | auth.uid() | Quem criou |
| created_at | timestamptz | Sim | now() | Data de criacao |
| updated_at | timestamptz | Sim | now() | Data de atualizacao |

#### Valores Permitidos

**Setor:**
- Financeiro
- Treinadores
- Recepcao
- Marketing
- Limpeza/Manutencao
- Coordenacao

**Prioridade:**
- alta (vermelho)
- media (amarelo)
- baixa (verde)

**Status:**
- a_fazer
- em_andamento
- aguardando
- concluida

#### Politicas RLS
- SELECT: Usuario autenticado + (admin OU unidade permitida)
- INSERT: Usuario autenticado + (admin OU unidade permitida)
- UPDATE: Usuario autenticado + (admin OU unidade permitida)
- DELETE: Somente admin

---

### 2. Estrutura de Arquivos

```
src/
  pages/
    GestaoTarefas.tsx           # Pagina principal
  components/
    tarefas/
      TarefasKanban.tsx         # Visao Kanban com drag & drop
      TarefasCalendario.tsx     # Visao Calendario
      TarefasLista.tsx          # Visao Lista com filtros
      TarefaCard.tsx            # Card de tarefa (reutilizavel)
      TarefaModal.tsx           # Modal criar/editar tarefa
      TarefasFilters.tsx        # Filtros (responsavel, prioridade, setor)
  hooks/
    useTarefasData.ts           # Hook para buscar/manipular tarefas
```

---

### 3. Componentes Visuais

#### 3.1 Header da Pagina
- Titulo: "Gestao de Tarefas"
- Badge com unidade atual
- Botao "Nova Tarefa" (abre modal)
- Tabs para alternar visualizacoes (Kanban | Calendario | Lista)

#### 3.2 Visao Kanban (Principal)
Baseada no padrao existente em `Kanban.tsx`:

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   A Fazer   │Em Andamento │  Aguardando │  Concluida  │
│   (azul)    │  (amarelo)  │  (laranja)  │   (verde)   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ [Card]      │ [Card]      │ [Card]      │ [Card]      │
│ [Card]      │             │ [Card]      │             │
│             │             │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Card de Tarefa:**
- Titulo (bold)
- Badge de Prioridade (colorido)
- Badge de Setor
- Responsavel (icone + nome)
- Prazo (icone calendario + data)
- Drag & drop entre colunas

#### 3.3 Visao Calendario
- Grid mensal mostrando tarefas por data de prazo
- Navegacao entre meses
- Cada dia mostra mini-cards das tarefas
- Click no dia abre lista detalhada

#### 3.4 Visao Lista
- Tabela com colunas: Titulo, Responsavel, Setor, Prioridade, Prazo, Status
- Filtros rapidos no topo
- Ordenacao por coluna
- Acoes: Editar, Excluir

---

### 4. Fluxo de Interacao

```
Usuario abre pagina
        │
        ▼
┌───────────────────┐
│  Carrega tarefas  │
│   (por unidade)   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌─────────────────┐
│  Visao Kanban     │ ◄──►│   Alternar Tab  │
│  (default)        │     └─────────────────┘
└─────────┬─────────┘
          │
          ├── Drag & Drop → Atualiza status
          │
          ├── Click card → Abre modal edicao
          │
          └── Botao Nova → Abre modal criacao
```

---

### 5. Alteracoes no Codigo

#### 5.1 App.tsx
- Adicionar rota `/tarefas` com ProtectedRoute
- Importar componente GestaoTarefas

#### 5.2 Layout.tsx
- Adicionar item no menu: 
  - href: '/tarefas'
  - label: 'Tarefas'
  - icon: CheckSquare
  - roles: ['admin', 'recepcao', 'comercial']

---

### 6. Detalhes Tecnicos

#### Realtime Updates
```typescript
// Subscription para atualizacoes em tempo real
const channel = supabase
  .channel('tarefas-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks'
  }, (payload) => {
    // Atualiza lista local
  })
  .subscribe();
```

#### Drag & Drop (Kanban)
- Usar eventos nativos HTML5 (onDragStart, onDragOver, onDrop)
- Atualizar status via Supabase ao soltar
- Animacao visual de destaque na coluna destino

#### Filtros (Lista)
```typescript
const [filterResponsavel, setFilterResponsavel] = useState('all');
const [filterPrioridade, setFilterPrioridade] = useState('all');
const [filterSetor, setFilterSetor] = useState('all');
const [filterStatus, setFilterStatus] = useState('all');
```

---

### 7. Paleta de Cores

| Elemento | Cor | Classe Tailwind |
|----------|-----|-----------------|
| Prioridade Alta | Vermelho | `bg-red-500/10 text-red-600` |
| Prioridade Media | Amarelo | `bg-yellow-500/10 text-yellow-600` |
| Prioridade Baixa | Verde | `bg-green-500/10 text-green-600` |
| Status A Fazer | Azul | `bg-blue-500` |
| Status Em Andamento | Amarelo | `bg-amber-500` |
| Status Aguardando | Laranja | `bg-orange-500` |
| Status Concluida | Verde | `bg-green-500` |

---

### 8. Modal de Tarefa

```
┌────────────────────────────────────────┐
│ Nova Tarefa / Editar Tarefa            │
├────────────────────────────────────────┤
│                                        │
│ Titulo *                               │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Descricao                              │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ┌──────────────┐  ┌──────────────┐    │
│ │ Responsavel* │  │    Setor*    │    │
│ └──────────────┘  └──────────────┘    │
│                                        │
│ ┌──────────────┐  ┌──────────────┐    │
│ │ Prioridade*  │  │    Prazo     │    │
│ └──────────────┘  └──────────────┘    │
│                                        │
│          [Cancelar]  [Salvar]          │
└────────────────────────────────────────┘
```

---

### 9. Ordem de Implementacao

1. **Migracao SQL** - Criar tabela `tasks` com RLS
2. **Hook useTarefasData** - Logica de busca e mutacoes
3. **TarefaCard** - Componente card reutilizavel
4. **TarefaModal** - Modal de criacao/edicao
5. **TarefasKanban** - Visao principal com drag & drop
6. **TarefasLista** - Visao tabela com filtros
7. **TarefasCalendario** - Visao calendario mensal
8. **GestaoTarefas** - Pagina principal com tabs
9. **Rotas e Menu** - Integrar no App.tsx e Layout.tsx
10. **Realtime** - Adicionar subscriptions

---

### 10. Resultado Esperado

- Pagina moderna e responsiva para gestao de tarefas
- Tres visualizacoes complementares
- Drag & drop intuitivo no Kanban
- Filtros rapidos para encontrar tarefas
- Atualizacoes em tempo real entre usuarios
- Controle de acesso por unidade via RLS
