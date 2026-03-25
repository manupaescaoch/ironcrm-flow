

## Corrigir lista de responsáveis para perfil Comercial

### Problema
A tabela `user_unidades` tem RLS que permite SELECT apenas para `user_id = auth.uid()` (ou admin). Quando o hook `useUnidadeUsers` consulta todos os `user_id` da unidade, o comercial só recebe seu próprio registro, resultando numa lista com apenas 1 usuário.

### Solução

**1. Migration** — Atualizar a política de SELECT na tabela `user_unidades` para permitir que qualquer usuário autenticado da mesma unidade veja os demais membros:

```sql
DROP POLICY IF EXISTS "Users can view own unidades" ON public.user_unidades;

CREATE POLICY "Users can view unidade members" ON public.user_unidades
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);
```

Isso permite que qualquer usuário veja os registros de `user_unidades` que pertencem às mesmas unidades que ele, sem expor dados de outras unidades.

**2. Nenhuma alteração no frontend** — O hook e o modal já estão corretos.

### Resultado
O comercial verá todos os colegas da unidade nos selects de Responsável Principal e Conferência.

