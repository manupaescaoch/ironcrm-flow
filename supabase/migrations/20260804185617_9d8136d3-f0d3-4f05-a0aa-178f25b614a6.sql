ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS link_pagamento text;
ALTER TABLE public.contas_pagar ALTER COLUMN fornecedor DROP NOT NULL;
ALTER TABLE public.contas_pagar ALTER COLUMN categoria DROP NOT NULL;
ALTER TABLE public.contas_pagar ALTER COLUMN forma_pagamento DROP NOT NULL;