

## Célula do calendário expande com mais atividades

### Problema
Atualmente a linha de hora tem altura fixa (`h-[72px]`) e `overflow-hidden`, escondendo rotinas extras. O usuário quer que a célula cresça para baixo mostrando todas as rotinas, mantendo o tamanho do texto.

### Alterações em `RotinasCalendario.tsx`

1. **Remover altura fixa da linha**: Trocar `h-[72px]` por `min-h-[72px]` — a célula mantém altura mínima mas cresce se houver mais conteúdo
2. **Remover overflow-hidden da célula do dia**: Permitir que todos os eventos sejam exibidos
3. **Remover limite MAX_VISIBLE e indicador "+N mais"**: Mostrar todas as rotinas sem truncar a lista
4. **Manter tamanho do texto**: `text-[11px]` para nome e `text-[10px]` para horário permanecem iguais
5. **Ajustar indicador de hora atual**: Como as linhas agora têm altura variável, o cálculo da posição da linha vermelha precisa ser removido do estilo percentual e usar uma abordagem baseada em ref/scroll (ou aceitar aproximação)

### Seção técnica
- Linha 174: `h-[72px]` → `min-h-[72px]`
- Linha 185: remover `overflow-hidden`
- Linhas 181-183, 197-199: remover `MAX_VISIBLE`, `visible`, `overflow` — iterar diretamente em `items`

