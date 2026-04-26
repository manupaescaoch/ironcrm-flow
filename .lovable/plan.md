## Objetivo

Ajustar a página **CRM** (`/crm`) para:
1. Adicionar 2 novos KPIs respeitando o período filtrado.
2. Preservar os filtros (período, busca, origem, cadastrador, status) ao navegar para o detalhe de um lead e voltar.

---

## 1. Novos KPIs no período filtrado

**Arquivo**: `src/pages/CRM.tsx`

Hoje os KPIs (`kpis`) só olham `filteredLeads` (tabela `leads`). Os campos "experimental agendada/realizada" vivem na tabela `interacoes`, então precisamos buscar esses dados separadamente.

### Mudanças
- Novo state `interacoesPeriodo` + função `fetchInteracoesPeriodo(startDate, endDate)` que consulta `interacoes` na unidade atual:
  - **Agendadas no período**: `agendou_experimental = true` e `data_experimental` entre `startDate` e `endDate` → contar `lead_id` únicos.
  - **Realizadas no período**: `compareceu = true` e `data_experimental` entre `startDate` e `endDate` → contar `lead_id` únicos.
  - Quando `periodType === 'all'` (sem datas), buscar tudo da unidade.
- `useEffect` dispara `fetchInteracoesPeriodo` sempre que `unidadeAtual`, `startDate` ou `endDate` mudarem.
- Adicionar 2 cards no grid de KPIs (passa de `lg:grid-cols-5` para `lg:grid-cols-7`):
  - **Experimentais Agendadas** (ícone CalendarCheck, cor sky)
  - **Experimentais Realizadas** (ícone CheckCircle, cor purple)

---

## 2. Persistir filtros ao navegar para o lead e voltar

**Problema atual**: a linha da tabela usa `window.location.href = '/lead/${id}'` (linha 1159) — isso faz **reload completo**, perdendo todo o estado React. Ao voltar, a página é remontada com `periodType = 'all'` (default).

### Solução: persistência em `sessionStorage` + navegação SPA

**Arquivo**: `src/pages/CRM.tsx`

- Trocar `window.location.href = ...` por `navigate('/lead/${id}')` (`useNavigate` do `react-router-dom`).
- Criar uma chave `crm:filters` em `sessionStorage` com o objeto:
  ```ts
  { search, filterOrigem, filterCadastradoPor, filterStatus, periodType, startDate, endDate }
  ```
- Na inicialização (lazy useState ou useEffect): ler `sessionStorage` e restaurar os valores antes do primeiro render dos filtros.
- `useEffect` que escreve no `sessionStorage` sempre que qualquer filtro mudar.
- Datas serializadas como ISO string e parseadas de volta para `Date`.

`sessionStorage` é ideal porque limpa ao fechar a aba mas persiste durante navegação interna — exatamente o comportamento esperado para "voltar do detalhe do lead".

---

## Detalhes técnicos

### Query de interações (KPIs)
```ts
let query = supabase
  .from('interacoes')
  .select('lead_id, agendou_experimental, compareceu, data_experimental')
  .eq('unidade_id', unidadeAtual.id);

if (startDate) query = query.gte('data_experimental', format(startDate, 'yyyy-MM-dd'));
if (endDate) query = query.lte('data_experimental', format(endDate, 'yyyy-MM-dd'));
```
Calcular sets de `lead_id` únicos para cada métrica.

### Restauração de filtros
```ts
const STORAGE_KEY = 'crm:filters:v1';
// Ler no init com useState lazy initializer
const [periodType, setPeriodType] = useState(() => {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved).periodType ?? 'all' : 'all';
});
// ... idem para os outros filtros
```
Um único `useEffect` salva o snapshot consolidado quando qualquer filtro mudar.

### Navegação
- Substituir `onClick={() => window.location.href = ...}` por `onClick={() => navigate('/lead/${lead.id}')}`.
- O detalhe do lead continua usando `navigate(-1)` ou `<ArrowLeft>` existente — como agora é SPA navigation, o estado do CRM é preservado pelo React + sessionStorage garante restauração mesmo se o componente remontar.

---

## Resultado final

Grid de KPIs (7 cards): Total Leads · Convertidos · Em Negociação · Perdidos · **Experimentais Agendadas** · **Experimentais Realizadas** · Taxa Conversão.

Fluxo: filtra período → vê KPIs → clica no lead → volta → mesmo período e filtros aplicados.