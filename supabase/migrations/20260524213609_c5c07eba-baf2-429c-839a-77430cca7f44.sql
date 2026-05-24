
ALTER TABLE public.agentes_atendimento
ADD COLUMN IF NOT EXISTS gatilho_ativacao text DEFAULT 'Olá! Tenho interesse e queria mais informações, por favor.';

UPDATE public.agentes_atendimento
SET gatilho_ativacao = 'Olá! Tenho interesse e queria mais informações, por favor.'
WHERE gatilho_ativacao IS NULL;
