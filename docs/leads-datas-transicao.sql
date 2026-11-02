CREATE FUNCTION public.leads_carimbar_datas_funil() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.convertido_em_aluno_at IS NULL AND (
  (NEW.status_funil='convertido' AND OLD.status_funil IS DISTINCT FROM 'convertido')
  OR (NEW.is_matriculado=true AND OLD.is_matriculado IS DISTINCT FROM true)
 ) THEN NEW.convertido_em_aluno_at:=now(); END IF;
 IF NEW.data_perda IS NULL AND NEW.status_funil='perdido' AND OLD.status_funil IS DISTINCT FROM 'perdido' THEN
  NEW.data_perda:=((now() AT TIME ZONE 'America/Recife')::date)::timestamp AT TIME ZONE 'America/Recife';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.leads_carimbar_datas_funil() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzz_leads_carimbar_datas_funil BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.leads_carimbar_datas_funil();