import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const email = 'gabi_lima14@hotmail.com';
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) return new Response(JSON.stringify({ error: listErr.message }), { status: 500 });

  const user = list.users.find(u => (u.email || '').toLowerCase() === email);
  if (!user) return new Response(JSON.stringify({ error: 'user not found' }), { status: 404 });

  const { error } = await supabase.auth.admin.updateUserById(user.id, { password: 'gabi1707' });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true, id: user.id }), { headers: { 'Content-Type': 'application/json' } });
});
