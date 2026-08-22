ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pausado_fu boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pausado_fu_em timestamptz,
  ADD COLUMN IF NOT EXISTS pausado_fu_por uuid;

CREATE OR REPLACE FUNCTION public.migrar_lead_unidade(
  p_lead_id uuid,
  p_unidade_destino uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads;
  v_origem uuid;
  v_dup uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  v_origem := v_lead.unidade_id;

  IF v_origem = p_unidade_destino THEN
    RAISE EXCEPTION 'O lead já pertence a esta unidade';
  END IF;

  IF NOT public.user_has_unidade_access(auth.uid(), p_unidade_destino) THEN
    RAISE EXCEPTION 'Sem acesso à unidade de destino';
  END IF;

  IF v_origem IS NOT NULL AND NOT public.user_has_unidade_access(auth.uid(), v_origem) THEN
    RAISE EXCEPTION 'Sem acesso à unidade de origem';
  END IF;

  IF v_lead.telefone IS NOT NULL AND length(public.canonical_phone(v_lead.telefone)) > 0 THEN
    SELECT id INTO v_dup
    FROM public.leads
    WHERE unidade_id = p_unidade_destino
      AND id <> p_lead_id
      AND telefone IS NOT NULL
      AND public.canonical_phone(telefone) = public.canonical_phone(v_lead.telefone)
    LIMIT 1;

    IF v_dup IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um lead com este telefone na unidade de destino';
    END IF;
  END IF;

  UPDATE public.leads
    SET unidade_id = p_unidade_destino,
        updated_at = now()
    WHERE id = p_lead_id;

  UPDATE public.interacoes SET unidade_id = p_unidade_destino WHERE lead_id = p_lead_id;
  UPDATE public.follow_ups SET unidade_id = p_unidade_destino WHERE lead_id = p_lead_id;

  BEGIN
    INSERT INTO public.interacoes (lead_id, tipo, descricao, data_interacao, created_by, unidade_id)
    VALUES (
      p_lead_id,
      'observacao',
      'Migração de unidade' || COALESCE(' — motivo: ' || p_motivo, '') ,
      now(),
      auth.uid(),
      p_unidade_destino
    );
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'unidade_origem', v_origem, 'unidade_destino', p_unidade_destino);
END;
$$;

REVOKE ALL ON FUNCTION public.migrar_lead_unidade(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrar_lead_unidade(uuid, uuid, text) TO authenticated;