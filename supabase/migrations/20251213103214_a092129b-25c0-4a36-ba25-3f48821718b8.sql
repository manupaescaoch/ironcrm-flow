-- Add ticket_medio column to relatorio_gerencial_zn
ALTER TABLE public.relatorio_gerencial_zn
ADD COLUMN ticket_medio NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (ticket_medio >= 0);