-- Normaliza sufixo de IDs de grupo WhatsApp (Z-API exige '-group' minúsculo).
UPDATE public.unidade_whatsapp_config
SET grupo_anamnese_id = regexp_replace(grupo_anamnese_id, '-GROUP$', '-group'),
    updated_at = now()
WHERE grupo_anamnese_id LIKE '%-GROUP';

UPDATE public.unidade_whatsapp_config
SET grupo_fu_id = regexp_replace(grupo_fu_id, '-GROUP$', '-group'),
    updated_at = now()
WHERE grupo_fu_id LIKE '%-GROUP';