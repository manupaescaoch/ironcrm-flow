import { getZapiCreds, checkZapiStatus } from './supabase/functions/_shared/zapi.ts';

// Mock Deno.env for the script
const env = {
  ZAPI_COMERCIAL_INSTANCE_ID: Deno.env.get('ZAPI_COMERCIAL_INSTANCE_ID'),
  ZAPI_COMERCIAL_TOKEN: Deno.env.get('ZAPI_COMERCIAL_TOKEN'),
  ZAPI_COMERCIAL_CLIENT_TOKEN: Deno.env.get('ZAPI_COMERCIAL_CLIENT_TOKEN'),
  ZAPI_INSTANCE_ID: Deno.env.get('ZAPI_INSTANCE_ID'),
  ZAPI_TOKEN: Deno.env.get('ZAPI_TOKEN'),
};

const creds = {
  instanceId: env.ZAPI_COMERCIAL_INSTANCE_ID || env.ZAPI_INSTANCE_ID,
  token: env.ZAPI_COMERCIAL_TOKEN || env.ZAPI_TOKEN,
  clientToken: env.ZAPI_COMERCIAL_CLIENT_TOKEN || '',
  channel: 'comercial'
};

console.log('Checking Z-API for instance:', creds.instanceId);

const status = await checkZapiStatus(creds as any);
console.log('Status:', JSON.stringify(status, null, 2));
