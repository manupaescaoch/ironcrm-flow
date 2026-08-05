// CORS restrito para funções chamadas pelo painel (admin/frontend autenticado).
// Webhooks e formulários públicos continuam com CORS aberto por necessidade.

const ALLOWED_EXACT = new Set([
  'https://ironcrm-flow.lovable.app',
  'https://www.ironclub-app.com',
  'https://ironclub-app.com',
  'http://localhost:8080',
  'http://localhost:5173',
]);

function isAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_EXACT.has(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    // Previews do projeto no Lovable
    return protocol === 'https:' && (hostname.endsWith('.lovable.app') || hostname.endsWith('.lovableproject.com'));
  } catch {
    return false;
  }
}

/** Headers de CORS restritos à origem da requisição, quando permitida. */
export function adminCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': isAllowed(origin) ? origin : 'https://ironcrm-flow.lovable.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  };
}
