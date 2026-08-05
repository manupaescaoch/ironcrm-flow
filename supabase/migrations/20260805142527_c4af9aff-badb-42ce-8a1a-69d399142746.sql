CREATE TABLE IF NOT EXISTS public.whatsapp_idempotencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  funcao text NOT NULL,
  destino text,
  canal text,
  status text NOT NULL DEFAULT 'claimed',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.whatsapp_idempotencia TO service_role;
GRANT SELECT ON public.whatsapp_idempotencia TO authenticated;

ALTER TABLE public.whatsapp_idempotencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_whatsapp_idempotencia" ON public.whatsapp_idempotencia;
CREATE POLICY "admins_read_whatsapp_idempotencia"
ON public.whatsapp_idempotencia FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_whatsapp_idempotencia_funcao_created
  ON public.whatsapp_idempotencia (funcao, created_at DESC);

DROP TRIGGER IF EXISTS trg_whatsapp_idempotencia_updated_at ON public.whatsapp_idempotencia;
CREATE TRIGGER trg_whatsapp_idempotencia_updated_at
BEFORE UPDATE ON public.whatsapp_idempotencia
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_whatsapp_envio(
  p_chave text,
  p_funcao text,
  p_destino text DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_ttl_minutes integer DEFAULT 43200
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  DELETE FROM public.whatsapp_idempotencia
  WHERE chave = p_chave AND expires_at < now();

  INSERT INTO public.whatsapp_idempotencia (chave, funcao, destino, canal, expires_at)
  VALUES (p_chave, p_funcao, p_destino, p_canal, now() + make_interval(mins => p_ttl_minutes))
  ON CONFLICT (chave) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_whatsapp_envio(p_chave text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.whatsapp_idempotencia WHERE chave = p_chave;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_envio(text, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_whatsapp_envio(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_envio(text, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_whatsapp_envio(text) TO service_role;