CREATE TABLE IF NOT EXISTS public.experimental_presenca_telegram (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interacao_id uuid NOT NULL REFERENCES public.interacoes(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  data_aula date NOT NULL,
  hora_aula text NOT NULL,
  telegram_chat_id bigint,
  telegram_message_id bigint,
  status text NOT NULL DEFAULT 'pendente',
  resultado text,
  origem_resposta text,
  respondido_por text,
  respondido_em timestamptz,
  enviado_em timestamptz,
  erro_msg text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_exp_presenca_slot
  ON public.experimental_presenca_telegram (interacao_id, data_aula, hora_aula);

CREATE INDEX IF NOT EXISTS ix_exp_presenca_status ON public.experimental_presenca_telegram (status);
CREATE INDEX IF NOT EXISTS ix_exp_presenca_lead ON public.experimental_presenca_telegram (lead_id);

ALTER TABLE public.experimental_presenca_telegram ENABLE ROW LEVEL SECURITY;

CREATE POLICY exp_presenca_select ON public.experimental_presenca_telegram
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  );

GRANT SELECT ON public.experimental_presenca_telegram TO authenticated;
GRANT ALL ON public.experimental_presenca_telegram TO service_role;

CREATE OR REPLACE FUNCTION public.notify_experimental_presenca_http()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net', 'pg_temp'
AS $$
BEGIN
  IF (NEW.compareceu IS DISTINCT FROM OLD.compareceu)
     OR (NEW.cancelado IS DISTINCT FROM OLD.cancelado)
     OR (NEW.data_experimental IS DISTINCT FROM OLD.data_experimental)
     OR (NEW.hora_experimental IS DISTINCT FROM OLD.hora_experimental) THEN
    PERFORM net.http_post(
      url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/presenca-experimental-telegram',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', public.get_cron_secret()
      ),
      body := jsonb_build_object('acao', 'sincronizar', 'interacao_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_experimental_presenca_http() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_experimental_presenca_http() TO service_role;

DROP TRIGGER IF EXISTS trg_notify_experimental_presenca ON public.interacoes;
CREATE TRIGGER trg_notify_experimental_presenca
  AFTER UPDATE ON public.interacoes
  FOR EACH ROW EXECUTE FUNCTION public.notify_experimental_presenca_http();