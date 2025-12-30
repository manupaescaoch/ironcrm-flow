
-- Desabilitar temporariamente o trigger de permissões
ALTER TABLE leads DISABLE TRIGGER trg_enforce_leads_update_permissions;

-- Reativar os 5 leads inativos com matrícula
UPDATE leads
SET ativo = true, updated_at = now()
WHERE nome IN (
  'ANAMELIA NOVAES DE SOUZA MENEZES',
  'GERALDO MARTINS DA SILVA',
  'KLEDSON ALMEIDA SILVA',
  'LUCAS MENDES CARBONERA',
  'PEDRO ADVINCULA FALCÃO FILHO'
);

-- Reabilitar o trigger
ALTER TABLE leads ENABLE TRIGGER trg_enforce_leads_update_permissions;
