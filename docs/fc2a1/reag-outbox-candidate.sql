-- Candidate only. Existing REAG endpoint/provider unchanged; no automatic provider retry.
CREATE TABLE public.experimental_reag_chamadas (
 ciclo_id uuid PRIMARY KEY REFERENCES public.experimental_ciclos(id),
 estado text NOT NULL DEFAULT 'pendente' CHECK(estado IN('pendente','reservado','concluido','incerto','suprimido')),
 reservado_em timestamptz,concluido_em timestamptz
);
GRANT ALL ON public.experimental_reag_chamadas TO service_role;
ALTER TABLE public.experimental_reag_chamadas ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.experimental_preparar_reag() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.resultado_novo='nao_compareceu' AND NEW.tipo IN('confirmado','corrigido') THEN
  INSERT INTO public.experimental_reag_chamadas(ciclo_id) VALUES(NEW.ciclo_id) ON CONFLICT DO NOTHING;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER experimental_preparar_reag AFTER INSERT ON public.experimental_ciclo_eventos FOR EACH ROW EXECUTE FUNCTION public.experimental_preparar_reag();
CREATE FUNCTION public.experimental_claim_reag(p_ciclo uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.experimental_ciclos;r public.experimental_reag_chamadas;i public.interacoes;l public.leads;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço obrigatório';END IF;
 SELECT * INTO c FROM public.experimental_ciclos WHERE id=p_ciclo;
 SELECT * INTO l FROM public.leads WHERE id=c.lead_id FOR UPDATE;
 SELECT * INTO i FROM public.interacoes WHERE id=c.interacao_id FOR UPDATE;
 SELECT * INTO c FROM public.experimental_ciclos WHERE id=p_ciclo FOR UPDATE;
 SELECT * INTO r FROM public.experimental_reag_chamadas WHERE ciclo_id=p_ciclo FOR UPDATE;
 IF NOT FOUND OR r.estado<>'pendente' THEN RETURN jsonb_build_object('claimed',false);END IF;
 IF c.situacao<>'ativo' OR c.resultado<>'nao_compareceu' OR i.experimental_ciclo_atual_id IS DISTINCT FROM c.id OR i.cancelado
 OR l.unidade_id IS DISTINCT FROM c.unidade_id OR l.ativo IS DISTINCT FROM true OR l.is_matriculado OR l.status_funil IN('convertido','perdido')
 OR (c.data_aula+c.hora_aula) AT TIME ZONE 'America/Recife'>now()
 OR (l.data_aula_experimental AT TIME ZONE 'America/Recife')::date IS DISTINCT FROM c.data_aula OR l.hora_aula_experimental IS DISTINCT FROM c.hora_aula THEN
  UPDATE public.experimental_reag_chamadas SET estado='suprimido' WHERE ciclo_id=c.id;
  RETURN jsonb_build_object('claimed',false,'suppressed',true);
 END IF;
 UPDATE public.experimental_reag_chamadas SET estado='reservado',reservado_em=now() WHERE ciclo_id=c.id;
 RETURN jsonb_build_object('claimed',true,'ciclo_id',c.id,'lead_id',c.lead_id,'interacao_id',c.interacao_id);
END $$;
CREATE FUNCTION public.experimental_finish_reag(p_ciclo uuid,p_ok boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço obrigatório';END IF;
 UPDATE public.experimental_reag_chamadas SET estado=CASE WHEN p_ok THEN 'concluido' ELSE 'incerto' END,concluido_em=now() WHERE ciclo_id=p_ciclo AND estado='reservado';
END $$;
REVOKE ALL ON FUNCTION public.experimental_claim_reag(uuid),public.experimental_finish_reag(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.experimental_claim_reag(uuid),public.experimental_finish_reag(uuid,boolean) TO service_role;