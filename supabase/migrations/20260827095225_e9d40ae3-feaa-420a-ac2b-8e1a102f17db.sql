ALTER TABLE public.cronograma_atividades DROP CONSTRAINT cronograma_atividades_responsavel_id_fkey;
ALTER TABLE public.cronograma_atividades ADD CONSTRAINT cronograma_atividades_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.cronograma_funcionarios(id) ON DELETE SET NULL;

ALTER TABLE public.cronograma_envios DROP CONSTRAINT cronograma_envios_funcionario_id_fkey;
ALTER TABLE public.cronograma_envios ADD CONSTRAINT cronograma_envios_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.cronograma_funcionarios(id) ON DELETE CASCADE;