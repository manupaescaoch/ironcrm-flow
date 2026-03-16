

# Plano: Página "Rotinas" - Painel Operacional

Este é um módulo grande. Vou dividir a implementação em fases para manter qualidade e funcionalidade.

## Fase 1 — Banco de Dados (Migrações)

Criar 3 tabelas principais:

```text
rotinas
├── id, unidade_id, nome, descricao, setor, responsavel_principal
├── responsavel_conferencia, frequencia (diaria/semanal/quinzenal/mensal)
├── horario_esperado (time), prioridade (baixa/media/alta)
├── status (pendente/em_andamento/concluida/atrasada)
├── ativo, arquivada, created_by, created_at, updated_at
└── RLS: por unidade_id

rotina_atividades
├── id, rotina_id (FK), titulo, responsavel, horario (time)
├── observacao, ordem, created_at
└── RLS: via join com rotinas → unidade_id

rotina_execucoes
├── id, rotina_id (FK), atividade_id (FK nullable)
├── data_execucao (date), concluida, concluida_por, concluida_em
├── observacao, foto_url, unidade_id, created_at
└── RLS: por unidade_id
```

- Habilitar Storage bucket `rotinas-comprovantes` para upload de fotos
- Habilitar Realtime na tabela `rotina_execucoes`

## Fase 2 — Código Frontend

### Novos arquivos:

1. **`src/pages/Rotinas.tsx`** — Página principal com:
   - Layout padrão (sidebar, seletor de unidade)
   - KPIs no topo (total rotinas, ativas, pendentes hoje, concluídas hoje, atrasadas, taxa execução %)
   - Filtros (setor, responsável, frequência, status, prioridade, data, arquivadas)
   - 3 abas de visualização: Lista, Kanban por status, Calendário
   - Botões "Nova Rotina" e "Nova Atividade"
   - Organização por blocos de setor (Coordenação, Limpeza, Recepção, etc.)

2. **`src/hooks/useRotinasData.ts`** — Hook principal com CRUD de rotinas, atividades e execuções

3. **`src/components/rotinas/`** — Componentes:
   - `RotinaModal.tsx` — Criar/editar rotina com checklist de atividades
   - `RotinasKPIGrid.tsx` — Cards de resumo
   - `RotinasFilters.tsx` — Filtros
   - `RotinaCard.tsx` — Card individual de rotina
   - `RotinasLista.tsx` — Visualização em lista por setor
   - `RotinasKanban.tsx` — Kanban por status
   - `RotinasCalendario.tsx` — Visão calendário
   - `AtividadeChecklist.tsx` — Checklist de atividades dentro de cada rotina
   - `ExecucaoHistorico.tsx` — Histórico de execuções

### Rota e navegação:
- Adicionar `/rotinas` no `App.tsx` como `ProtectedRoute`
- Adicionar item na sidebar do `Layout.tsx` com ícone `ClipboardList`, visível para admin, recepcao, comercial, coordenador

### Permissões:
- Admin: CRUD completo, arquivar, excluir
- Coordenador: criar e acompanhar rotinas do seu setor
- Funcionário (recepcao/comercial): visualizar e concluir atividades atribuídas

### Dados de exemplo:
- Inserir via migration 3 rotinas pré-configuradas (Vistoria Limpeza/Coordenação, Limpeza Geral, Recepção) com suas atividades

## Fase 3 — Upload de fotos

- Criar bucket `rotinas-comprovantes` no Storage
- Implementar upload na execução de atividades

## Detalhes técnicos

- Frequência recorrente: ao carregar a página, o hook verifica se existem execuções para o dia atual. Se não, gera registros pendentes automaticamente baseado na frequência da rotina.
- Status atrasada: rotinas cuja execução do dia não foi concluída até o horário esperado são marcadas visualmente como atrasadas (lógica no frontend).
- Duplicar rotina: botão no modal que copia a rotina e suas atividades.
- Exportar: relatório PDF/CSV por período filtrado.

## Escopo da implementação

Dado o tamanho, implementarei a estrutura completa do banco, a página funcional com Lista e Kanban, modal de criação/edição, checklist de atividades, KPIs e filtros. Upload de fotos e calendário serão incluídos mas podem ser iterados depois.

