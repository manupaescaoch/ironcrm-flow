import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de planos para normalização
const normalizePlano = (plano: string): string => {
  const planoUpper = plano.toUpperCase().trim();
  
  if (planoUpper.includes('EXECUTIVO') && planoUpper.includes('ANUAL')) {
    return 'Executivo Anual';
  }
  if (planoUpper.includes('EXECUTIVO') && planoUpper.includes('MENSAL')) {
    return 'Executivo Mensal';
  }
  if (planoUpper.includes('TREINADOR') || planoUpper.includes('INFLUENCIADOR')) {
    return 'Anual'; // Treinadores geralmente têm plano anual
  }
  if (planoUpper.includes('PARCERIA')) {
    return 'Anual';
  }
  if (planoUpper.includes('ANUAL')) {
    return 'Anual';
  }
  if (planoUpper.includes('SEMESTRAL')) {
    return 'Semestral';
  }
  if (planoUpper.includes('TRIMESTRAL')) {
    return 'Trimestral';
  }
  if (planoUpper.includes('MENSAL')) {
    return 'Mensal';
  }
  
  return 'Anual'; // Default
};

// Parse date from Brazilian format (DD/MM/YYYY HH:MM:SS) to ISO format
const parseDate = (dateStr: string): string => {
  const [datePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

interface StudentData {
  nome: string;
  contrato: string;
  data_cadastro: string;
  conversao: string;
  vencimento: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { students, unidade_id } = await req.json() as { 
      students: StudentData[]; 
      unidade_id: string;
    };

    if (!students || !Array.isArray(students) || students.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Lista de alunos vazia ou inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!unidade_id) {
      return new Response(
        JSON.stringify({ error: 'unidade_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      success: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const student of students) {
      try {
        // Check if lead already exists with same name in this unit
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('unidade_id', unidade_id)
          .ilike('nome', student.nome.trim())
          .maybeSingle();

        if (existingLead) {
          results.skipped++;
          continue;
        }

        const planoNormalizado = normalizePlano(student.contrato);
        const dataFechamento = parseDate(student.data_cadastro);

        // Insert lead
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            nome: student.nome.trim().toUpperCase(),
            origem: 'IMPORTAÇÃO',
            cadastrado_por: 'SISTEMA',
            status_funil: 'convertido',
            is_matriculado: true,
            ativo: true,
            unidade_id: unidade_id,
            plano_escolhido: planoNormalizado,
          })
          .select('id')
          .single();

        if (leadError) {
          results.errors.push(`Lead ${student.nome}: ${leadError.message}`);
          continue;
        }

        // Insert interaction (matrícula)
        const { error: interacaoError } = await supabase
          .from('interacoes')
          .insert({
            lead_id: newLead.id,
            tipo: 'matricula',
            fechou_matricula: true,
            plano_escolhido: planoNormalizado,
            data_fechamento: dataFechamento,
            data_interacao: dataFechamento,
            responsavel_fechamento: 'SISTEMA',
            cadastrado_por: 'SISTEMA',
            unidade_id: unidade_id,
          });

        if (interacaoError) {
          results.errors.push(`Interação ${student.nome}: ${interacaoError.message}`);
          continue;
        }

        results.success++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`${student.nome}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Importação concluída: ${results.success} importados, ${results.skipped} já existentes`,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
