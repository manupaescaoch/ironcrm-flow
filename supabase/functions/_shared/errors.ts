// Shared safe error helpers for Edge Functions.
// Goal: never leak internal details (SQL, table names, stack traces, error.message)
// to clients. Always log technical detail server-side with a correlation id and
// return a generic, user-friendly message to the caller.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GENERIC_MESSAGES: Record<number, string> = {
  400: 'Dados inválidos. Verifique as informações enviadas.',
  401: 'Não autenticado.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'Registro não encontrado.',
  409: 'Não foi possível concluir a operação devido a um conflito.',
  429: 'Muitas tentativas. Tente novamente mais tarde.',
  500: 'Erro interno ao processar a solicitação.',
};

export function newCorrelationId(): string {
  try {
    // crypto.randomUUID is available in Deno
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

export interface SafeErrorOptions {
  status: number;
  /** Internal-only context for logs (function name, step, user id, etc.). NEVER include secrets. */
  context?: Record<string, unknown>;
  /** Original error to log internally. Never returned to client. */
  internalError?: unknown;
  /** Optional override for the user-facing message (must be generic). */
  publicMessage?: string;
  /** Existing correlation id (when chaining). A new one is generated otherwise. */
  correlationId?: string;
}

/**
 * Build a Response with a generic message and a correlation id.
 * Logs the technical detail server-side via console.error.
 */
export function safeErrorResponse(opts: SafeErrorOptions): Response {
  const status = opts.status || 500;
  const correlationId = opts.correlationId ?? newCorrelationId();
  const publicMessage = opts.publicMessage ?? GENERIC_MESSAGES[status] ?? GENERIC_MESSAGES[500];

  // Server-side log only — never returned to the client.
  try {
    const errPayload = opts.internalError instanceof Error
      ? { name: opts.internalError.name, message: opts.internalError.message }
      : opts.internalError;
    console.error('[edge-error]', JSON.stringify({
      correlationId,
      status,
      context: opts.context ?? null,
      error: errPayload ?? null,
    }));
  } catch {
    console.error('[edge-error]', correlationId, status);
  }

  return new Response(
    JSON.stringify({ error: publicMessage, correlation_id: correlationId }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/** Convenience for unhandled exceptions in catch blocks. */
export function handleUnexpected(error: unknown, context?: Record<string, unknown>): Response {
  return safeErrorResponse({ status: 500, internalError: error, context });
}
