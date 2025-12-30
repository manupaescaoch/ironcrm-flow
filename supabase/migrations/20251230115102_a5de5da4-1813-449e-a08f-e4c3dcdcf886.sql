
-- Desabilitar temporariamente o trigger de permissões
ALTER TABLE leads DISABLE TRIGGER trg_enforce_leads_update_permissions;

-- 1. Reativar os 7 leads com matrícula (ativo = true)
UPDATE leads
SET ativo = true, updated_at = now()
WHERE nome IN (
  'ARIADNE DE FARIAS CABRAL',
  'FERNANDO HENRIQUE PEREIRA FERNANDES',
  'GERALDO FILHO MARTINS DA SILVA FILHO',
  'GUSTAVO FERREIRA LEAL',
  'IRLA PAULA ANDRADE AMARAL',
  'LAIS DE ALMEIDA LEAL',
  'PEDRO HENRIQUE BATISTA TEÓFILO REIS'
);

-- 2. Corrigir status_funil para "convertido" nos 2 leads com status incorreto
UPDATE leads
SET status_funil = 'convertido', updated_at = now()
WHERE nome IN (
  'GUSTAVO FERREIRA LEAL',
  'PEDRO HENRIQUE BATISTA TEÓFILO REIS'
) AND status_funil != 'convertido';

-- Reabilitar o trigger
ALTER TABLE leads ENABLE TRIGGER trg_enforce_leads_update_permissions;
