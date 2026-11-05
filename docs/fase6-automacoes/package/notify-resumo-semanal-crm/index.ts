import { authorizeCronOnly, retiredAutomationResponse } from '../_shared/cronAuth.ts';
import { legacyManagerWhatsAppResult } from '../_shared/managerMessagingPolicy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Legacy WhatsApp-only manager notification retired. Telegram remains independent.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const auth = await authorizeCronOnly(req);
  if (!auth.ok) return retiredAutomationResponse(corsHeaders);
  return Response.json(legacyManagerWhatsAppResult(), { headers: corsHeaders });
});
