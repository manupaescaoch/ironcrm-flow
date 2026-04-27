## Remover KPI "Leads Novos" do Dashboard

Como o filtro de status já permite visualizar leads novos, vamos remover o card redundante do grid de KPIs.

### Alteração

**Arquivo**: `src/components/dashboard/DashboardKPIGrid.tsx`

- Remover o `<KPICard>` "Leads Novos" (ícone `UserPlus`).
- Remover o import `UserPlus` do `lucide-react`.
- Ajustar o grid de `xl:grid-cols-7` para `xl:grid-cols-6`, mantendo o alinhamento com os 6 KPIs restantes (Total de Leads, Aulas Agendadas, Follow-ups, Experimentais da Semana, Matrículas no Período, Planos Vencendo).

Nenhuma outra mudança é necessária — o `stats.novos` continua sendo calculado em `useDashboardStats` (não vou mexer nisso, pois pode ser útil em outros pontos e não causa custo extra).