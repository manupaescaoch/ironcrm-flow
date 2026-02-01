
# Plano: Sistema de Notificacoes para Tarefas

## Contexto Atual

O sistema de tarefas possui:
1. Campo `responsavel` - armazena o **nome** do responsavel (texto livre, ex: "MANU PAES")
2. Usuarios tem `name` no `auth.users.raw_user_meta_data` (pode ser null)
3. Hook `useUnidadeUsers` retorna usuarios da unidade com nome em maiusculas
4. Nao existe sistema de notificacoes implementado

## Problema Identificado

- O campo `responsavel` armazena um **nome** (string), nao um `user_id`
- Isso dificulta vincular diretamente uma tarefa a um usuario autenticado
- Para exibir notificacoes no perfil, precisamos:
  1. Relacionar o nome do responsavel ao usuario logado
  2. Criar um sistema de notificacoes persistente ou em tempo real

---

## Solucao Proposta

### Fase 1: Tabela de Notificacoes

Criar tabela `task_notifications` para persistir notificacoes:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | Chave primaria |
| task_id | uuid | FK para tasks |
| user_id | uuid | Usuario destinatario |
| tipo | text | Tipo: 'nova_tarefa', 'prazo_proximo', 'tarefa_atualizada' |
| titulo | text | Titulo da notificacao |
| mensagem | text | Corpo da mensagem |
| lida | boolean | Se foi lida |
| created_at | timestamptz | Data de criacao |

### Fase 2: Trigger para Gerar Notificacoes

Criar trigger que dispara quando:
1. Uma tarefa e criada (notifica o responsavel)
2. O responsavel de uma tarefa e alterado (notifica o novo responsavel)
3. Tarefa proxima do prazo (via cron ou trigger)

Desafio: O campo `responsavel` e texto. Precisamos de uma funcao que mapeie nome para `user_id`:

```sql
-- Funcao para encontrar user_id pelo nome
CREATE FUNCTION find_user_by_name(p_name text)
RETURNS uuid AS $$
  SELECT id FROM auth.users
  WHERE UPPER(raw_user_meta_data->>'name') = UPPER(p_name)
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### Fase 3: Hook useTaskNotifications

Criar hook para buscar notificacoes do usuario logado:

```typescript
// src/hooks/useTaskNotifications.ts
export function useTaskNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Buscar notificacoes
  // Marcar como lida
  // Realtime subscription
}
```

### Fase 4: Componente de Notificacoes no Layout

Adicionar icone de sino (Bell) no header/sidebar com badge de contagem:

```text
+------------------+
|  [Bell] 3        |  <- Icone com badge vermelho
+------------------+
      |
      v
+------------------+
| Notificacoes     |
| - Nova tarefa... |
| - Prazo amanha...|
+------------------+
```

---

## Detalhes Tecnicos

### Migracao SQL

```sql
-- Tabela de notificacoes
CREATE TABLE public.task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'nova_tarefa',
  titulo text NOT NULL,
  mensagem text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;

-- Usuario so ve suas proprias notificacoes
CREATE POLICY "Users can view own notifications"
ON public.task_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.task_notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Indice para performance
CREATE INDEX idx_task_notifications_user ON public.task_notifications(user_id, lida);

-- Funcao para encontrar usuario pelo nome
CREATE OR REPLACE FUNCTION public.find_user_by_name(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users
  WHERE UPPER(COALESCE(raw_user_meta_data->>'name', '')) = UPPER(TRIM(p_name))
  LIMIT 1
$$;

-- Trigger para criar notificacao quando tarefa e atribuida
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_creator_name text;
BEGIN
  -- Encontrar usuario pelo nome do responsavel
  v_user_id := public.find_user_by_name(NEW.responsavel);
  
  -- Se encontrou usuario e nao e o proprio criador
  IF v_user_id IS NOT NULL AND v_user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    -- Buscar nome do criador
    SELECT COALESCE(raw_user_meta_data->>'name', email) INTO v_creator_name
    FROM auth.users WHERE id = NEW.created_by;
    
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.task_notifications (task_id, user_id, tipo, titulo, mensagem)
      VALUES (
        NEW.id,
        v_user_id,
        'nova_tarefa',
        'Nova tarefa atribuida',
        'Voce foi designado para: ' || NEW.titulo || ' por ' || COALESCE(v_creator_name, 'Sistema')
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.responsavel IS DISTINCT FROM NEW.responsavel THEN
      INSERT INTO public.task_notifications (task_id, user_id, tipo, titulo, mensagem)
      VALUES (
        NEW.id,
        v_user_id,
        'tarefa_atualizada',
        'Tarefa transferida para voce',
        'A tarefa "' || NEW.titulo || '" foi transferida para voce'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_task_assignment
AFTER INSERT OR UPDATE OF responsavel ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assignment();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_notifications;
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useTaskNotifications.ts` | Hook para buscar/gerenciar notificacoes |
| `src/components/notifications/NotificationBell.tsx` | Componente do sino com dropdown |
| `src/components/notifications/NotificationItem.tsx` | Item individual de notificacao |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/Layout.tsx` | Adicionar NotificationBell no header |

---

## Fluxo de Uso

1. Admin cria tarefa e atribui a "JOAO SILVA" como responsavel
2. Trigger identifica user_id de "JOAO SILVA" pelo nome
3. Cria registro em `task_notifications`
4. Joao ve o sino com badge "1" no sidebar
5. Ao clicar, ve a lista de notificacoes
6. Ao clicar em uma notificacao, marca como lida e pode navegar para a tarefa

---

## Consideracoes

**Limitacao do mapeamento por nome:**
- Se o nome nao bater exatamente (ex: "JOAO" vs "JOAO SILVA"), a notificacao nao sera criada
- Recomendacao futura: adicionar campo `responsavel_id` na tabela tasks para vinculo direto

**Realtime:**
- As notificacoes terao update em tempo real via Supabase Realtime
- O badge atualizara automaticamente quando nova notificacao chegar

---

## Beneficios

- Usuarios sao notificados imediatamente quando recebem tarefas
- Badge visual no menu mostra quantidade de notificacoes nao lidas
- Historico de notificacoes persistido
- Possibilidade futura de expandir para outros tipos (vencimentos, follow-ups, etc.)
