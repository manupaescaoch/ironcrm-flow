-- 1) Atendimentos individualizados nos novos formulários
ALTER TABLE public.encerramento_horario_respostas
  ADD COLUMN IF NOT EXISTS atendimentos_json jsonb;

-- 2) Parser de atendimentos em texto livre
CREATE OR REPLACE FUNCTION public.parse_atendimentos(p_text text)
RETURNS TABLE(treinador text, quantidade integer)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_line text;
  v_m text[];
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN;
  END IF;
  FOREACH v_line IN ARRAY regexp_split_to_array(p_text, E'\n') LOOP
    v_line := btrim(replace(replace(v_line, E'\r', ''), E'\t', ' '));
    CONTINUE WHEN v_line = '';
    v_m := regexp_match(v_line, '^([^0-9]{2,60}?)\s*[-–—:=]*\s*([0-9]{1,3})$');
    IF v_m IS NOT NULL THEN
      treinador := upper(btrim(regexp_replace(v_m[1], '[\s\-–—:=]+$', '')));
      quantidade := v_m[2]::int;
      IF treinador <> '' AND quantidade <= 200 THEN
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 3) View normalizada de atendimentos por treinador
CREATE OR REPLACE VIEW public.v_operacional_atendimentos
WITH (security_invoker = true) AS
WITH base AS (
  SELECT r.id AS formulario_id,
         r.data,
         r.unidade,
         r.turno,
         r.nome AS responsavel,
         r.atendimentos_por_treinador AS texto,
         r.atendimentos_json
  FROM public.encerramento_horario_respostas r
),
structured AS (
  SELECT b.formulario_id, b.data, b.unidade, b.turno, b.responsavel,
         upper(btrim(e->>'treinador')) AS treinador,
         NULLIF(e->>'quantidade','')::int AS quantidade,
         false AS pendente_revisao,
         'json'::text AS origem
  FROM base b
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.atendimentos_json, '[]'::jsonb)) e
  WHERE b.atendimentos_json IS NOT NULL
    AND jsonb_typeof(b.atendimentos_json) = 'array'
    AND btrim(COALESCE(e->>'treinador','')) <> ''
),
parsed AS (
  SELECT b.formulario_id, b.data, b.unidade, b.turno, b.responsavel,
         p.treinador, p.quantidade, false AS pendente_revisao, 'texto'::text AS origem
  FROM base b
  CROSS JOIN LATERAL public.parse_atendimentos(b.texto) p
  WHERE b.atendimentos_json IS NULL
),
unparsed AS (
  SELECT b.formulario_id, b.data, b.unidade, b.turno, b.responsavel,
         NULL::text AS treinador, NULL::int AS quantidade, true AS pendente_revisao, 'texto'::text AS origem
  FROM base b
  WHERE b.atendimentos_json IS NULL
    AND btrim(COALESCE(b.texto,'')) <> ''
    AND NOT EXISTS (SELECT 1 FROM public.parse_atendimentos(b.texto))
)
SELECT * FROM structured
UNION ALL SELECT * FROM parsed
UNION ALL SELECT * FROM unparsed;

GRANT SELECT ON public.v_operacional_atendimentos TO authenticated;

-- 4) Pendências / alertas operacionais
CREATE TABLE IF NOT EXISTS public.operacional_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tabela text NOT NULL,
  source_id uuid NOT NULL,
  unidade text NOT NULL,
  data date NOT NULL,
  turno text,
  registrado_por text,
  categoria text NOT NULL,
  descricao text,
  gravidade text,
  responsavel_solucao text,
  prazo date,
  status text NOT NULL DEFAULT 'pendente',
  solucao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operacional_pendencias_status_chk CHECK (status IN ('pendente','em_andamento','resolvido','vencido')),
  CONSTRAINT operacional_pendencias_unq UNIQUE (source_tabela, source_id, categoria)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacional_pendencias TO authenticated;
GRANT ALL ON public.operacional_pendencias TO service_role;

ALTER TABLE public.operacional_pendencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operacional_pendencias_select" ON public.operacional_pendencias;
CREATE POLICY "operacional_pendencias_select" ON public.operacional_pendencias
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'coordenador'::public.app_role));

DROP POLICY IF EXISTS "operacional_pendencias_write" ON public.operacional_pendencias;
CREATE POLICY "operacional_pendencias_write" ON public.operacional_pendencias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'coordenador'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'coordenador'::public.app_role));

DROP TRIGGER IF EXISTS trg_operacional_pendencias_updated ON public.operacional_pendencias;
CREATE TRIGGER trg_operacional_pendencias_updated
  BEFORE UPDATE ON public.operacional_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();