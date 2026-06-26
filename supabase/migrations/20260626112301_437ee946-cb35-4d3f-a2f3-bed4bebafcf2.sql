
-- 1) Add unidade_id column
ALTER TABLE public.nps_respostas
  ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);

CREATE INDEX IF NOT EXISTS idx_nps_respostas_unidade_id ON public.nps_respostas(unidade_id);

-- 2) Backfill from unidade_nome (mapping MADALENA/BOA VIAGEM/SETÚBAL -> Iron *)
UPDATE public.nps_respostas n
SET unidade_id = u.id
FROM public.unidades u
WHERE n.unidade_id IS NULL
  AND (
    upper(btrim(u.nome)) = upper(btrim(n.unidade_nome))
    OR upper(btrim(regexp_replace(u.nome, '^[Ii]ron\s+', ''))) = upper(btrim(n.unidade_nome))
  );

-- 3) Trigger to auto-resolve unidade_id from unidade_nome on insert (keeps public form working)
CREATE OR REPLACE FUNCTION public.set_nps_unidade_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.unidade_id IS NULL AND NEW.unidade_nome IS NOT NULL THEN
    SELECT id INTO NEW.unidade_id
    FROM public.unidades
    WHERE upper(btrim(nome)) = upper(btrim(NEW.unidade_nome))
       OR upper(btrim(regexp_replace(nome, '^[Ii]ron\s+', ''))) = upper(btrim(NEW.unidade_nome))
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_nps_unidade_id ON public.nps_respostas;
CREATE TRIGGER trg_set_nps_unidade_id
  BEFORE INSERT ON public.nps_respostas
  FOR EACH ROW EXECUTE FUNCTION public.set_nps_unidade_id();

-- 4) Replace SELECT policy: scope coordenador by unidade; admin global
DROP POLICY IF EXISTS "Admin e coordenador podem ver respostas NPS" ON public.nps_respostas;

CREATE POLICY "select_nps_respostas_by_unidade"
  ON public.nps_respostas
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'coordenador'::public.app_role)
      AND unidade_id IS NOT NULL
      AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  );

-- 5) Ensure no UPDATE/DELETE for anon/authenticated (admin uses service role / explicit policy if needed)
REVOKE UPDATE, DELETE ON public.nps_respostas FROM anon, authenticated;
