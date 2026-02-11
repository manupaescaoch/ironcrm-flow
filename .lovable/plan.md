
# Controle de Vencimentos - Foco em Mensais + Alerta Final para Outros Planos + Plano Editavel

## O que muda

### 1. Separacao por tipo de plano
- A tela de Controle de Vencimentos mostrara **por padrao apenas alunos com planos mensais** (Mensal, Executivo Mensal), pois sao esses que precisam de acompanhamento mensal de pagamento
- Alunos com planos trimestrais, semestrais e anuais **so aparecerao quando estiverem proximos do vencimento** (ex: ultimos 30 dias do plano), funcionando como um alerta de renovacao
- Um novo filtro "Tipo" permitira alternar entre: **Mensais** (padrao), **Fim de Plano** (tri/sem/anual proximos do vencimento), ou **Todos**

### 2. Plano editavel na tabela
- A coluna "Plano" na tabela passara a ser editavel inline (mesmo padrao da edicao de datas)
- Ao clicar no nome do plano, aparece um Select com as opcoes de plano disponiveis
- Ao selecionar um novo plano, o sistema atualiza o campo `plano_escolhido` na interacao e recalcula automaticamente a `data_vencimento` baseada no novo plano
- Permite que um aluno mensal renove em trimestral, semestral, etc. sem precisar abrir modal

### 3. Ajustes nos KPIs
- Os KPIs refletirao os dados filtrados conforme o tipo selecionado

## Detalhes Tecnicos

**Arquivo: `src/hooks/useVencimentosData.ts`**
- Adicionar campo `tipo` ao `VencimentosFilters`: `'mensais' | 'fim_plano' | 'todos'` (padrao: `'mensais'`)
- Na logica de filtragem:
  - `mensais`: mostrar apenas planos que contenham "mensal" no nome
  - `fim_plano`: mostrar planos tri/sem/anual apenas quando `diasRestantes <= 30`
  - `todos`: sem filtro de tipo

**Arquivo: `src/components/vencimentos/VencimentosFilters.tsx`**
- Adicionar um terceiro Select "Tipo" com opcoes: Mensais, Fim de Plano, Todos

**Arquivo: `src/components/vencimentos/VencimentosTable.tsx`**
- Criar componente `InlineEditablePlano` (similar ao `InlineEditableDate`)
- Ao clicar no plano, exibe um Select com as opcoes de plano
- Ao selecionar, atualiza `plano_escolhido` e recalcula `data_vencimento` automaticamente
- Substituir celula estatica do plano pelo componente editavel

**Arquivo: `src/pages/ControleVencimentos.tsx`**
- Atualizar estado de filtros para incluir `tipo: 'mensais'` como padrao
