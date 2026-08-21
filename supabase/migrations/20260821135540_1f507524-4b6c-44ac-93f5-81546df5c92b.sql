CREATE OR REPLACE FUNCTION public.get_cronograma_funcionarios_full(p_unidade_id uuid)
 RETURNS SETOF cronograma_funcionarios
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pode_ver_telefone boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.user_has_unidade_access(auth.uid(), p_unidade_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  v_pode_ver_telefone := public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'coordenador'::public.app_role);

  RETURN QUERY
    SELECT f.id, f.unidade_id, f.nome,
           CASE WHEN v_pode_ver_telefone THEN f.telefone ELSE NULL END AS telefone,
           f.setor, f.turno, f.ativo, f.created_at, f.updated_at, f.cargo
    FROM public.cronograma_funcionarios f
    WHERE f.unidade_id = p_unidade_id
    ORDER BY f.nome;
END;
$function$;