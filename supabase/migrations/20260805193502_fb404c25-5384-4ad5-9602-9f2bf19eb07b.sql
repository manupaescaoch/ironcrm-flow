-- 1. Tabela interna de configuração (segredos de automação)
CREATE TABLE IF NOT EXISTS public.app_config (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: nem anon nem authenticated acessam. Apenas service_role / SECURITY DEFINER.

CREATE TRIGGER trg_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_config (chave, valor)
VALUES ('cron_secret', 'de6822d5cfa000b8bb9f268bb229672f58ae05d7f6e36d350ca1a101a75e32b3')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();

-- 2. get_cron_secret passa a ler do cofre interno (sem valor hardcoded)
CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v text;
BEGIN
  SELECT valor INTO v FROM public.app_config WHERE chave = 'cron_secret';
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role;

-- 3. NPS: anti-flood por telefone (6h) dentro da RPC pública
CREATE OR REPLACE FUNCTION public.submit_nps_resposta(p_nome text, p_whatsapp text, p_unidade_nome text, p_nota_nps smallint, p_estrelas_estrutura smallint, p_estrelas_equipe smallint, p_estrelas_treino smallint, p_pontos_positivos text[], p_pontos_melhoria text[], p_tempo_aluno text, p_comentario text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id uuid;
  v_nome text := upper(btrim(coalesce(p_nome, '')));
  v_whatsapp text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_unidade text := upper(btrim(coalesce(p_unidade_nome, '')));
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
BEGIN
  IF length(v_nome) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF v_whatsapp !~ '^[0-9]{10,13}$' THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF v_unidade <> ALL (ARRAY['MADALENA', 'BOA VIAGEM', 'SETÚBAL']) THEN
    RAISE EXCEPTION 'Unidade inválida';
  END IF;
  IF p_nota_nps NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'Nota NPS inválida';
  END IF;
  IF p_estrelas_estrutura NOT BETWEEN 1 AND 5
     OR p_estrelas_equipe NOT BETWEEN 1 AND 5
     OR p_estrelas_treino NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Avaliação por estrelas inválida';
  END IF;
  IF coalesce(array_length(p_pontos_positivos, 1), 0) > 20
     OR coalesce(array_length(p_pontos_melhoria, 1), 0) > 20 THEN
    RAISE EXCEPTION 'Quantidade de opções inválida';
  END IF;
  IF p_tempo_aluno <> ALL (ARRAY['Menos de 1 mês', '1 a 3 meses', '3 a 6 meses', '6 meses a 1 ano', 'Mais de 1 ano']) THEN
    RAISE EXCEPTION 'Tempo de aluno inválido';
  END IF;
  IF v_comentario IS NOT NULL AND length(v_comentario) > 1000 THEN
    RAISE EXCEPTION 'Comentário muito longo';
  END IF;

  -- Anti-flood: mesmo número não grava outra avaliação em menos de 6 horas
  IF EXISTS (
    SELECT 1 FROM public.nps_respostas
    WHERE regexp_replace(coalesce(whatsapp, ''), '[^0-9]', '', 'g') = v_whatsapp
      AND created_at > now() - interval '6 hours'
  ) THEN
    RAISE EXCEPTION 'Já recebemos sua avaliação recentemente. Obrigado!';
  END IF;

  INSERT INTO public.nps_respostas (
    nome, whatsapp, unidade_nome, nota_nps,
    estrelas_estrutura, estrelas_equipe, estrelas_treino,
    pontos_positivos, pontos_melhoria, tempo_aluno, comentario
  ) VALUES (
    v_nome, v_whatsapp, v_unidade, p_nota_nps,
    p_estrelas_estrutura, p_estrelas_equipe, p_estrelas_treino,
    coalesce(p_pontos_positivos, '{}'::text[]),
    coalesce(p_pontos_melhoria, '{}'::text[]),
    p_tempo_aluno, v_comentario
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 4. Disparo da notificação de NPS pelo servidor (não mais pelo navegador)
CREATE OR REPLACE FUNCTION public.notify_nps_resposta_http()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net', 'pg_temp'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-nps-resposta',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_cron_secret()
    ),
    body := jsonb_build_object('id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_nps_resposta ON public.nps_respostas;
CREATE TRIGGER trg_notify_nps_resposta
  AFTER INSERT ON public.nps_respostas
  FOR EACH ROW EXECUTE FUNCTION public.notify_nps_resposta_http();

-- 5. Encerramento de turno público: limite de 3 envios por unidade/turno em 5 minutos
CREATE OR REPLACE FUNCTION public.limit_encerramento_turno_flood()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.encerramento_turno_respostas
  WHERE upper(btrim(unidade)) = upper(btrim(NEW.unidade))
    AND upper(btrim(turno)) = upper(btrim(NEW.turno))
    AND created_at > now() - interval '5 minutes';

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Muitos envios em sequência. Aguarde alguns minutos e tente novamente.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limit_encerramento_turno_flood ON public.encerramento_turno_respostas;
CREATE TRIGGER trg_limit_encerramento_turno_flood
  BEFORE INSERT ON public.encerramento_turno_respostas
  FOR EACH ROW EXECUTE FUNCTION public.limit_encerramento_turno_flood();

-- 6. Remove policy duplicada criada na tabela errada
DROP POLICY IF EXISTS select_formularios_anon ON public.formulario_campos;