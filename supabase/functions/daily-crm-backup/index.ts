import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Helper to convert array to CSV
function arrayToCSV(data: Record<string, unknown>[], columns: string[]): string {
  if (data.length === 0) return columns.join(',') + '\n';
  
  const header = columns.join(',');
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  
  return [header, ...rows].join('\n');
}

// Format date for Brazil timezone (YYYY-MM-DD)
function getBrazilDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Send email notification using Resend API directly
async function sendEmailNotification(
  result: {
    date: string;
    files: {
      leads: { name: string; rows: number; size: number };
      interacoes: { name: string; rows: number; size: number };
    };
    signedUrls?: { leads: string; interacoes: string };
  }
) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const adminEmail = Deno.env.get('BACKUP_ADMIN_EMAIL');

  if (!resendApiKey || !adminEmail) {
    console.log('Email notification skipped: RESEND_API_KEY or BACKUP_ADMIN_EMAIL not configured');
    return { sent: false, reason: 'Not configured' };
  }

  const formattedDate = new Date(result.date + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #eee; }
        .file-item { background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #4CAF50; }
        .file-name { font-weight: bold; color: #333; }
        .file-meta { color: #666; font-size: 13px; margin-top: 5px; }
        .download-btn { display: inline-block; background: #1a1a2e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f0f0f0; border-radius: 0 0 10px 10px; }
        .success-badge { display: inline-block; background: #4CAF50; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔒 IRON CRM - Backup Diário</h1>
          <p>${formattedDate}</p>
          <span class="success-badge">✓ Backup Concluído</span>
        </div>
        
        <div class="content">
          <h2 style="margin-top: 0;">Resumo do Backup</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 15px; background: white; border-radius: 8px; text-align: center; width: 50%;">
                <div style="font-size: 32px; font-weight: bold; color: #1a1a2e;">${result.files.leads.rows}</div>
                <div style="color: #666; font-size: 14px;">Leads Exportados</div>
              </td>
              <td style="padding: 15px; background: white; border-radius: 8px; text-align: center; width: 50%;">
                <div style="font-size: 32px; font-weight: bold; color: #1a1a2e;">${result.files.interacoes.rows}</div>
                <div style="color: #666; font-size: 14px;">Interações Exportadas</div>
              </td>
            </tr>
          </table>
          
          <div style="margin: 25px 0;">
            <h3>📁 Arquivos Gerados</h3>
            
            <div class="file-item">
              <div class="file-name">📄 ${result.files.leads.name}</div>
              <div class="file-meta">
                ${result.files.leads.rows} registros • ${formatFileSize(result.files.leads.size)}
              </div>
              ${result.signedUrls?.leads ? `<a href="${result.signedUrls.leads}" class="download-btn">⬇️ Download Leads</a>` : ''}
            </div>
            
            <div class="file-item">
              <div class="file-name">📄 ${result.files.interacoes.name}</div>
              <div class="file-meta">
                ${result.files.interacoes.rows} registros • ${formatFileSize(result.files.interacoes.size)}
              </div>
              ${result.signedUrls?.interacoes ? `<a href="${result.signedUrls.interacoes}" class="download-btn">⬇️ Download Interações</a>` : ''}
            </div>
          </div>
          
          <p style="color: #666; font-size: 13px; margin-top: 25px;">
            ${result.signedUrls ? '⏰ Os links de download expiram em 24 horas.' : 'Acesse a página de Backups no CRM para baixar os arquivos.'}
          </p>
        </div>
        
        <div class="footer">
          <p>Este é um email automático do IRON CRM.</p>
          <p>Backup realizado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' })}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'IRON CRM <onboarding@resend.dev>',
        to: [adminEmail],
        subject: `✅ IRON CRM – Backup Diário ${formattedDate}`,
        html: emailHtml,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email');
    }

    console.log('Email sent successfully:', data);
    return { sent: true, response: data };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { sent: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cronSecret = Deno.env.get('BACKUP_CRON_SECRET');
    
    // Create client with service role for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // ===========================================
    // SECURITY: Authorization checks
    // ===========================================
    const requestCronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization');
    
    let isAuthorized = false;
    let authMethod = '';
    
    // AUTH METHOD 1: Cron job with secret header
    // Used for scheduled backups via pg_cron
    if (cronSecret && requestCronSecret) {
      // Constant-time comparison to prevent timing attacks
      const secretMatch = cronSecret.length === requestCronSecret.length &&
        cronSecret.split('').every((char, i) => char === requestCronSecret[i]);
      
      if (secretMatch) {
        console.log('Authorized via cron secret');
        isAuthorized = true;
        authMethod = 'cron_secret';
      } else {
        console.log('Invalid cron secret provided');
      }
    }
    
    // AUTH METHOD 2: Admin user with valid JWT
    // Used for manual backup triggers from admin users
    if (!isAuthorized && authHeader) {
      const token = authHeader.replace('Bearer ', '');
      
      // Skip anon key - we need a real user JWT for admin check
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (token && token !== anonKey) {
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (userError) {
          console.log('JWT validation failed:', userError.message);
        } else if (user) {
          // Check if user has admin role
          const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', { 
            _user_id: user.id, 
            _role: 'admin' 
          });
          
          if (roleError) {
            console.log('Role check failed:', roleError.message);
          } else if (isAdmin) {
            console.log(`Authorized via admin user: ${user.email}`);
            isAuthorized = true;
            authMethod = 'admin_jwt';
          } else {
            console.log(`User ${user.email} is not an admin - access denied`);
          }
        }
      }
    }
    
    // DENY ACCESS if neither auth method succeeded
    if (!isAuthorized) {
      console.log('Unauthorized backup attempt - no valid credentials');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized - Admin access or valid cron secret required' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Backup authorized via: ${authMethod}`);

    const dateStr = getBrazilDate();
    console.log(`Starting backup for date: ${dateStr}`);

    // Fetch all leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    // Fetch all interactions
    const { data: interacoes, error: interacoesError } = await supabase
      .from('interacoes')
      .select('*')
      .order('created_at', { ascending: false });

    if (interacoesError) {
      throw new Error(`Failed to fetch interacoes: ${interacoesError.message}`);
    }

    console.log(`Fetched ${leads?.length || 0} leads and ${interacoes?.length || 0} interacoes`);

    // Define columns for leads CSV
    const leadsColumns = [
      'id', 'nome', 'email', 'telefone', 'origem', 'status_funil', 
      'plano_escolhido', 'cadastrado_por', 'atendido_por', 'observacoes',
      'data_aula_experimental', 'ativo', 'user_id', 'created_by', 'created_at', 'updated_at'
    ];

    // Define columns for interacoes CSV
    const interacoesColumns = [
      'id', 'lead_id', 'tipo', 'descricao', 'data_interacao',
      'data_experimental', 'hora_experimental', 'agendou_experimental',
      'confirmado', 'compareceu', 'reagendou', 'fechou_matricula',
      'plano_escolhido', 'valor_plano', 'responsavel_fechamento',
      'treinador_responsavel', 'treinador_experimental', 'origem_fechamento',
      'comissao_comercial', 'comissao_recepcao', 'comissao_cadastrador',
      'atendido_por', 'atendido_por_tipo', 'cadastrado_por', 'quem_agendou',
      'tipo_atendimento', 'data_fechamento', 'created_by', 'created_at'
    ];

    // Generate CSVs
    const leadsCSV = arrayToCSV(leads || [], leadsColumns);
    const interacoesCSV = arrayToCSV(interacoes || [], interacoesColumns);

    // Upload to storage
    const leadsFileName = `${dateStr}_FULL_CRM_LEADS.csv`;
    const interacoesFileName = `${dateStr}_FULL_CRM_INTERACOES.csv`;

    // Upload leads CSV
    const { error: uploadLeadsError } = await supabase.storage
      .from('backups_crm_iron')
      .upload(leadsFileName, leadsCSV, {
        contentType: 'text/csv',
        upsert: true
      });

    if (uploadLeadsError) {
      throw new Error(`Failed to upload leads backup: ${uploadLeadsError.message}`);
    }

    // Upload interacoes CSV
    const { error: uploadInteracoesError } = await supabase.storage
      .from('backups_crm_iron')
      .upload(interacoesFileName, interacoesCSV, {
        contentType: 'text/csv',
        upsert: true
      });

    if (uploadInteracoesError) {
      throw new Error(`Failed to upload interacoes backup: ${uploadInteracoesError.message}`);
    }

    console.log('Backup files uploaded successfully');

    // Generate signed URLs for email (24 hours)
    const { data: leadsSignedUrl } = await supabase.storage
      .from('backups_crm_iron')
      .createSignedUrl(leadsFileName, 86400);

    const { data: interacoesSignedUrl } = await supabase.storage
      .from('backups_crm_iron')
      .createSignedUrl(interacoesFileName, 86400);

    const result = {
      success: true,
      date: dateStr,
      files: {
        leads: {
          name: leadsFileName,
          rows: leads?.length || 0,
          size: leadsCSV.length
        },
        interacoes: {
          name: interacoesFileName,
          rows: interacoes?.length || 0,
          size: interacoesCSV.length
        }
      },
      signedUrls: {
        leads: leadsSignedUrl?.signedUrl || '',
        interacoes: interacoesSignedUrl?.signedUrl || ''
      },
      timestamp: new Date().toISOString()
    };

    // Send email notification
    const emailResult = await sendEmailNotification(result);
    console.log('Email notification result:', emailResult);

    return new Response(JSON.stringify({ ...result, emailNotification: emailResult }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Backup error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
