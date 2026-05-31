## Módulo Reuniões

Novo módulo administrativo/coordenação para registrar atas de reunião e acompanhar encaminhamentos. Segue o padrão visual e arquitetural do CRM (Layout + Tabs + shadcn + React Query + Supabase + filtro por `unidade_id`).

### 1. Banco de dados (migration)

**Tabela `reunioes`**
- `id uuid pk`
- `unidade_id uuid not null`
- `tipo text not null` (ex.: COMERCIAL, OPERACIONAL, GERAL, COORDENAÇÃO, OUTRO — uppercase)
- `data date not null`
- `participantes text[] not null default '{}'`
- `numeros_periodo jsonb not null default '{}'` (campos livres: leads, matrículas, faturamento, etc.)
- `pauta text`
- `decisoes text`
- `resumo text` (resumo curto para a listagem)
- `status text not null default 'aberta'` (aberta | concluida | arquivada)
- `criado_por uuid` (auth.uid())
- `created_at`, `updated_at` com trigger

**Tabela `reunioes_encaminhamentos`**
- `id uuid pk`
- `reuniao_id uuid not null` → cascade delete
- `unidade_id uuid not null` (denormalizado para RLS/filtragem)
- `acao text not null`
- `responsavel_id uuid` (opcional, referencia auth.users)
- `responsavel_nome text` (snapshot uppercase)
- `prazo date`
- `status text not null default 'aberto'` (aberto | em_andamento | concluido | atrasado)
- `created_at`, `updated_at`

**Permissões** (mesmo padrão de `cronograma_atividades`):
- `GRANT`s para `authenticated`/`service_role`.
- RLS habilitado.
- Policies:
  - `select`: admin OU `unidade_id IN (get_user_unidades(auth.uid()))`.
  - `insert/update/delete`: admin OU (`coordenador` E `unidade_id IN get_user_unidades`).
- Trigger `updated_at` reaproveitando `public.update_updated_at_column()`.
- Trigger para sincronizar `unidade_id` em encaminhamentos a partir da reunião.
- Trigger automático: marcar encaminhamento como `atrasado` quando `prazo < CURRENT_DATE AND status IN ('aberto','em_andamento')` (via função `recompute_encaminhamento_status` chamada em select via view OU computado no frontend — vamos optar por computar no frontend para simplicidade, mantendo o status real no banco).

### 2. Rota e menu

- Adicionar rota `/reunioes` (ProtectedRoute) em `src/App.tsx`.
- Em `src/components/Layout.tsx`, inserir item `{ href: '/reunioes', label: 'Reuniões', icon: Handshake, roles: ['admin','coordenador'] }` **entre** Operacional e Escala. (Recepção/comercial não veem; segue regra de coordenação/admin.)

### 3. Páginas e componentes

```text
src/pages/Reunioes.tsx                     # Shell com Tabs (Histórico | Nova | Pendentes)
src/components/reunioes/
  ReunioesHistoricoTab.tsx                 # Lista + filtros + drawer detalhe
  ReunioesHistoricoFilters.tsx
  ReuniaoDetalheDrawer.tsx                 # Sheet com dados gerais, números, pauta, decisões, encaminhamentos
  NovaReuniaoTab.tsx                       # Formulário react-hook-form + zod
  EncaminhamentosFieldArray.tsx            # Subform multi-itens (ação/responsável/prazo/status)
  PendentesTab.tsx                         # Listagem consolidada + filtros + update inline de status
  PendentesFilters.tsx
  ReuniaoStatusBadge.tsx
  EncaminhamentoStatusBadge.tsx
  constants.ts                             # TIPOS_REUNIAO, STATUS_*, opções
src/hooks/
  useReunioesData.ts                       # CRUD reuniões (React Query)
  useEncaminhamentosData.ts                # CRUD encaminhamentos + update status
```

**Padrões reaproveitados**
- `Layout`, `Tabs`, `Card`, `Table`, `Badge`, `Select`, `Input`, `Textarea`, `Calendar`, `Dialog`/`Sheet`, `Form` (shadcn).
- Filtro por unidade via `useUnidade()` (`unidadeAtual.id`).
- Uppercase automático nos inputs de texto (Core memory).
- Datas usando `new Date(ano, mes-1, dia)` para evitar timezone.
- Estados loading / empty / error iguais aos de `GestaoTarefas` e `Operacional`.

### 4. Telas — detalhes

**Histórico**
- Tabela com colunas: Tipo, Unidade, Data, Participantes (chips), Resumo, # Encaminhamentos, # Pendentes (status ≠ concluido), Status, Ações.
- Filtros: unidade (admin), tipo, período (date range), status.
- Linha clicável → `ReuniaoDetalheDrawer` (Sheet lateral) com: dados gerais, números do período (renderizar `jsonb`), pauta, decisões, lista de encaminhamentos com status.

**Nova Reunião**
- Formulário validado (zod): tipo*, unidade* (preenchida com `unidadeAtual`, admin pode trocar), data*, participantes* (input com chips), números do período (campos dinâmicos chave/valor ou estrutura fixa: leads, agendamentos, matrículas, faturamento — vou usar estrutura fixa com 6 campos numéricos opcionais + observações), pauta, decisões, encaminhamentos (field array com ação*, responsável (select de usuários da unidade via `useUnidadeUsers`), prazo, status inicial padrão `aberto`).
- Botão salvar: insere reunião e encaminhamentos em transação client-side (insert reunião → insert encaminhamentos com `reuniao_id`).
- Após salvar, redireciona para Histórico com toast.

**Pendentes**
- Query: todos encaminhamentos com `status IN ('aberto','em_andamento','atrasado')` da unidade atual (admin: todas).
- Tabela: Ação, Responsável, Unidade, Tipo reunião (join), Data reunião, Prazo, Status (select inline para atualizar).
- Filtros: responsável, unidade, tipo de reunião, status, prazo (range).
- Update inline via `useEncaminhamentosData` → invalida queries.

### 5. Permissões frontend

- Item de menu visível apenas para `admin` e `coordenador`.
- Página inteira protegida via novo wrapper `AdminOrCoordenadorRoute` em `App.tsx` (similar a `AdminRoute`).
- Edição/criação só liberadas para admin (qualquer unidade) ou coordenador (apenas unidade atual).

### 6. Pontos abertos / decisões padrão

- **Tipos de reunião** padrão: COMERCIAL, OPERACIONAL, COORDENAÇÃO, GERAL, OUTRO.
- **Números do período**: estrutura fixa (leads, agendamentos, experimentais, matrículas, faturamento, cancelamentos) — todos opcionais; armazenados como `jsonb` para flexibilidade futura.
- **Atrasados** computados em runtime no frontend (sem cron); badge fica vermelho se `prazo < hoje` e status ainda aberto/em_andamento.

### 7. Entregáveis

1. Migration SQL (2 tabelas + grants + RLS + triggers).
2. Rota + item de menu.
3. Página `Reunioes.tsx` com 3 tabs.
4. Hooks e componentes listados acima.
5. Memory entry resumindo o módulo.