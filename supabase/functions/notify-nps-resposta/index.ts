import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getZapiCreds,
  checkZapiStatus,
  phoneExists,
  sendText,
  sleep,
  logEnvio,
  RATE_LIMIT_MS,
} from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESPONSAVEIS: Record<string, { nome: string; phone: string }> = {
  MADALENA: { nome: 'Gabriela Lima', phone: '5581991642282' },
  'BOA VIAGEM': { nome: 'Marcelo Santana', phone: '5581994145218' },
};

function classificar(nota: number): 'Detrator' | 'Passivo' | 'Promotor' {
  if (nota <= 6) return 'Detrator';
  if (nota <= 8) return 'Passivo';
  return 'Promotor';
}

function mensagemAluno(classificacao: string, nome: string, nota: number): string {
  const primeiroNome = (nome || '').split(' ')[0] || nome;
  if (classificacao === 'Detrator') {
    return `Oi, ${primeiroNome}. Vi sua avaliação e quero entender o que aconteceu. Você tem 5 minutos pra conversar?`;
  }
  if (classificacao === 'Passivo') {
    return `Oi, ${primeiroNome}, valeu pelo feedback! Vi que você deu ${nota} pra Iron. O que faltou pra ser um 10? Me conta aqui.`;
  }
  return `Oi, ${primeiroNome}, que bom ouvir isso! Fico feliz que você tá curtindo a Iron. Se você conhece alguém que se encaixaria aqui, me manda o contato. Tenho um presente pra você.`;
}

function formatPhoneBR(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return raw;
  return d.startsWith('55') ? d : `55${d}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { id } = await req.json();
    if (!id) {
      return new Response(JSON.stringify({ error: 'id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: resp, error } = await supabase
      .from('nps_respostas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !resp) {
      return new Response(JSON.stringify({ error: 'resposta não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creds = getZapiCreds('comercial');
    if (!creds) {
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        sucesso: false,
        motivo_skip: 'credenciais-comercial-ausentes',
        canal: 'comercial',
      });
      return new Response(JSON.stringify({ ok: false, reason: 'no-creds' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const status = await checkZapiStatus(creds);
    if (!status.connected) {
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        sucesso: false,
        motivo_skip: 'chip-desconectado',
        canal: 'comercial',
      });
      return new Response(JSON.stringify({ ok: false, reason: 'chip-off' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nota = Number(resp.nota_nps);
    const classificacao = classificar(nota);
    const unidadeKey = (resp.unidade_nome || '').toUpperCase().trim();
    const responsavel = RESPONSAVEIS[unidadeKey];
    const alunoPhone = formatPhoneBR(resp.whatsapp || '');
    const comentario = (resp.comentario || '').trim();

    // Resolve unidade_id a partir do unidade_nome (matches "Iron Madalena" etc.)
    let unidadeId: string | null = null;
    if (resp.unidade_nome) {
      const { data: u } = await supabase
        .from('unidades')
        .select('id')
        .ilike('nome', `%${resp.unidade_nome}%`)
        .maybeSingle();
      unidadeId = u?.id ?? null;
    }

    const log: Record<string, any> = {
      resposta_id: resp.id,
      unidade_id: unidadeId,
      unidade_nome: resp.unidade_nome,
      nota_nps: nota,
      classificacao: classificacao.toLowerCase(),
      responsavel_nome: responsavel?.nome ?? null,
      responsavel_telefone: responsavel?.phone ?? null,
      aluno_telefone: alunoPhone,
    };

    // 1) Interno ao responsável
    if (responsavel) {
      const msgInterna =
        `🟦 *Nova resposta NPS — Iron*\n\n` +
        `*Nome do aluno:* ${resp.nome}\n` +
        `*Telefone do aluno:* ${alunoPhone}\n` +
        `*Nota NPS:* ${nota}\n` +
        `*Mensagem do aluno:* ${comentario || '—'}\n` +
        `*Classificação:* ${classificacao}`;

      const r = await sendText(creds, responsavel.phone, msgInterna);
      log.interna_status = r.ok ? 'enviado' : 'erro';
      log.interna_message_id = (r.body as any)?.messageId ?? (r.body as any)?.zaapId ?? null;
      log.interna_erro = r.ok ? null : JSON.stringify(r.body).slice(0, 500);
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        destino: responsavel.phone,
        tipo_destino: 'interno',
        sucesso: r.ok,
        zapi_status_code: r.status,
        erro_msg: r.ok ? null : JSON.stringify(r.body).slice(0, 500),
        canal: 'comercial',
      });
    } else {
      log.interna_status = 'skip';
      log.interna_erro = `unidade-sem-responsavel:${unidadeKey}`;
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        tipo_destino: 'interno',
        sucesso: false,
        motivo_skip: `unidade-sem-responsavel:${unidadeKey}`,
        canal: 'comercial',
      });
    }

    // 2) Mensagem ao aluno
    await sleep(RATE_LIMIT_MS);

    const exists = await phoneExists(creds, alunoPhone);
    if (exists === false) {
      log.aluno_status = 'skip';
      log.aluno_erro = 'phone-not-on-whatsapp';
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        destino: alunoPhone,
        tipo_destino: 'lead',
        sucesso: false,
        motivo_skip: 'phone-not-on-whatsapp',
        canal: 'comercial',
      });
    } else {
      const msgAluno = mensagemAluno(classificacao, resp.nome, nota);
      const r = await sendText(creds, alunoPhone, msgAluno);
      log.aluno_status = r.ok ? 'enviado' : 'erro';
      log.aluno_message_id = (r.body as any)?.messageId ?? (r.body as any)?.zaapId ?? null;
      log.aluno_erro = r.ok ? null : JSON.stringify(r.body).slice(0, 500);
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        destino: alunoPhone,
        tipo_destino: 'lead',
        sucesso: r.ok,
        zapi_status_code: r.status,
        erro_msg: r.ok ? null : JSON.stringify(r.body).slice(0, 500),
        canal: 'comercial',
      });
    }

    await supabase.from('nps_notificacoes_log').insert(log);

    return new Response(JSON.stringify({ ok: true, classificacao }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('[notify-nps-resposta] erro', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
