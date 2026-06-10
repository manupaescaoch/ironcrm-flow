
ALTER TABLE public.follow_ups DROP CONSTRAINT IF EXISTS follow_ups_tipo_check;
ALTER TABLE public.follow_ups ADD CONSTRAINT follow_ups_tipo_check
  CHECK (tipo IN ('D+1','D+7','D+15','D+30','M+7','M+30'));

WITH matriculas_recentes AS (
  SELECT DISTINCT ON (i.lead_id)
    i.lead_id,
    i.unidade_id,
    i.data_interacao::date AS data_matricula
  FROM public.interacoes i
  JOIN public.leads l ON l.id = i.lead_id
  WHERE i.fechou_matricula = true
    AND i.data_interacao::date >= CURRENT_DATE - INTERVAL '30 days'
    AND l.ativo = true
    AND l.is_matriculado = true
  ORDER BY i.lead_id, i.data_interacao ASC
)
INSERT INTO public.follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
SELECT mr.lead_id, mr.unidade_id, t.tipo, mr.data_matricula,
       mr.data_matricula + (CASE t.tipo WHEN 'M+7' THEN 7 ELSE 30 END) * INTERVAL '1 day',
       'pendente'
FROM matriculas_recentes mr
CROSS JOIN (VALUES ('M+7'), ('M+30')) AS t(tipo)
ON CONFLICT (lead_id, tipo) DO NOTHING;
