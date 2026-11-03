import { z } from 'npm:zod@3';

// Contrato do corpo aceito pela função. O agendamento (pg_cron) envia `time`;
// o campo é aceito e ignorado. Campos desconhecidos continuam rejeitados (strict).
export const boasVindasBodySchema = z.object({
  dry_run: z.boolean().optional(),
  task_id: z.string().uuid().optional(),
  time: z.string().optional(),
}).strict();
