import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const MAX_BATCH = 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizePlano = (plano: string): string => {
  const p = (plano || '').toUpperCase().trim();
  if (p.includes('EXECUTIVO') && p.includes('ANUAL')) return 'Executivo Anual';
  if (p.includes('EXECUTIVO') && p.includes('MENSAL')) return 'Executivo Mensal';
  if (p.includes('TREINADOR') || p.includes('INFLUENCIADOR')) return 'Anual';
  if (p.includes('PARCERIA')) return 'Anual';
  if (p.includes('ANUAL')) return 'Anual';
  if (p.includes('SEMESTRAL')) return 'Semestral';
  if (p.includes('TRIMESTRAL')) return 'Trimestral';
  if (p.includes('MENSAL')) return 'Mensal';
  return 'Anual';
};

const parseDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  try {
    const [datePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    if (!day || !month || !year) return null;
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    if (isNaN(new Date(iso).getTime())) return null;
    return iso;
  } catch {
    return null;
  }
};

const parseVencimentoDate = parseDate;

const MALICIOUS_PATTERNS: RegExp[] = [
  /<\s*script/i, /<\/\s*script/i, /javascript\s*:/i,
  /on(error|click|load|mouseover|focus|blur|change|submit)\s*=/i,
  /<\s*iframe/i, /<\s*object/i, /<\s*embed/i,
  /\bdrop\s+table\b/i, /\bdelete\s+from\b/i, /\binsert\s+into\b/i,
  /\bupdate\s+\w+\s+set\b/i, /\bunion\s+select\b/i, /\bxp_\w+/i,
  /(--\s)|(\/\*)|(\*\/)/, /'\s*or\s*'/i, /"\s*or\s*"/i, /\bor\s+1\s*=\s*1\b/i,
];

const isMalicious = (s: string): boolean => MALICIOUS_PATTERNS.some((re) => re.test(s));

const sanitizeText = (s: unknown, max: number): string => {
  if (typeof s !== 'string') return '';
  // strip control chars and HTML tags
  return s
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
};

interface StudentData {
  nome: string;
  contrato: string;
  data_cadastro: string;
  conversao?: string;
  vencimento: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Auth — require Bearer token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'Não autenticado' });
    }
    const token = authHeader.replace('Bearer ', '');

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(401, { error: 'Não autenticado' });
    }
    const userId = userData.user.id;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Authorization — admin or 'user' role only
    const { data: isAdminData } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    const isAdmin = !!isAdminData;

    let isAuthorized = isAdmin;
    if (!isAdmin) {
      const { data: isUserRole } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'user',
      });
      isAuthorized = !!isUserRole;
    }
    if (!isAuthorized) {
      return json(403, { error: 'Sem permissão' });
    }

    // Parse body
    let body: { students?: unknown; unidade_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Payload inválido' });
    }

    const unidade_id = typeof body.unidade_id === 'string' ? body.unidade_id : '';
    if (!unidade_id || !UUID_RE.test(unidade_id)) {
      return json(400, { error: 'unidade_id inválido' });
    }

    const students = body.students;
    if (!Array.isArray(students) || students.length === 0) {
      return json(400, { error: 'Lista de alunos vazia ou inválida' });
    }
    if (students.length > MAX_BATCH) {
      return json(400, { error: `Lote excede o limite de ${MAX_BATCH} registros` });
    }

    // 3. Scope by unit — non-admin must belong to it
    if (!isAdmin) {
      const { data: unidades, error: unidadesErr } = await supabase.rpc('get_user_unidades', {
        _user_id: userId,
      });
      if (unidadesErr) {
        console.error('get_user_unidades error', unidadesErr);
        return json(500, { error: 'Erro ao validar unidade' });
      }
      const allowed = (unidades as string[] | null)?.includes(unidade_id);
      if (!allowed) {
        return json(403, { error: 'Sem acesso à unidade informada' });
      }
    }

    const results = {
      success: 0,
      skipped: 0,
      rejected: 0,
      errors: [] as string[],
    };

    for (const raw of students as unknown[]) {
      try {
        if (!raw || typeof raw !== 'object') {
          results.rejected++;
          continue;
        }
        const r = raw as Record<string, unknown>;

        const nome = sanitizeText(r.nome, 120).toUpperCase();
        const contrato = sanitizeText(r.contrato, 120);
        const dataCadastroStr = sanitizeText(r.data_cadastro, 30);
        const vencimentoStr = sanitizeText(r.vencimento, 30);

        if (!nome || nome.length < 2) {
          results.rejected++;
          results.errors.push('registro sem nome');
          continue;
        }

        if (isMalicious(nome) || isMalicious(contrato)) {
          results.rejected++;
          results.errors.push('conteúdo inválido detectado');
          continue;
        }

        const dataFechamento = parseDate(dataCadastroStr);
        if (!dataFechamento) {
          results.rejected++;
          results.errors.push(`${nome}: data_cadastro inválida`);
          continue;
        }
        const dataVencimento = parseVencimentoDate(vencimentoStr);

        // Duplicate check within unit
        const { data: existingLead, error: existingErr } = await supabase
          .from('leads')
          .select('id')
          .eq('unidade_id', unidade_id)
          .ilike('nome', nome)
          .maybeSingle();

        if (existingErr) {
          console.error('lookup error', existingErr);
          results.errors.push(`${nome}: erro ao verificar duplicidade`);
          continue;
        }
        if (existingLead) {
          results.skipped++;
          continue;
        }

        const planoNormalizado = normalizePlano(contrato);

        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            nome,
            origem: 'IMPORTAÇÃO',
            cadastrado_por: 'SISTEMA',
            status_funil: 'convertido',
            is_matriculado: true,
            ativo: true,
            unidade_id,
            plano_escolhido: planoNormalizado,
          })
          .select('id')
          .single();

        if (leadError || !newLead) {
          console.error('lead insert error', leadError);
          results.errors.push(`${nome}: falha ao criar lead`);
          continue;
        }

        const { error: interacaoError } = await supabase
          .from('interacoes')
          .insert({
            lead_id: newLead.id,
            tipo: 'matricula',
            fechou_matricula: true,
            plano_escolhido: planoNormalizado,
            data_fechamento: dataFechamento,
            data_vencimento: dataVencimento,
            data_interacao: dataFechamento,
            responsavel_fechamento: 'SISTEMA',
            cadastrado_por: 'SISTEMA',
            unidade_id,
          });

        if (interacaoError) {
          console.error('interacao insert error', interacaoError);
          results.errors.push(`${nome}: falha ao criar matrícula`);
          continue;
        }

        results.success++;
      } catch (err) {
        console.error('item error', err);
        results.rejected++;
        results.errors.push('erro ao processar item');
      }
    }

    // 8. Audit log
    console.log(JSON.stringify({
      audit: 'import_students',
      user_id: userId,
      unidade_id,
      total: (students as unknown[]).length,
      success: results.success,
      skipped: results.skipped,
      rejected: results.rejected,
      at: new Date().toISOString(),
      ua: req.headers.get('user-agent') ?? null,
    }));

    return json(200, {
      message: `Importação concluída: ${results.success} importados, ${results.skipped} já existentes, ${results.rejected} rejeitados`,
      ...results,
    });
  } catch (error) {
    console.error('import-students fatal', error);
    return json(500, { error: 'Erro interno' });
  }
});
