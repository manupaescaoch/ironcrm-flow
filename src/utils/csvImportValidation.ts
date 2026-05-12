import { z } from 'zod';

// Padrões maliciosos comuns (XSS / SQLi óbvio)
const MALICIOUS_PATTERNS: RegExp[] = [
  /<\s*script/i,
  /<\/\s*script/i,
  /javascript\s*:/i,
  /on(error|click|load|mouseover|focus|blur|change|submit)\s*=/i,
  /<\s*iframe/i,
  /<\s*object/i,
  /<\s*embed/i,
  /\bdrop\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\s+\w+\s+set\b/i,
  /\bunion\s+select\b/i,
  /\bxp_\w+/i,
  /(--\s)|(\/\*)|(\*\/)/,
  /'\s*or\s*'/i,
  /"\s*or\s*"/i,
  /\bor\s+1\s*=\s*1\b/i,
];

export const containsMalicious = (value: string): boolean =>
  MALICIOUS_PATTERNS.some((re) => re.test(value));

// Remove tags HTML, controls e normaliza espaços; corta no tamanho máximo
export const sanitizeText = (value: string, max: number): string =>
  value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const safeText = (max: number, label: string) =>
  z
    .string()
    .transform((v) => sanitizeText(v ?? '', max))
    .refine((v) => !containsMalicious(v), {
      message: `conteúdo inválido em ${label}`,
    });

const optionalSafeText = (max: number, label: string) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? sanitizeText(v, max) : ''))
    .refine((v) => !v || !containsMalicious(v), {
      message: `conteúdo inválido em ${label}`,
    });

const STATUS_VALIDOS = [
  'novo',
  'contato_inicial',
  'aula_agendada',
  'aula_realizada',
  'negociacao',
  'convertido',
  'perdido',
  'follow_up',
] as const;

export const csvLeadSchema = z
  .object({
    nome_completo: safeText(120, 'nome').refine((v) => v.length >= 2, {
      message: 'nome obrigatório (mínimo 2 caracteres)',
    }),
    telefone: optionalSafeText(40, 'telefone').transform((v) =>
      v ? v.replace(/\D/g, '') : ''
    ),
    email: optionalSafeText(254, 'e-mail').transform((v) =>
      v ? v.toLowerCase() : ''
    ),
    origem: optionalSafeText(80, 'origem'),
    atendido_por: optionalSafeText(120, 'atendido_por'),
    status_funil: optionalSafeText(50, 'status_funil').transform((v) =>
      v ? v.toLowerCase() : ''
    ),
    observacoes: optionalSafeText(500, 'observações'),
    data_cadastro: optionalSafeText(30, 'data_cadastro'),
  })
  .superRefine((row, ctx) => {
    // telefone: aceita 10–13 dígitos quando preenchido
    if (row.telefone && (row.telefone.length < 10 || row.telefone.length > 13)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['telefone'],
        message: 'telefone inválido',
      });
    }
    // e-mail: opcional; quando preenchido valida formato simples e único endereço
    if (row.email) {
      if (row.email.length > 254 || /\s/.test(row.email) || row.email.split('@').length !== 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'e-mail inválido' });
      } else if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(row.email)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'e-mail inválido' });
      }
    }
    if (row.status_funil && !STATUS_VALIDOS.includes(row.status_funil as typeof STATUS_VALIDOS[number])) {
      // não bloqueia — será normalizado para 'novo' depois
    }
  });

export type ValidatedCsvLead = z.infer<typeof csvLeadSchema>;

export interface CsvRowValidationResult {
  index: number; // linha do CSV (1-based, considerando header)
  valid: boolean;
  data?: ValidatedCsvLead;
  errors: string[];
  duplicate?: boolean;
}

export function validateCsvRow(
  raw: Record<string, string>,
  rowIndex: number
): CsvRowValidationResult {
  const parsed = csvLeadSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => i.message);
    return { index: rowIndex, valid: false, errors };
  }
  return { index: rowIndex, valid: true, data: parsed.data, errors: [] };
}
