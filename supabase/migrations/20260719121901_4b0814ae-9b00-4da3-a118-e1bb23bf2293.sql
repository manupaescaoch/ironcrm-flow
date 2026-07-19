
-- 1. Colunas novas
ALTER TABLE public.cronograma_atividades
  ADD COLUMN IF NOT EXISTS tipo_atividade text,
  ADD COLUMN IF NOT EXISTS turno text;

-- 2. Normalizador de título → tipo_atividade
CREATE OR REPLACE FUNCTION public.normalize_cronograma_tipo(p_titulo text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  t text;
BEGIN
  IF p_titulo IS NULL THEN RETURN NULL; END IF;
  t := upper(unaccent(btrim(p_titulo)));
  -- remove sufixos de unidade, turno, responsavel
  t := regexp_replace(t, '\s*[-–—]\s*(UNIDADE|TURNO|RESPONSAVEL)\b.*$', '', 'g');
  t := regexp_replace(t, '\s*\(.*\)\s*$', '', 'g');
  -- remove horários (12:30 etc.)
  t := regexp_replace(t, '\s*\d{1,2}[:h]\d{0,2}\s*', ' ', 'g');
  -- remove sufixos de turno numérico
  t := regexp_replace(t, '\s*TURNO\s*\d+\s*$', '', 'g');
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'));

  -- mapeamentos conhecidos
  IF t ~ 'ENVIO.*GRADE.*HORARIO.*COORDENADOR' THEN RETURN 'ENVIO DA GRADE DE HORARIO PARA COORDENADOR'; END IF;
  IF t ~ 'ENCERRAMENTO.*TURNO' THEN RETURN 'ENCERRAMENTO DE TURNO'; END IF;
  IF t ~ 'ABERTURA.*TURNO' THEN RETURN 'ABERTURA DE TURNO'; END IF;
  IF t ~ 'RELATORIO.*DIARIO' THEN RETURN 'RELATORIO DIARIO'; END IF;
  IF t ~ 'CONFERENCIA.*AGENDA' THEN RETURN 'CONFERENCIA DE AGENDA'; END IF;
  IF t ~ 'ANAMNESE' THEN RETURN 'ANAMNESE'; END IF;
  IF t ~ 'ENCERRAMENTO.*COORDENADOR' THEN RETURN 'ENCERRAMENTO COORDENADOR'; END IF;

  RETURN t;
END;
$$;

-- unaccent extension (safe if exists)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 3. Trigger set_tipo_atividade
CREATE OR REPLACE FUNCTION public.set_cronograma_tipo_atividade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tipo_atividade IS NULL OR NEW.tipo_atividade = '' OR (TG_OP='UPDATE' AND NEW.titulo IS DISTINCT FROM OLD.titulo AND (OLD.tipo_atividade IS NULL OR NEW.tipo_atividade = OLD.tipo_atividade)) THEN
    NEW.tipo_atividade := public.normalize_cronograma_tipo(NEW.titulo);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cronograma_tipo ON public.cronograma_atividades;
CREATE TRIGGER trg_set_cronograma_tipo
BEFORE INSERT OR UPDATE ON public.cronograma_atividades
FOR EACH ROW EXECUTE FUNCTION public.set_cronograma_tipo_atividade();

-- 4. Backfill
UPDATE public.cronograma_atividades
SET tipo_atividade = public.normalize_cronograma_tipo(titulo)
WHERE tipo_atividade IS NULL OR tipo_atividade = '';

CREATE INDEX IF NOT EXISTS idx_cronograma_ativ_tipo ON public.cronograma_atividades(tipo_atividade, unidade_id, ativo);

-- 5. Histórico
CREATE TABLE IF NOT EXISTS public.cronograma_atividades_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid REFERENCES public.cronograma_atividades(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  bulk_operation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cronograma_atividades_historico TO authenticated;
GRANT ALL ON public.cronograma_atividades_historico TO service_role;

ALTER TABLE public.cronograma_atividades_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view historico"
ON public.cronograma_atividades_historico FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can insert historico"
ON public.cronograma_atividades_historico FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_cronograma_hist_atv ON public.cronograma_atividades_historico(atividade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cronograma_hist_bulk ON public.cronograma_atividades_historico(bulk_operation_id);

-- 6. Trigger que grava histórico ao alterar
CREATE OR REPLACE FUNCTION public.log_cronograma_atividade_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_name text;
  v_bulk uuid;
BEGIN
  v_user_name := COALESCE(
    (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email) FROM auth.users WHERE id = auth.uid()),
    'SISTEMA'
  );
  BEGIN v_bulk := NULLIF(current_setting('app.bulk_operation_id', true),'')::uuid; EXCEPTION WHEN others THEN v_bulk := NULL; END;

  IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'ativo', OLD.ativo::text, NEW.ativo::text, v_bulk);
  END IF;
  IF OLD.horario IS DISTINCT FROM NEW.horario THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'horario', OLD.horario::text, NEW.horario::text, v_bulk);
  END IF;
  IF OLD.dia_semana IS DISTINCT FROM NEW.dia_semana THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'dia_semana', OLD.dia_semana::text, NEW.dia_semana::text, v_bulk);
  END IF;
  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'responsavel_id', OLD.responsavel_id::text, NEW.responsavel_id::text, v_bulk);
  END IF;
  IF OLD.formulario_id IS DISTINCT FROM NEW.formulario_id THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'formulario_id', OLD.formulario_id::text, NEW.formulario_id::text, v_bulk);
  END IF;
  IF OLD.mensagem IS DISTINCT FROM NEW.mensagem THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'mensagem', OLD.mensagem, NEW.mensagem, v_bulk);
  END IF;
  IF OLD.unidade_id IS DISTINCT FROM NEW.unidade_id THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'unidade_id', OLD.unidade_id::text, NEW.unidade_id::text, v_bulk);
  END IF;
  IF OLD.turno IS DISTINCT FROM NEW.turno THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'turno', OLD.turno, NEW.turno, v_bulk);
  END IF;
  IF OLD.titulo IS DISTINCT FROM NEW.titulo THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'titulo', OLD.titulo, NEW.titulo, v_bulk);
  END IF;
  IF OLD.tipo_atividade IS DISTINCT FROM NEW.tipo_atividade THEN
    INSERT INTO public.cronograma_atividades_historico(atividade_id,user_id,user_name,campo,valor_anterior,valor_novo,bulk_operation_id)
    VALUES (NEW.id, auth.uid(), v_user_name, 'tipo_atividade', OLD.tipo_atividade, NEW.tipo_atividade, v_bulk);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_cronograma_changes ON public.cronograma_atividades;
CREATE TRIGGER trg_log_cronograma_changes
AFTER UPDATE ON public.cronograma_atividades
FOR EACH ROW EXECUTE FUNCTION public.log_cronograma_atividade_changes();

-- 7. RPC de edição em massa
CREATE OR REPLACE FUNCTION public.admin_bulk_update_cronograma(
  p_ids uuid[],
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_add_dias int[] DEFAULT NULL,
  p_replace_dias int[] DEFAULT NULL,
  p_duplicate boolean DEFAULT false,
  p_delete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bulk uuid := gen_random_uuid();
  v_affected int := 0;
  v_id uuid;
  v_dia int;
  v_rec record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF p_ids IS NULL OR array_length(p_ids,1) IS NULL THEN
    RETURN jsonb_build_object('affected',0,'bulk_operation_id',v_bulk);
  END IF;

  PERFORM set_config('app.bulk_operation_id', v_bulk::text, true);

  IF p_delete THEN
    UPDATE public.cronograma_atividades SET ativo = false, updated_at = now() WHERE id = ANY(p_ids);
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN jsonb_build_object('affected',v_affected,'bulk_operation_id',v_bulk);
  END IF;

  IF p_duplicate THEN
    INSERT INTO public.cronograma_atividades (unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade)
    SELECT unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade
    FROM public.cronograma_atividades WHERE id = ANY(p_ids);
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN jsonb_build_object('affected',v_affected,'bulk_operation_id',v_bulk);
  END IF;

  -- Patch de campos simples
  IF p_patch <> '{}'::jsonb THEN
    UPDATE public.cronograma_atividades a SET
      ativo = COALESCE((p_patch->>'ativo')::boolean, a.ativo),
      horario = CASE WHEN p_patch ? 'horario' THEN NULLIF(p_patch->>'horario','')::time ELSE a.horario END,
      responsavel_id = CASE WHEN p_patch ? 'responsavel_id' THEN NULLIF(p_patch->>'responsavel_id','')::uuid ELSE a.responsavel_id END,
      formulario_id = CASE WHEN p_patch ? 'formulario_id' THEN NULLIF(p_patch->>'formulario_id','')::uuid ELSE a.formulario_id END,
      unidade_id = CASE WHEN p_patch ? 'unidade_id' THEN (p_patch->>'unidade_id')::uuid ELSE a.unidade_id END,
      turno = CASE WHEN p_patch ? 'turno' THEN NULLIF(p_patch->>'turno','') ELSE a.turno END,
      mensagem = CASE WHEN p_patch ? 'mensagem' THEN NULLIF(p_patch->>'mensagem','') ELSE a.mensagem END,
      titulo = CASE WHEN p_patch ? 'titulo' THEN p_patch->>'titulo' ELSE a.titulo END,
      tipo_atividade = CASE WHEN p_patch ? 'tipo_atividade' THEN p_patch->>'tipo_atividade' ELSE a.tipo_atividade END,
      updated_at = now()
    WHERE a.id = ANY(p_ids);
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSE
    v_affected := array_length(p_ids,1);
  END IF;

  -- Substituir dias: cria N-1 duplicatas + atualiza original
  IF p_replace_dias IS NOT NULL AND array_length(p_replace_dias,1) IS NOT NULL THEN
    FOR v_id IN SELECT unnest(p_ids) LOOP
      SELECT * INTO v_rec FROM public.cronograma_atividades WHERE id = v_id;
      IF NOT FOUND THEN CONTINUE; END IF;
      -- atualiza original com primeiro dia
      UPDATE public.cronograma_atividades SET dia_semana = p_replace_dias[1], updated_at = now() WHERE id = v_id;
      -- cria duplicatas para dias restantes
      IF array_length(p_replace_dias,1) > 1 THEN
        FOR i IN 2..array_length(p_replace_dias,1) LOOP
          INSERT INTO public.cronograma_atividades (unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade)
          VALUES (v_rec.unidade_id, v_rec.formulario_id, v_rec.responsavel_id, v_rec.titulo, v_rec.horario, p_replace_dias[i], v_rec.mensagem, v_rec.ativo, v_rec.turno, v_rec.tipo_atividade);
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- Adicionar dias: duplica registros originais para cada dia novo
  IF p_add_dias IS NOT NULL AND array_length(p_add_dias,1) IS NOT NULL THEN
    FOR v_id IN SELECT unnest(p_ids) LOOP
      SELECT * INTO v_rec FROM public.cronograma_atividades WHERE id = v_id;
      IF NOT FOUND THEN CONTINUE; END IF;
      FOREACH v_dia IN ARRAY p_add_dias LOOP
        IF v_dia = v_rec.dia_semana THEN CONTINUE; END IF;
        INSERT INTO public.cronograma_atividades (unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade)
        VALUES (v_rec.unidade_id, v_rec.formulario_id, v_rec.responsavel_id, v_rec.titulo, v_rec.horario, v_dia, v_rec.mensagem, v_rec.ativo, v_rec.turno, v_rec.tipo_atividade);
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('affected', v_affected, 'bulk_operation_id', v_bulk);
END;
$$;

-- 8. RPC histórico
CREATE OR REPLACE FUNCTION public.admin_list_cronograma_historico(p_limit int DEFAULT 200)
RETURNS TABLE(id uuid, atividade_id uuid, user_name text, campo text, valor_anterior text, valor_novo text, bulk_operation_id uuid, created_at timestamptz, atividade_titulo text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  RETURN QUERY
    SELECT h.id, h.atividade_id, h.user_name, h.campo, h.valor_anterior, h.valor_novo, h.bulk_operation_id, h.created_at, a.titulo
    FROM public.cronograma_atividades_historico h
    LEFT JOIN public.cronograma_atividades a ON a.id = h.atividade_id
    ORDER BY h.created_at DESC
    LIMIT p_limit;
END;
$$;
