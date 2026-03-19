

## Corrigir layout do calendário - eventos contidos dentro da célula do dia

### Problema
Os blocos de evento estão empilhando verticalmente e expandindo a célula, quebrando o grid. No Google Calendar, cada evento é uma linha compacta que fica contida dentro da célula da hora, com `overflow-hidden` e um indicador "+N" quando há muitos.

### Alterações em `RotinasCalendario.tsx`

1. **Célula do dia/hora**: Adicionar `overflow-hidden` para conter os eventos dentro do espaço fixo da célula
2. **EventBlock mais compacto**: Reduzir para uma única linha (nome truncado apenas), removendo a segunda linha de detalhes quando há múltiplos eventos na mesma célula
3. **Limitar eventos visíveis**: Mostrar no máximo 2-3 eventos por célula e um badge "+N mais" para os restantes
4. **Altura fixa por hora**: Garantir que cada linha de hora tem altura fixa (64px) e não cresce com o conteúdo

