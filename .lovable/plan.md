## Diagnóstico

A página `/admin-users` mostra "Erro no servidor" porque a edge function `list-users` retorna **403 "Sem permissão para listar usuários"** mesmo para o usuário `emanuel.paes@gmail.com`, que **é admin** (confirmado em `public.user_roles`).

### Causa raiz

A função `public.has_role(_user_id, _role)` foi modificada e contém uma cláusula extra que quebra o uso server-side:

```sql
AND (
  _user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_roles a WHERE a.user_id = auth.uid() AND a.role = 'admin')
)
```

Na edge function `list-users`, `has_role` é chamado via cliente **service-role**, onde `auth.uid()` é `NULL`. Resultado:
- `_user_id = auth.uid()` → falso (NULL)
- subquery de admin → falso (NULL)
- retorna `false` para TODOS os roles, mesmo do admin real

Isso também quebra silenciosamente qualquer outra edge function que use `has_role` com service-role (potencialmente outras checagens de permissão no projeto).

### Por que isso é incorreto

O padrão canônico da memória do projeto e da documentação Supabase é:

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

`SECURITY DEFINER` já evita recursão em RLS; não cabe filtro por `auth.uid()` dentro dela. Quem precisa restringir "só admin vê roles dos outros" deve fazer isso na **policy** da tabela `user_roles`, não dentro do helper.

## Plano

### 1. Migração: restaurar `has_role`
Recriar a função sem a cláusula `auth.uid()`:

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### 2. Verificar RLS de `user_roles`
Listar policies atuais de `public.user_roles` para confirmar que leituras de roles alheios continuam bloqueadas para não-admins (a restrição que estava embutida em `has_role` provavelmente foi posta lá para isso). Se as policies já são adequadas, nada muda. Se não, adicionar policy `SELECT` que só permita ao próprio usuário ver seu role, e admins verem todos — usando `has_role(auth.uid(),'admin')`.

### 3. Validação
- Recarregar `/admin-users` logado como `emanuel.paes@gmail.com` → lista deve carregar sem o card vermelho.
- Conferir logs de `list-users` → deve aparecer `Successfully listed N users`.
- Sanity-check em outras edge functions que usam `has_role` (rotinas, comissões, cronograma admin) — devem continuar funcionando porque o comportamento volta a ser o esperado.

## Detalhes técnicos

**Arquivos tocados:** apenas uma migração SQL nova (nenhum código TS muda).
**Risco:** baixo. A função volta ao padrão original que outras 50+ policies do projeto assumem. Quem confiava na guarda extra era — pelo que vejo — somente quem chamava `has_role` em contexto autenticado, e nesses casos `auth.uid()` é o próprio usuário ou admin, então o comportamento de retorno não muda.
