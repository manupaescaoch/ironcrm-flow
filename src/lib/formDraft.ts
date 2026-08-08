import { useEffect, useRef } from 'react';

/**
 * Rascunho automático dos formulários públicos (encerramentos / relatório comercial).
 *
 * Motivo: as páginas públicas não guardavam nada. Se o celular perdia rede no envio,
 * ou o usuário recarregava a página, todo o preenchimento era perdido.
 *
 * Estratégia: salvar o estado do wizard em localStorage a cada mudança e restaurar
 * automaticamente na próxima abertura (validade de 24h). Limpar após o envio.
 */

const PREFIX = 'evo:form-draft:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface DraftEnvelope<T> {
  savedAt: number;
  step: number;
  stage: string;
  data: T;
}

export function readDraft<T>(key: string): DraftEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

function writeDraft<T>(key: string, envelope: DraftEnvelope<T>) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    /* noop — modo privado / quota cheia */
  }
}

interface UseFormDraftArgs<T> {
  key: string;
  data: T;
  step: number;
  stage: string;
  /** Restaura o rascunho encontrado na montagem. Retorne false para ignorar. */
  onRestore: (draft: DraftEnvelope<T>) => void;
  /** Quando false, para de salvar (ex.: já enviado). */
  enabled?: boolean;
}

export function useFormDraft<T>({ key, data, step, stage, onRestore, enabled = true }: UseFormDraftArgs<T>) {
  const restored = useRef(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = readDraft<T>(key);
    if (draft && (draft.stage === 'wizard' || draft.stage === 'review')) {
      onRestoreRef.current(draft);
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    if (stage !== 'wizard' && stage !== 'review') return;
    const t = setTimeout(() => {
      writeDraft(key, { savedAt: Date.now(), step, stage, data });
    }, 400);
    return () => clearTimeout(t);
  }, [key, data, step, stage, enabled]);
}

function isNetworkError(err: unknown): boolean {
  const msg = (
    err instanceof Error ? err.message : typeof err === 'string' ? err : (err as { message?: string })?.message || ''
  ).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset')
  );
}

/**
 * Executa uma operação de envio com reenvio automático em caso de falha de rede.
 * Erros de validação/permissão (não-rede) não são repetidos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function submitWithRetry<R extends { error: any }>(
  fn: () => PromiseLike<R>,
  opts: { attempts?: number; onRetry?: (attempt: number) => void } = {},
): Promise<R> {
  const attempts = opts.attempts ?? 3;
  let last = { error: null } as unknown as R;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fn();
      if (!res.error) return res;
      last = res;
      if (!isNetworkError(res.error) || i === attempts) return res;
    } catch (err) {
      last = { error: err } as unknown as R;
      if (!isNetworkError(err) || i === attempts) return last;
    }
    opts.onRetry?.(i);
    await new Promise((r) => setTimeout(r, 800 * i));
  }
  return last;
}
