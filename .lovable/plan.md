

## Reordenar menu lateral

A ordem proposta faz sentido — operacional primeiro, executivo/admin depois. Sugiro um pequeno ajuste: mover **Comissões** para junto de Vencimentos (são relacionados financeiramente) e **Escala** junto de Rotinas (ambos operacionais de equipe).

### Ordem final proposta

1. Dashboard
2. CRM
3. Vencimentos
4. Comissões
5. Indicações
6. Tarefas
7. Rotinas
8. Escala
9. Estoque
10. Executivo *(admin)*
11. Relatório Vendas *(admin)*
12. Backups *(admin)*
13. Usuários *(master admin)*

### Alteração

**Arquivo:** `src/components/Layout.tsx` — reordenar o array `allNavItems` conforme a sequência acima. Nenhuma outra mudança necessária.

