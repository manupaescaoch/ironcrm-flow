import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getZapiCreds,
  checkZapiStatus,
  buildIdempotencyKey,
  sendTextIdempotent,
  logEnvio,
} from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Coordenador de cada unidade — TODA notificação de NPS vai para ele (nunca para o aluno)
const RESPONSAVEIS: Record<string, { nome: string; phone: string }> = {
  MADALENA: { nome: 'Gabriela Lima', phone: '5581991642282' },
  'BOA VIAGEM': { nome: 'Marcelo Santana', phone: '5581994145218' },
};

// Grupo da unidade no WhatsApp — recebe a mesma resposta (sem ação sugerida).
// Z-API envia para grupo pelo mesmo endpoint de texto, trocando o "phone" pelo
// ID do grupo no formato `<id>-group` (o `@g.us` do link não é aceito).
const GRUPOS: Record<string, string> = {
  MADALENA: '120363425937067624-group',
  'BOA VIAGEM': '120363405337702455-group',
};

function findCoordenador(unidadeNome: string) {
  const key = (unidadeNome || '').toUpperCase().trim();
  for (const [k, v] of Object.entries(RESPONSAVEIS)) {
    if (key.includes(k)) return v;
  }
  return null;
}

function findGrupo(unidadeNome: string): string | null {
  const key = (unidadeNome || '').toUpperCase().trim();
  for (const [k, v] of Object.entries(GRUPOS)) {
    if (key.includes(k)) return v;
  }
  return null;
}

function acaoSugerida(classificacao: string): string {
  if (classificacao === 'Detrator') {
    return '⚠️ *Ação:* entre em contato com o aluno o quanto antes para entender o que aconteceu.';
  }
  if (classificacao === 'Passivo') {
    return '🟡 *Ação:* fale com o aluno e descubra o que faltou para ser nota 10.';
  }
  return '🟢 *Ação:* aluno promotor — considere agradecer e pedir uma indicação.';
}

function classificar(nota: number): 'Detrator' | 'Passivo' | 'Promotor' {
  if (nota <= 6) return 'Detrator';
  if (nota <= 8) return 'Passivo';
  return 'Promotor';
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
    const responsavel = findCoordenador(resp.unidade_nome || '');
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

    // Conteúdo base (reaproveitado no grupo, sem a ação sugerida)
    const msgBase =
      `🟦 *Nova resposta NPS — EVO TRAINING CLUB*\n\n` +
      `*Unidade:* ${resp.unidade_nome || '—'}\n` +
      `*Aluno:* ${resp.nome}\n` +
      `*Contato:* ${alunoPhone}\n` +
      `*Nota NPS:* ${nota} (${classificacao})\n` +
      `*Comentário:* ${comentario || '—'}`;

    // 1) Interno ao responsável
    if (responsavel) {
      const msgInterna =
        msgBase + `\n\n` +
        acaoSugerida(classificacao) +
        `\n\n💬 *Falar com o aluno:* https://wa.me/${alunoPhone}`;

      const chaveInterna = buildIdempotencyKey(['notify-nps-resposta', resp.id, 'interno', responsavel.phone]);
      const r = await sendTextIdempotent(supabase, creds, responsavel.phone, msgInterna, { chave: chaveInterna, funcao: 'notify-nps-resposta' });
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

    // 2) Grupo da unidade (mesmo endpoint de texto do Z-API, "phone" = ID do grupo)
    const grupoId = findGrupo(resp.unidade_nome || '');
    if (grupoId) {
      const chaveGrupo = buildIdempotencyKey(['notify-nps-resposta', resp.id, 'grupo', grupoId]);
      const rg = await sendTextIdempotent(supabase, creds, grupoId, msgBase, { chave: chaveGrupo, funcao: 'notify-nps-resposta' });
      log.payload = {
        grupo_id: grupoId,
        grupo_status: rg.skipped ? 'duplicado' : rg.ok ? 'enviado' : 'erro',
        grupo_message_id: (rg.body as any)?.messageId ?? (rg.body as any)?.zaapId ?? null,
        grupo_erro: rg.ok ? null : JSON.stringify(rg.body).slice(0, 500),
      };
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        destino: grupoId,
        tipo_destino: 'grupo',
        sucesso: rg.ok,
        zapi_status_code: rg.status,
        erro_msg: rg.ok ? null : JSON.stringify(rg.body).slice(0, 500),
        canal: 'comercial',
        resposta_completa: rg.body,
      });
    } else {
      log.payload = { grupo_status: 'skip', grupo_erro: `unidade-sem-grupo:${unidadeKey}` };
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        tipo_destino: 'grupo',
        sucesso: false,
        motivo_skip: `unidade-sem-grupo:${unidadeKey}`,
        canal: 'comercial',
      });
    }

    // Fluxo NPS: NENHUMA mensagem vai direto para o aluno.
    // Toda resposta é encaminhada ao coordenador e ao grupo da unidade.
    log.aluno_status = 'skip';
    log.aluno_erro = 'fluxo-coordenador-apenas';

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
