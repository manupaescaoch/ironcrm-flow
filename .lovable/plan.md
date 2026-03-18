

## Diagnóstico: Estoque FLANELA e AGUA MINERAL não atualizam quantidade

### Problema encontrado
O trigger que atualiza automaticamente a quantidade do estoque após uma movimentação **não existe** no banco de dados. A função `atualizar_estoque_apos_movimentacao()` está criada, mas não há trigger vinculado à tabela `movimentacoes_estoque` para executá-la.

Isso significa que quando alguém registra uma entrada, a linha é inserida em `movimentacoes_estoque`, mas a `quantidade_atual` em `estoque_interno` **nunca é atualizada**.

### Evidências
- As movimentações estão sendo registradas normalmente (entradas de AGUA MINERAL e FLANELA existem no banco)
- A quantidade atual permanece inalterada porque o trigger não dispara
- A consulta `information_schema.triggers` retorna vazio para `movimentacoes_estoque`

### Correção
Criar o trigger que falta via migração SQL:

```sql
CREATE TRIGGER trigger_atualizar_estoque
AFTER INSERT ON public.movimentacoes_estoque
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_estoque_apos_movimentacao();
```

### Correção de dados existentes
Após criar o trigger, recalcular as quantidades atuais dos insumos afetados baseando-se no histórico de movimentações (último ajuste + entradas - retiradas).

### Impacto
- Nenhuma alteração de código frontend necessária
- Apenas uma migração SQL para criar o trigger
- Recalcular saldos dos insumos afetados
