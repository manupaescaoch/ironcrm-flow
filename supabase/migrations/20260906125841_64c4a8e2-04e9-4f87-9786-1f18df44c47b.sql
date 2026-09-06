CREATE OR REPLACE FUNCTION public.encerramento_tecnico_existente(
  p_unidade_id uuid,
  p_coordenador text,
  p_data date
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.encerramento_tecnico_respostas
  WHERE unidade_id = p_unidade_id
    AND upper(btrim(coordenador_nome)) = upper(btrim(p_coordenador))
    AND data = p_data
  ORDER BY created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.encerramento_tecnico_arquivar(p_resposta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.encerramento_tecnico_respostas;
BEGIN
  SELECT * INTO v_row FROM public.encerramento_tecnico_respostas WHERE id = p_resposta_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO public.encerramento_tecnico_historico (resposta_id, unidade_id, snapshot, motivo)
  VALUES (p_resposta_id, v_row.unidade_id, to_jsonb(v_row), 'Substituído por novo envio do mesmo dia');
END;
$$;

REVOKE ALL ON FUNCTION public.encerramento_tecnico_existente(uuid, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.encerramento_tecnico_arquivar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encerramento_tecnico_existente(uuid, text, date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encerramento_tecnico_arquivar(uuid) TO anon, authenticated, service_role;