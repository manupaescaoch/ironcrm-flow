

# Corrigir contagem de Follow-ups Pendentes

## Problema
No card "Pendências do Dia", o filtro de follow-ups (`followUpsHoje`) só mostra os follow-ups com data prevista de **hoje**, excluindo os **vencidos** (datas anteriores a hoje). O usuario quer que os follow-ups pendentes incluam tanto os do dia quanto os vencidos.

## Solucao

**Arquivo: `src/pages/Dashboard.tsx` (linhas 258-262)**

Remover o filtro que restringe apenas ao dia de hoje. Em vez de filtrar `urgentAutoFollowUpItems` para mostrar apenas os de hoje, passar todos os `urgentAutoFollowUpItems` diretamente (que ja incluem hoje + vencidos, conforme a logica do hook `useDashboardFollowUps`).

```typescript
// De:
followUpsHoje={urgentAutoFollowUpItems.filter(item => {
  const dataPrevista = new Date(item.data_prevista);
  const hoje = new Date();
  return dataPrevista.toDateString() === hoje.toDateString();
})}

// Para:
followUpsHoje={urgentAutoFollowUpItems}
```

Nenhuma outra alteracao necessaria — o KPI principal (linha 161) ja conta corretamente com `urgentAutoFollowUpItems.length`.

