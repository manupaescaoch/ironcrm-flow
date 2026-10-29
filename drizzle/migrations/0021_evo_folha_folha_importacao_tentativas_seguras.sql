CREATE TABLE public.folha_importacao_tentativas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 competencia text NOT NULL CHECK (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 usuario_id uuid NOT NULL,
 arquivo_path text NOT NULL UNIQUE,
 estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','processando','recusada','concluida','limpando','limpa')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.folha_importacao_tentativas TO authenticated;
GRANT ALL ON public.folha_importacao_tentativas TO service_role;
ALTER TABLE public.folha_importacao_tentativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_tentativa_sel ON public.folha_importacao_tentativas FOR SELECT TO authenticated USING (usuario_id=auth.uid() AND public.folha_pode(auth.uid(),unidade_id,'importar'));
CREATE OR REPLACE FUNCTION public.folha_validar_documento_competencia() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $$
BEGIN
 IF NEW.referencia_detectada IS NOT NULL AND NEW.referencia_detectada <> NEW.competencia THEN
  RAISE EXCEPTION 'Referência do documento diferente da competência';
 END IF;
 IF NEW.arquivo_path NOT LIKE NEW.unidade_id::text || '/' || NEW.competencia || '/%' OR position('..' in NEW.arquivo_path)>0 THEN
  RAISE EXCEPTION 'Arquivo fora da unidade/competência';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER folha_cc_validar_comp BEFORE INSERT ON public.folha_contracheques FOR EACH ROW EXECUTE FUNCTION public.folha_validar_documento_competencia();