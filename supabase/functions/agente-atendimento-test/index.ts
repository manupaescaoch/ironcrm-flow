import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify role admin or comercial (user)
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const role = roleRow?.role;
    if (role !== 'admin' && role !== 'user') {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { prompt, mensagem_inicial, mensagem, historico } = body ?? {};

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reforco =
      '\n\nINSTRUÇÕES DE FORMATAÇÃO (OBRIGATÓRIAS, NÃO IGNORE):\n' +
      '- Siga EXATAMENTE a formatação, tom, emojis, quebras de linha e estrutura definidos acima.\n' +
      '- Você responde via WhatsApp: use *texto* para negrito (UM asterisco), nunca **texto** nem markdown de cabeçalho (#).\n' +
      '- Use _texto_ para itálico e ~texto~ para tachado, padrão WhatsApp.\n' +
      '- Mantenha mensagens curtas, divididas em blocos com quebras de linha quando o prompt pedir.\n' +
      '- Use os emojis especificados no prompt nos locais indicados.\n' +
      '- Não invente informações fora do escopo do prompt.';

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: prompt + reforco },
    ];

    if (Array.isArray(historico) && historico.length > 0) {
      // Conversa completa do chat de teste
      if (mensagem_inicial) {
        messages.push({ role: 'assistant', content: mensagem_inicial });
      }
      for (const m of historico) {
        if (m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')) {
          messages.push({ role: m.role, content: m.content });
        }
      }
    } else {
      if (!mensagem || typeof mensagem !== 'string') {
        return new Response(JSON.stringify({ error: 'Mensagem é obrigatória' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (mensagem_inicial) {
        messages.push({ role: 'assistant', content: mensagem_inicial });
      }
      messages.push({ role: 'user', content: mensagem });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        temperature: 0.4,
        messages,
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos no workspace.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(JSON.stringify({ error: 'Falha ao gerar resposta', detalhe: txt }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResp.json();
    const resposta = data?.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ resposta }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
