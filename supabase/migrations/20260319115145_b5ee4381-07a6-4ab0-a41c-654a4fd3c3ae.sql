
ALTER TABLE public.formularios ADD COLUMN setor text NOT NULL DEFAULT 'geral';
ALTER TABLE public.formularios ADD COLUMN turno text NOT NULL DEFAULT 'integral';
ALTER TABLE public.formularios ADD COLUMN whatsapp_grupo text;
