import { z } from 'npm:zod@3.23.8';

// Contrato do corpo aceito pela função. O agendamento diário (pg_cron) envia
// `triggered_at` e o agendamento de recuperação envia `auto_retry`; ambos são
// aceitos e ignorados. Campos desconhecidos continuam rejeitados (strict).
export const followUpBodySchema = z.object({
  unidade_id: z.string().uuid().nullish(),
  dry_run: z.boolean().optional(),
  force: z.boolean().optional(),
  manual: z.boolean().optional(),
  min_delay_ms: z.number().optional(),
  max_delay_ms: z.number().optional(),
  auto_retry: z.boolean().optional(),
  triggered_at: z.string().optional(),
}).strict();
