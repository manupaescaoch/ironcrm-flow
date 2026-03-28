

## Unificação: Rotinas + Cronograma Operacional

### Situação Atual

| Aspecto | Rotinas | Cronograma |
|---------|---------|------------|
| **Foco** | Checklists por setor | Mensagens para funcionários |
| **Tabelas** | `rotinas`, `rotina_atividades`, `rotina_execucoes` | `cronograma_atividades`, `cronograma_funcionarios`, `cronograma_envios`, `formularios` |
| **Automação** | WhatsApp 13h com botões ✅/❌ | Disparo a cada 15min por pg_cron |
| **Calendário** | Semanal por frequência (diária/semanal/mensal) | Semanal por dia da semana |
| **Responsável** | Por setor + responsável principal | Por funcionário individual |
| **Formulários** | Não tem | Formulários dinâmicos públicos |
| **Acesso** | Admin, Coordenador, Comercial | Apenas Admin |
| **Menu** | Separados na sidebar | Separados na sidebar |

### Proposta de Unificação

Manter **uma única página** chamada **"Operacional"** com as seguintes abas:

```text
┌─────────────────────────────────────────────────┐
│  📋 Operacional                                 │
│  Gestão de rotinas, cronograma e formulários    │
├─────────────┬───────────┬──────────┬────────────┤
│ Calendário  │ Dashboard │ Equipe   │ Formulários│
└─────────────┴───────────┴──────────┴────────────┘
```

**Aba Calendário** — Grade semanal unificada mostrando:
- Rotinas (coloridas por setor/prioridade, como hoje)
- Atividades do cronograma (coloridas diferente, com ícone de mensagem)
- Popup de detalhe com ações específicas de cada tipo

**Aba Dashboard** — KPIs combinados:
- KPIs de rotinas (execução, pendentes)
- KPIs de envios (enviados, respondidos, taxa)

**Aba Equipe** — Tab de funcionários existente (do Cronograma)

**Aba Formulários** — Builder + lista de formulários (do Cronograma)

### Mudanças Técnicas

1. **Nova página `Operacional.tsx`** substituindo `Rotinas.tsx` e `CronogramaOperacional.tsx`
2. **Calendário unificado** que renderiza eventos de ambas as tabelas na mesma grade
3. **Rota única** `/operacional` no lugar de `/rotinas` e `/cronograma`
4. **Sidebar** com um único item "Operacional" (acessível para admin, coordenador, comercial)
5. **Sem mudanças no banco** — as tabelas continuam separadas, apenas a UI é unificada
6. **Modais separados** — criar/editar rotina usa o modal atual, criar/editar atividade do cronograma usa o modal atual

### O que NÃO muda
- Tabelas e RLS permanecem intactas
- Automações WhatsApp (13h rotinas + 15min cronograma) continuam independentes
- Formulários públicos `/formulario/:id` não são afetados
- Lógica de execução e envios permanece igual

### Consideração

Esta unificação é **apenas visual/navegação**. A lógica de negócio permanece separada porque os dois módulos têm fluxos diferentes (checklist por setor vs. mensagem individual). A vantagem é simplificar a navegação e dar uma visão consolidada do que acontece operacionalmente na unidade.

