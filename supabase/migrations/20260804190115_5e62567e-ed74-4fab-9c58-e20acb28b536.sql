GRANT SELECT, INSERT, UPDATE ON public.contas_pagar TO authenticated;
GRANT ALL ON public.contas_pagar TO service_role;

GRANT SELECT, INSERT ON public.contas_pagar_historico TO authenticated;
GRANT ALL ON public.contas_pagar_historico TO service_role;

GRANT SELECT ON public.contas_pagar_envios TO authenticated;
GRANT ALL ON public.contas_pagar_envios TO service_role;

GRANT SELECT ON public.unidade_whatsapp_config TO authenticated;
GRANT ALL ON public.unidade_whatsapp_config TO service_role;