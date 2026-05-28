DELETE FROM public.cronograma_envios
WHERE atividade_id IN (
  'd9377dfb-2f96-4e0e-aa53-e23f1b6df76e',
  'c03926e5-7c1a-4655-9821-876fdb5fe743',
  '8a4ddb5d-47d2-4e21-8741-0c2c8152d19d',
  'a0166247-ff28-4952-bd45-3b2a06ef4172',
  'b1f95bef-e223-46ec-924f-522b52413a7e'
)
AND created_at >= '2026-05-28 13:50:00+00'
AND created_at <= '2026-05-28 14:10:00+00';