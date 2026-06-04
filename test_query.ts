import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);

const { data, error } = await supabase
  .from('leads')
  .select('id, status_funil')
  .not('status_funil', 'in', '(convertido,perdido)')
  .limit(5);

console.log('Result:', data?.length, 'Error:', error?.message);

const { data: data2, error: error2 } = await supabase
  .from('leads')
  .select('id, status_funil')
  .not('status_funil', 'in', ['convertido', 'perdido'])
  .limit(5);

console.log('Result 2:', data2?.length, 'Error 2:', error2?.message);
