# Atualizar Relatório Diário — Comercial

Reformular o wizard em `src/pages/RelatorioDiarioComercial.tsx` para refletir a nova estrutura de 4 blocos, com perguntas condicionais e campos textuais ricos (matrículas/renovações/cancelamentos por nome).

## Bloco 1 — Identificação
- Unidade (Zona Norte / Zona Sul) — já existe
- Nome do responsável pelo relatório (texto curto) — já existe (`nome`)
- (Removida a tela "Data do relatório" — usar `new Date()` automaticamente, mantendo registro silencioso)

## Bloco 2 — Indicadores do dia
1. Total de alunos ativos (número)
2. Leads recebidos (número)
3. **Experimentais agendadas (número)** — novo
4. Experimentais realizadas (número)
5. **Houve fechamento nas experimentais de hoje?** — novo (opções: Sim, todas / Sim, parcial / Nenhuma / Não houve experimental hoje)
   - Se "Sim, parcial" ou "Nenhuma":
     - 5a. Quantos não fecharam? (número)
     - 5b. Principal motivo (Preço / Vai pensar / Não gostou da proposta / Questão de horário / Outro)
       - Se "Outro": 5c. Descreve o motivo (parágrafo)
6. **Houve novas matrículas hoje? Quantas e quais os nomes?** (texto longo) — substitui campo numérico
7. **Houve renovações hoje? Quantas e quais os nomes?** (texto longo) — substitui campo numérico
8. **Houve cancelamentos solicitados hoje? Quantos e quais os motivos?** (texto longo) — substitui campo numérico
9. **Houve não renovações hoje? Quantos e qual o perfil dos alunos?** (texto longo) — substitui campo numérico
10. **Há inadimplentes ativos no momento? Quantos e algum caso crítico?** (texto longo) — substitui campo numérico
- (Remover campo "Evasão" da UI)

## Bloco 3 — Ocorrências e feedbacks
11. Ocorrência fora do comum com algum aluno? (Sim/Não)
    - Se Sim: 11a. Descreva o ocorrido (parágrafo)
12. Feedback negativo de aluno? (Sim/Não)
    - Se Sim:
      - 12a. Qual foi o feedback? (parágrafo)
      - 12b. Alguma ação já foi tomada? (Sim/Não)
        - Se Sim: 12c. Qual ação foi tomada? (parágrafo)

## Bloco 4 — Observações finais
13. Informação importante para a liderança (parágrafo, opcional)

## Detalhes técnicos

### Estado `Respostas`
Adicionar:
- `experimentaisAgendadas: string`
- `fechamentoExperimentais: '' | 'TODAS' | 'PARCIAL' | 'NENHUMA' | 'NAO_HOUVE'`
- `qtdNaoFecharam: string`
- `motivoNaoFechamento: '' | 'PRECO' | 'VAI_PENSAR' | 'NAO_GOSTOU' | 'HORARIO' | 'OUTRO'`
- `motivoNaoFechamentoOutro: string`
- `novasMatriculasTexto: string`, `renovacoesTexto: string`, `cancelamentosTexto: string`, `naoRenovadosTexto: string`, `inadimplentesTexto: string`
- `feedbackTexto: string`, `acaoTomada: boolean | null`, `acaoTomadaTexto: string`

Manter campos antigos numéricos no submit como `null` para não quebrar histórico (ou descontinuar — ver migração abaixo).

### Persistência (`relatorio_diario_comercial_respostas`)
Adicionar colunas via migration:
- `experimentais_agendadas integer`
- `fechamento_experimentais text` (enum lógica via CHECK)
- `qtd_nao_fecharam integer`
- `motivo_nao_fechamento text`
- `motivo_nao_fechamento_outro text`
- `novas_matriculas_texto text` (substitui semântica de `novos_alunos`)
- `renovacoes_texto text`
- `cancelamentos_texto text`
- `nao_renovados_texto text`
- `inadimplentes_texto text`
- `feedback_acao_tomada boolean`
- `feedback_acao_descricao text`

Colunas legadas (`novos_alunos`, `renovacoes`, `cancelamentos`, `nao_renovados_qtd`, `inadimplentes_qtd`, `evasao`) ficam para histórico — o novo submit envia `null` nelas.

### UI/UX
- Reaproveitar `OptionCard`, `Input`, `Textarea`, `StepShell`.
- Subperguntas montadas dinamicamente no `useMemo([r])` como já é feito.
- Tela de Resumo (`review`) ajustada para mostrar os novos campos em ordem.

### Sem mudanças em
- `submitFormularioPublico` / notificações de grupo (continuam disparando com `tipo_formulario: 'relatorio_comercial'`).
- Rotas, layout, design tokens.
