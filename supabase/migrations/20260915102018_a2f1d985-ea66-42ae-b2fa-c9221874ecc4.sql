INSERT INTO public.telegram_groups (group_type, name, unidade_id, telegram_chat_id, telegram_title, status, connected_at)
SELECT 'contas_pagar', 'Contas a Pagar', NULL, -5192305488, 'CONTAS A PAGAR | EVO', 'conectado', now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.telegram_groups WHERE group_type = 'contas_pagar' AND unidade_id IS NULL
);