## Redesenhar Meta vs Realizado — visual e engajador

Tornar o card "Meta vs Realizado" no Dashboard mais visual, destacando a quantidade de alunos que faltam para bater a meta e adicionando elementos que engajem (mensagens motivacionais dinâmicas, indicadores visuais grandes, cores reativas ao progresso).

### Mudanças no `src/components/dashboard/MetaVsRealizadoCard.tsx`

**Layout novo (em vez do card compacto atual):**

```text
┌──────────────────────────────────────────────────┐
│ 🎯 Meta vs Realizado — Unidade X                 │
│                                                  │
│        ╔══════════╗                              │
│        ║    12    ║   alunos para a meta         │
│        ╚══════════╝   238 de 250 · 95%           │
│                                                  │
│  ████████████████████████████████░░  95%         │
│                                                  │
│  🔥 Quase lá! Falta pouco para bater a meta      │
└──────────────────────────────────────────────────┘
```

**Elementos:**

1. **Número grande "faltam"** — destaque tipográfico (text-5xl/6xl, font-bold) ao lado da label "alunos para a meta". É o foco visual do card.
2. **Sub-linha** com `ativos / meta · pct%` em texto menor.
3. **Barra de progresso maior** (h-3) com cor reativa:
   - `< 50%`: vermelho/destructive
   - `50–79%`: laranja/amber
   - `80–99%`: amarelo/primary
   - `≥ 100%`: verde/success
4. **Mensagem motivacional dinâmica** com emoji, baseada no pct:
   - 0%: "🚀 Bora começar! Cada matrícula conta."
   - 1–49%: "💪 Time forte, segue o ritmo!"
   - 50–79%: "🔥 Já passou da metade, mantém a pegada!"
   - 80–99%: `⚡ Quase lá! Faltam {N} alunos para bater a meta.`
   - 100%+: `🏆 Meta batida! +{N} alunos acima do alvo.`
5. **Estado "meta atingida"**: número grande vira `+N` em verde com `acima da meta`.
6. **Animação sutil**: a barra preenche com transição (já vem do Progress shadcn); o número grande entra com `animate-in fade-in slide-in-from-bottom-1`.

### Tokens / cores

- Usar tokens semânticos do `index.css` (primary, destructive, muted-foreground). Para verde/sucesso e amber, usar classes Tailwind padrão alinhadas com o tema (`text-emerald-500`, `bg-amber-500`) somente se já existirem no projeto; caso contrário, mapear via variantes do Progress com cor inline em HSL.

### Sem mudanças de dados

- Continua lendo `gestao_metas.alunos_ativos_manual` e `meta_alunos_mes` por `unidade_id`. Sem migrações nem mudanças em outros componentes.

### Detalhes técnicos

- Arquivo único alterado: `src/components/dashboard/MetaVsRealizadoCard.tsx`.
- Manter mesma interface de props (`unidadeId`, `unidadeNome`, `refreshKey`).
- Card cresce em altura (~140–170px) — encaixa acima do grid de KPIs no Dashboard sem quebrar layout.
