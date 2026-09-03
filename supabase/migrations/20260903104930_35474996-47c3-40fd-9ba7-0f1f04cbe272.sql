-- ============================================================
-- ETAPA 2: Banco e auditoria do EVO OPS (aditivo, não destrutivo)
-- ============================================================

-- 1) Campos operacionais em cronograma_atividades
ALTER TABLE public.cronograma_atividades
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS instrucao text,
  ADD COLUMN IF NOT EXISTS setor text,
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS prazo time without time zone,
  ADD COLUMN IF NOT EXISTS exige_evidencia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exige_confirmacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cronograma_atividades_prioridade_check') THEN
    ALTER TABLE public.cronograma_atividades
      ADD CONSTRAINT cronograma_atividades_prioridade_check
      CHECK (prioridade IN ('baixa','normal','alta','critica'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cronograma_atividades_status_check') THEN
    ALTER TABLE public.cronograma_atividades
      ADD CONSTRAINT cronograma_atividades_status_check
      CHECK (status IN ('pendente','em_andamento','concluida','atrasada','cancelada'));
  END IF;
END $$;

-- 2) Vínculo funcionário <-> usuário do Auth (opcional)
ALTER TABLE public.cronograma_funcionarios
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cronograma_funcionarios_user_id
  ON public.cronograma_funcionarios(user_id) WHERE user_id IS NOT NULL;

-- 3) Auditoria: cobrir todos os campos operacionais
CREATE OR REPLACE FUNCTION public.log_cronograma_atividade_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_name text;
  v_bulk uuid;
  v_campo text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_campos text[] := ARRAY[
    'ativo','horario','dia_semana','responsavel_id','formulario_id','mensagem',
    'unidade_id','turno','titulo','tipo_atividade','descricao','instrucao','setor',
    'prioridade','status','prazo','exige_evidencia','exige_confirmacao',
    'cancelado_por','cancelado_em','motivo_cancelamento'
  ];
BEGIN
  v_user_name := COALESCE(
    (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
       FROM auth.users WHERE id = auth.uid()),
    'SISTEMA'
  );
  BEGIN v_bulk := NULLIF(current_setting('app.bulk_operation_id', true),'')::uuid;
  EXCEPTION WHEN others THEN v_bulk := NULL; END;

  FOREACH v_campo IN ARRAY v_campos LOOP
    IF (v_old ->> v_campo) IS DISTINCT FROM (v_new ->> v_campo) THEN
      INSERT INTO public.cronograma_atividades_historico(
        atividade_id, user_id, user_name, campo, valor_anterior, valor_novo, bulk_operation_id)
      VALUES (NEW.id, auth.uid(), v_user_name, v_campo,
              v_old ->> v_campo, v_new ->> v_campo, v_bulk);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3b) Registrar criação da atividade no histórico
CREATE OR REPLACE FUNCTION public.log_cronograma_atividade_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_user_name text;
BEGIN
  v_user_name := COALESCE(
    (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
       FROM auth.users WHERE id = auth.uid()),
    'SISTEMA'
  );
  INSERT INTO public.cronograma_atividades_historico(
    atividade_id, user_id, user_name, campo, valor_anterior, valor_novo)
  VALUES (NEW.id, auth.uid(), v_user_name, 'criacao', NULL, NEW.titulo);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_cronograma_insert ON public.cronograma_atividades;
CREATE TRIGGER trg_log_cronograma_insert
AFTER INSERT ON public.cronograma_atividades
FOR EACH ROW EXECUTE FUNCTION public.log_cronograma_atividade_insert();

-- 3c) criado_por automático
CREATE OR REPLACE FUNCTION public.set_cronograma_criado_por()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.criado_por IS NULL THEN NEW.criado_por := auth.uid(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cronograma_criado_por ON public.cronograma_atividades;
CREATE TRIGGER trg_set_cronograma_criado_por
BEFORE INSERT ON public.cronograma_atividades
FOR EACH ROW EXECUTE FUNCTION public.set_cronograma_criado_por();

-- 3d) Proteção do autor original e exigência de motivo no cancelamento
CREATE OR REPLACE FUNCTION public.protect_cronograma_atividade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.criado_por := OLD.criado_por;
  IF NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada' THEN
    IF NEW.motivo_cancelamento IS NULL OR btrim(NEW.motivo_cancelamento) = '' THEN
      RAISE EXCEPTION 'Motivo do cancelamento é obrigatório';
    END IF;
    NEW.cancelado_por := COALESCE(NEW.cancelado_por, auth.uid());
    NEW.cancelado_em := COALESCE(NEW.cancelado_em, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_cronograma_atividade ON public.cronograma_atividades;
CREATE TRIGGER trg_protect_cronograma_atividade
BEFORE UPDATE ON public.cronograma_atividades
FOR EACH ROW EXECUTE FUNCTION public.protect_cronograma_atividade();

-- 4) Bloquear DELETE físico de atividades operacionais
DROP POLICY IF EXISTS delete_cronograma_ativ_by_unidade ON public.cronograma_atividades;
REVOKE DELETE ON public.cronograma_atividades FROM authenticated;
REVOKE DELETE ON public.cronograma_atividades FROM anon;

-- 5) Auditoria legível por unidade e imutável
DROP POLICY IF EXISTS select_cronograma_historico_by_unidade ON public.cronograma_atividades_historico;
CREATE POLICY select_cronograma_historico_by_unidade
ON public.cronograma_atividades_historico
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.cronograma_atividades a
      WHERE a.id = cronograma_atividades_historico.atividade_id
        AND a.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

REVOKE UPDATE, DELETE ON public.cronograma_atividades_historico FROM authenticated;
REVOKE UPDATE, DELETE ON public.cronograma_atividades_historico FROM anon;
GRANT SELECT ON public.cronograma_atividades_historico TO authenticated;
GRANT ALL ON public.cronograma_atividades_historico TO service_role;

-- 6) Helpers de escopo
CREATE OR REPLACE FUNCTION public.ops_can_access_atividade(_user_id uuid, _atividade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin') OR EXISTS (
      SELECT 1 FROM public.cronograma_atividades a
      WHERE a.id = _atividade_id
        AND a.unidade_id IN (SELECT public.get_user_unidades(_user_id))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.ops_can_execute_atividade(_user_id uuid, _atividade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ops_can_access_atividade(_user_id, _atividade_id) AND (
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'coordenador')
    OR EXISTS (
      SELECT 1 FROM public.cronograma_atividades a
      JOIN public.cronograma_funcionarios f ON f.id = a.responsavel_id
      WHERE a.id = _atividade_id AND f.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.cronograma_atividades a
      WHERE a.id = _atividade_id AND a.criado_por = _user_id
    )
    OR public.has_role(_user_id, 'user')
  );
$$;

REVOKE ALL ON FUNCTION public.ops_can_access_atividade(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_can_execute_atividade(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_can_access_atividade(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ops_can_execute_atividade(uuid, uuid) TO authenticated, service_role;

-- 7) Execução diária das atividades
CREATE TABLE IF NOT EXISTS public.ops_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.cronograma_atividades(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  data_execucao date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  iniciado_em timestamptz,
  iniciado_por uuid,
  concluido_em timestamptz,
  concluido_por uuid,
  cancelado_em timestamptz,
  cancelado_por uuid,
  motivo_cancelamento text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (atividade_id, data_execucao)
);

GRANT SELECT, INSERT, UPDATE ON public.ops_execucoes TO authenticated;
GRANT ALL ON public.ops_execucoes TO service_role;
ALTER TABLE public.ops_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_ops_execucoes ON public.ops_execucoes
FOR SELECT TO authenticated
USING (public.ops_can_access_atividade(auth.uid(), atividade_id));

CREATE POLICY insert_ops_execucoes ON public.ops_execucoes
FOR INSERT TO authenticated
WITH CHECK (public.ops_can_execute_atividade(auth.uid(), atividade_id));

CREATE POLICY update_ops_execucoes ON public.ops_execucoes
FOR UPDATE TO authenticated
USING (public.ops_can_execute_atividade(auth.uid(), atividade_id))
WITH CHECK (public.ops_can_execute_atividade(auth.uid(), atividade_id));

CREATE OR REPLACE FUNCTION public.validate_ops_execucao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'cancelada' AND (NEW.motivo_cancelamento IS NULL OR btrim(NEW.motivo_cancelamento) = '') THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório';
  END IF;
  IF NEW.status = 'em_andamento' THEN
    NEW.iniciado_em := COALESCE(NEW.iniciado_em, now());
    NEW.iniciado_por := COALESCE(NEW.iniciado_por, auth.uid());
  END IF;
  IF NEW.status = 'concluida' THEN
    NEW.concluido_em := COALESCE(NEW.concluido_em, now());
    NEW.concluido_por := COALESCE(NEW.concluido_por, auth.uid());
  END IF;
  IF NEW.status = 'cancelada' THEN
    NEW.cancelado_em := COALESCE(NEW.cancelado_em, now());
    NEW.cancelado_por := COALESCE(NEW.cancelado_por, auth.uid());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ops_execucao ON public.ops_execucoes;
CREATE TRIGGER trg_validate_ops_execucao
BEFORE INSERT OR UPDATE ON public.ops_execucoes
FOR EACH ROW EXECUTE FUNCTION public.validate_ops_execucao();

-- 7b) Auditoria da execução dentro do histórico da atividade
CREATE OR REPLACE FUNCTION public.log_ops_execucao_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  v_user_name := COALESCE(
    (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
       FROM auth.users WHERE id = auth.uid()), 'SISTEMA');
  INSERT INTO public.cronograma_atividades_historico(
    atividade_id, user_id, user_name, campo, valor_anterior, valor_novo)
  VALUES (NEW.atividade_id, auth.uid(), v_user_name,
          'execucao_' || NEW.data_execucao::text,
          CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
          NEW.status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ops_execucao ON public.ops_execucoes;
CREATE TRIGGER trg_log_ops_execucao
AFTER INSERT OR UPDATE ON public.ops_execucoes
FOR EACH ROW EXECUTE FUNCTION public.log_ops_execucao_changes();

-- 8) Comentários
CREATE TABLE IF NOT EXISTS public.ops_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.cronograma_atividades(id) ON DELETE CASCADE,
  execucao_id uuid REFERENCES public.ops_execucoes(id) ON DELETE SET NULL,
  usuario_id uuid NOT NULL,
  usuario_nome text,
  comentario text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ops_comentarios TO authenticated;
GRANT ALL ON public.ops_comentarios TO service_role;
ALTER TABLE public.ops_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_ops_comentarios ON public.ops_comentarios
FOR SELECT TO authenticated
USING (public.ops_can_access_atividade(auth.uid(), atividade_id));

CREATE POLICY insert_ops_comentarios ON public.ops_comentarios
FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid() AND public.ops_can_access_atividade(auth.uid(), atividade_id));

-- 9) Evidências / anexos
CREATE TABLE IF NOT EXISTS public.ops_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.cronograma_atividades(id) ON DELETE CASCADE,
  execucao_id uuid REFERENCES public.ops_execucoes(id) ON DELETE SET NULL,
  usuario_id uuid NOT NULL,
  arquivo_url text NOT NULL,
  tipo text,
  nome_arquivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ops_anexos TO authenticated;
GRANT ALL ON public.ops_anexos TO service_role;
ALTER TABLE public.ops_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_ops_anexos ON public.ops_anexos
FOR SELECT TO authenticated
USING (public.ops_can_access_atividade(auth.uid(), atividade_id));

CREATE POLICY insert_ops_anexos ON public.ops_anexos
FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid() AND public.ops_can_access_atividade(auth.uid(), atividade_id));

-- 10) Notificações internas
CREATE TABLE IF NOT EXISTS public.ops_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  atividade_id uuid REFERENCES public.cronograma_atividades(id) ON DELETE CASCADE,
  execucao_id uuid REFERENCES public.ops_execucoes(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  mensagem text,
  tipo text NOT NULL DEFAULT 'info',
  lida boolean NOT NULL DEFAULT false,
  lido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_notificacoes_usuario ON public.ops_notificacoes(usuario_id, lida, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.ops_notificacoes TO authenticated;
GRANT ALL ON public.ops_notificacoes TO service_role;
ALTER TABLE public.ops_notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_ops_notificacoes_own ON public.ops_notificacoes
FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE POLICY insert_ops_notificacoes_own ON public.ops_notificacoes
FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE POLICY update_ops_notificacoes_own ON public.ops_notificacoes
FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- 11) Dispositivos para Web Push
CREATE TABLE IF NOT EXISTS public.ops_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  device_info text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_push_subscriptions TO authenticated;
GRANT ALL ON public.ops_push_subscriptions TO service_role;
ALTER TABLE public.ops_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY manage_ops_push_own ON public.ops_push_subscriptions
FOR ALL TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP TRIGGER IF EXISTS trg_ops_push_updated_at ON public.ops_push_subscriptions;
CREATE TRIGGER trg_ops_push_updated_at
BEFORE UPDATE ON public.ops_push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();