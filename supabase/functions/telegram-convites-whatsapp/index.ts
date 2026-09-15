// Envia por WhatsApp (chip D-API MANU) o link exclusivo de conexão ao bot do Telegram
// para cada colaborador. Envios espaçados em 45 segundos, encadeando invocações
// desta própria função (uma mensagem por invocação) para não estourar o tempo limite.

import { adminCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { adminClient, telegramApi } from '../_shared/telegram.ts';
import { getZapiCreds, logEnvio, sendText } from '../_shared/zapi.ts';

const INTERVALO_MS = 45_000;

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizaTelefone(tel: string): string | null {
  const d = (tel || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.startsWith('55') ? d : `55${d}`;
}

function primeiroNome(nome: string): string {
  return (nome || '').trim().split(/\s+/)[0] ?? '';
}

function mensagem(nome: string, link: string): string {
  return [
    '📲 *CONEXÃO COM O BOT DA EVO*',
    '',
    `Oi, ${primeiroNome(nome)}! 👋 Estamos migrando nossas comunicações para o Telegram.`,
    '',
    'Esse é o *seu link exclusivo* de conexão com o bot da EVO:',
    '',
    `👉 ${link}`,
    '',
    'Basta clicar no link e apertar *INICIAR* no Telegram. O bot confirma na hora que a conexão deu certo. ✅',
    '',
    '⚠️ *Importante:*',
    '• O link é *pessoal e de uso único* — não compartilhe',
    '• Validade de *48 horas*',
    '• Qualquer dúvida, fala comigo',
  ].join('\n');
}

async function dispararProcessamento(delayMs: number) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-convites-whatsapp`;
  const secret = Deno.env.get('INTERNAL_NOTIFY_SECRET') ?? '';
  const chamar = async () => {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({ action: 'processar' }),
      });
    } catch (e) {
      console.error('[telegram-convites] falha ao encadear', e);
    }
  };
  const tarefa = delayMs > 0 ? new Promise<void>((r) => setTimeout(r, delayMs)).then(chamar) : chamar();
  // @ts-ignore EdgeRuntime existe no runtime do Supabase
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(tarefa);
  else await tarefa;
}

Deno.serve(async (req) => {
  const corsHeaders = adminCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const admin = adminClient();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? 'status');

    const internal = req.headers.get('x-internal-secret');
    const internalOk = !!internal && internal === (Deno.env.get('INTERNAL_NOTIFY_SECRET') ?? '__none__');

    if (!internalOk) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
      );
      const { data: userData } = await userClient.auth.getUser();
      const user = userData?.user;
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) return json({ error: 'forbidden' }, 403);
    }

    const contar = async () => {
      const { data } = await admin.from('telegram_convites_whatsapp').select('status');
      const rows = data ?? [];
      return {
        pendentes: rows.filter((r: any) => r.status === 'pendente' || r.status === 'enviando').length,
        enviados: rows.filter((r: any) => r.status === 'enviado').length,
        falhas: rows.filter((r: any) => r.status === 'falhou').length,
      };
    };

    switch (action) {
      // Monta a fila: um link novo por colaborador ainda não conectado que tenha telefone
      case 'enfileirar': {
        const bot = await telegramApi('getMe', {});
        if (!bot.ok) return json({ error: 'bot_indisponivel', details: bot.description }, 502);

        const somente: string[] | null = Array.isArray(body?.user_ids) && body.user_ids.length
          ? body.user_ids.map((x: unknown) => String(x))
          : null;

        const [{ data: perfis }, { data: vinculos }, { data: listUsers }] = await Promise.all([
          admin.from('user_profiles').select('user_id, telefone'),
          admin.from('telegram_users').select('user_id, telegram_user_id'),
          admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        ]);

        const conectados = new Set(
          (vinculos ?? []).filter((v: any) => v.telegram_user_id).map((v: any) => v.user_id),
        );
        const nomePorUser = new Map<string, string>(
          (listUsers?.users ?? []).map((u: any) => [
            u.id,
            String(u.user_metadata?.full_name ?? u.email?.split('@')[0] ?? 'Colaborador'),
          ]),
        );

        // limpa fila anterior ainda não enviada
        await admin.from('telegram_convites_whatsapp').delete().in('status', ['pendente', 'enviando']);

        const alvo = (perfis ?? []).filter((p: any) => {
          if (somente && !somente.includes(p.user_id)) return false;
          if (!somente && conectados.has(p.user_id)) return false;
          return !!normalizaTelefone(p.telefone ?? '');
        });

        const agora = Date.now();
        const linhas: any[] = [];
        let i = 0;
        for (const p of alvo) {
          const token = randomToken();
          const expiresAt = new Date(agora + 48 * 60 * 60 * 1000).toISOString();
          const { error: tokErr } = await admin.from('telegram_connection_tokens')
            .insert({ user_id: p.user_id, token, expires_at: expiresAt });
          if (tokErr) {
            console.error('[telegram-convites] token', p.user_id, tokErr.message);
            continue;
          }
          await admin.from('telegram_users').upsert(
            { user_id: p.user_id, status: 'nao_conectado' },
            { onConflict: 'user_id', ignoreDuplicates: true },
          );
          linhas.push({
            user_id: p.user_id,
            nome: nomePorUser.get(p.user_id) ?? 'Colaborador',
            telefone: normalizaTelefone(p.telefone ?? '')!,
            link: `https://t.me/${bot.result.username}?start=${token}`,
            enviar_em: new Date(agora + i * INTERVALO_MS).toISOString(),
          });
          i++;
        }

        if (linhas.length) {
          const { error } = await admin.from('telegram_convites_whatsapp').insert(linhas);
          if (error) return json({ error: error.message }, 400);
          await dispararProcessamento(0);
        }

        return json({ ok: true, enfileirados: linhas.length, intervalo_segundos: INTERVALO_MS / 1000 });
      }

      // Fila para a equipe do cronograma (treinadores, estagiários líderes,
      // gerentes de unidade e recepção) que não tem conta no CRM.
      case 'enfileirar_funcionarios': {
        const bot = await telegramApi('getMe', {});
        if (!bot.ok) return json({ error: 'bot_indisponivel', details: bot.description }, 502);

        const cargos: string[] = Array.isArray(body?.cargos) && body.cargos.length
          ? body.cargos.map((c: unknown) => String(c))
          : ['treinador', 'estagiario_lider', 'coordenador_unidade', 'recepcao'];

        const [{ data: funcs }, { data: jaFunc }, { data: perfis }, { data: vinculos }] = await Promise.all([
          admin.from('cronograma_funcionarios')
            .select('id, nome, telefone, cargo, ativo')
            .eq('ativo', true)
            .in('cargo', cargos),
          admin.from('telegram_funcionarios').select('funcionario_id, telefone, status'),
          admin.from('user_profiles').select('user_id, telefone'),
          admin.from('telegram_users').select('user_id, telegram_user_id'),
        ]);

        const ultimos = (t: string | null | undefined) => {
          const d = (t ?? '').replace(/\D/g, '');
          return d.length >= 10 ? d.slice(-11) : null;
        };

        // já conectados: funcionários vinculados + telefones de usuários do CRM conectados
        const conectadosFunc = new Set(
          (jaFunc ?? []).filter((f: any) => f.status === 'conectado').map((f: any) => f.funcionario_id),
        );
        const userConectado = new Set(
          (vinculos ?? []).filter((v: any) => v.telegram_user_id).map((v: any) => v.user_id),
        );
        const telefonesConectados = new Set(
          (perfis ?? [])
            .filter((p: any) => userConectado.has(p.user_id))
            .map((p: any) => ultimos(p.telefone))
            .filter(Boolean) as string[],
        );

        await admin.from('telegram_convites_whatsapp').delete().in('status', ['pendente', 'enviando']);

        const vistos = new Set<string>();
        const agora = Date.now();
        const linhas: any[] = [];
        let i = 0;

        for (const f of funcs ?? []) {
          const tel = normalizaTelefone(f.telefone ?? '');
          const chave = ultimos(f.telefone);
          if (!tel || !chave) continue;
          if (conectadosFunc.has(f.id) || telefonesConectados.has(chave) || vistos.has(chave)) continue;
          vistos.add(chave);

          const token = randomToken();
          const { error: tokErr } = await admin.from('telegram_connection_tokens').insert({
            funcionario_id: f.id,
            token,
            expires_at: new Date(agora + 48 * 60 * 60 * 1000).toISOString(),
          });
          if (tokErr) {
            console.error('[telegram-convites] token funcionario', f.id, tokErr.message);
            continue;
          }
          await admin.from('telegram_funcionarios').upsert(
            { funcionario_id: f.id, nome: f.nome, telefone: f.telefone, status: 'nao_conectado' },
            { onConflict: 'funcionario_id', ignoreDuplicates: true },
          );
          linhas.push({
            funcionario_id: f.id,
            nome: f.nome ?? 'Colaborador',
            telefone: tel,
            link: `https://t.me/${bot.result.username}?start=${token}`,
            enviar_em: new Date(agora + i * INTERVALO_MS).toISOString(),
          });
          i++;
        }

        if (linhas.length) {
          const { error } = await admin.from('telegram_convites_whatsapp').insert(linhas);
          if (error) return json({ error: error.message }, 400);
          await dispararProcessamento(0);
        }

        return json({ ok: true, enfileirados: linhas.length, intervalo_segundos: INTERVALO_MS / 1000 });
      }

      // Envia a próxima mensagem devida e reagenda a seguinte em 45s
      case 'processar': {
        const creds = getZapiCreds('operacional');
        if (!creds) return json({ error: 'whatsapp_nao_configurado' }, 500);

        const { data: fila } = await admin
          .from('telegram_convites_whatsapp')
          .select('*')
          .eq('status', 'pendente')
          .lte('enviar_em', new Date().toISOString())
          .order('enviar_em')
          .limit(1);

        const item = fila?.[0];
        if (item) {
          const { data: claimed } = await admin
            .from('telegram_convites_whatsapp')
            .update({ status: 'enviando' })
            .eq('id', item.id)
            .eq('status', 'pendente')
            .select('id');

          if (claimed?.length) {
            const r = await sendText(creds, item.telefone, mensagem(item.nome, item.link));
            await admin.from('telegram_convites_whatsapp').update({
              status: r.ok ? 'enviado' : 'falhou',
              sent_at: r.ok ? new Date().toISOString() : null,
              erro: r.ok ? null : JSON.stringify(r.body).slice(0, 500),
            }).eq('id', item.id);

            await logEnvio(admin, {
              funcao: 'telegram-convites-whatsapp',
              destino: item.telefone,
              tipo_destino: 'funcionario',
              sucesso: r.ok,
              erro_msg: r.ok ? null : JSON.stringify(r.body).slice(0, 500),
              zapi_status_code: r.status,
              canal: 'operacional',
              status_envio: r.ok ? 'enviado' : 'falhou',
              resposta_completa: r.body,
            });

            await admin.from('telegram_message_logs').insert({
              recipient_type: 'usuario',
              recipient_id: item.user_id,
              telegram_chat_id: null,
              message_type: 'convite_whatsapp',
              status: r.ok ? 'enviado' : 'erro',
              error_message: r.ok ? null : JSON.stringify(r.body).slice(0, 500),
            }).then(() => {}, () => {});
          }
        }

        const { count } = await admin
          .from('telegram_convites_whatsapp')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendente');

        if ((count ?? 0) > 0) await dispararProcessamento(INTERVALO_MS);

        return json({ ok: true, enviado: !!item, restantes: count ?? 0 });
      }

      case 'cancelar': {
        const { error } = await admin.from('telegram_convites_whatsapp')
          .update({ status: 'cancelado' })
          .in('status', ['pendente']);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, ...(await contar()) });
      }

      case 'status':
      default: {
        const { data } = await admin
          .from('telegram_convites_whatsapp')
          .select('nome, telefone, status, enviar_em, sent_at, erro')
          .order('enviar_em');
        return json({ ok: true, ...(await contar()), fila: data ?? [] });
      }
    }
  } catch (e) {
    console.error('[telegram-convites-whatsapp]', e);
    return json({ error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});
