Deno.serve(async () => {
  const key = Deno.env.get('ALUNOS_API_KEY') ?? '';
  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1/alunos-api`;
  const t0 = Date.now();
  const r1 = await fetch(`${base}?limit=3&incluir_anamnese=true`, { headers: { 'x-api-key': key } });
  const b1 = await r1.json();
  const t1 = Date.now();
  const r2 = await fetch(`${base}?limit=1000&incluir_nao_matriculados=true&incluir_anamnese=true`, {
    headers: { 'x-api-key': key },
  });
  const b2 = await r2.json();
  const t2 = Date.now();
  return new Response(
    JSON.stringify({
      matriculados: { status: r1.status, ms: t1 - t0, total: b1.total, amostra: b1.alunos?.slice(0, 3) },
      todos: {
        status: r2.status,
        ms: t2 - t1,
        total: b2.total,
        com_anamnese: (b2.alunos ?? []).filter((a: { anamnese: unknown }) => a.anamnese).length,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
