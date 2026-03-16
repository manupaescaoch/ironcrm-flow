

# Criar Perfil Coordenador

## Resumo
Adicionar o perfil "coordenador" ao sistema. O coordenador terá as mesmas permissões que recepção/comercial, mas poderá editar dados da Escala (adicionar, editar, excluir registros).

## Alterações necessárias

### 1. Banco de dados - Novo valor no enum `app_role`
Adicionar `'coordenador'` ao enum `app_role` existente (que hoje tem: admin, moderator, user).

### 2. Banco de dados - RLS da tabela `escala`
Atualizar as policies de INSERT, UPDATE e DELETE da tabela `escala` para permitir também o role `'coordenador'` (além de admin).

### 3. AuthContext (`src/contexts/AuthContext.tsx`)
- Adicionar `'coordenador'` ao tipo `UserRole`
- No `fetchUserRole`, mapear o enum `'coordenador'` para o display role `'coordenador'`
- Adicionar helper `canEditEscala` que retorna `true` para admin e coordenador

### 4. Edge Functions (`update-user-role` e `create-user`)
- Adicionar `'coordenador'` à lista de `allowedRoles`
- Mapear `'coordenador'` para o app_role `'coordenador'` (em vez de moderator/user)

### 5. Layout (`src/components/Layout.tsx`)
- Adicionar `'coordenador'` ao array de roles dos itens de navegação que coordenador pode acessar (mesmos que recepcao/comercial)

### 6. Escala page (`src/pages/Escala.tsx`)
- Substituir `isAdmin` por `isAdmin || userRole === 'coordenador'` (ou usar o novo helper `canEditEscala`) nas verificações de permissão de edição

### 7. AdminUsers page
- Adicionar opção "Coordenador" no select de roles ao criar/editar usuários

## Detalhes técnicos

**Migração SQL:**
```sql
ALTER TYPE public.app_role ADD VALUE 'coordenador';

-- Update escala INSERT policy
DROP POLICY IF EXISTS "insert_escala_admin" ON public.escala;
CREATE POLICY "insert_escala_admin_coord" ON public.escala
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role)
);

-- Similar for UPDATE and DELETE policies
```

