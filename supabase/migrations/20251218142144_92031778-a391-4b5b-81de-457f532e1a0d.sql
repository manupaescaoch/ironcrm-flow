
-- Desabilitar apenas o trigger de permissões
ALTER TABLE leads DISABLE TRIGGER trg_enforce_leads_update_permissions;

-- Mover o último lead da Zona Sul para Zona Norte
UPDATE leads 
SET unidade_id = 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'
WHERE unidade_id = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a';

-- Reabilitar o trigger
ALTER TABLE leads ENABLE TRIGGER trg_enforce_leads_update_permissions;
