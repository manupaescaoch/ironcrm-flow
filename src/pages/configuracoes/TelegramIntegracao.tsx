import { useCallback, useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, RefreshCw, Users, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Status = 'nao_configurado' | 'conectado' | 'erro';

interface Health {
  status: Status;
  configured: boolean;
  checkedAt: string;
  bot: { id?: number; name?: string; username?: string } | null;
  detail?: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  nao_configurado: 'Não configurado',
  conectado: 'Conectado',
  erro: 'Erro de conexão',
};

export default function TelegramIntegracao() {
  const [health, setHealth] = useState<Health | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async (showToast: boolean) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<Health>('telegram-health');
      if (error) throw error;
      setHealth(data ?? null);

      const { data: row } = await supabase
        .from('integracoes')
        .select('connected_at')
        .eq('provider', 'telegram')
        .maybeSingle();
      setConnectedAt(row?.connected_at ?? null);

      if (showToast) {
        if (data?.status === 'conectado') toast.success('Bot conectado com sucesso.');
        else toast.error('Não foi possível conectar ao bot. Verifique a configuração da integração.');
      }
    } catch {
      if (showToast) toast.error('Não foi possível conectar ao bot. Verifique a configuração da integração.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { check(false); }, [check]);

  const status = health?.status ?? 'nao_configurado';
  const conectado = status === 'conectado';

  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl p-4 md:p-8 space-y-8">
        <header className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Configurações · Integrações
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Conecte o CRM EVO ao bot oficial da EVO para envio automático de notificações.
          </p>
        </header>

        <Card className="border-border/60 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Send className="h-4 w-4 text-primary" />
              Telegram Bot
            </CardTitle>
            {loading && !health ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Badge
                variant={conectado ? 'default' : status === 'erro' ? 'destructive' : 'secondary'}
                className="gap-1.5 font-normal"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${conectado ? 'bg-current' : 'bg-current opacity-60'}`} />
                {STATUS_LABEL[status]}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {conectado ? (
              <>
                <div className="space-y-1">
                  <p className="text-base font-medium">{health?.bot?.name ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">
                    {health?.bot?.username ? `@${health.bot.username}` : '—'}
                  </p>
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Status da integração</dt>
                    <dd className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Integração ativa
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Data da conexão</dt>
                    <dd className="font-medium">
                      {connectedAt ? new Date(connectedAt).toLocaleString('pt-BR') : '—'}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                {status === 'erro' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                Configure o token do bot nas variáveis seguras do projeto.
              </p>
            )}

            <Button onClick={() => check(true)} disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {conectado ? 'Testar conexão' : 'Verificar conexão'}
            </Button>
          </CardContent>
        </Card>

        {conectado && (
          <Card className="border-border/60 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Users className="h-4 w-4 text-primary" />
                Grupos do Telegram
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cadastre os grupos que receberão as notificações automáticas do CRM.
              </p>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => toast.info('Cadastro de grupos chega na próxima etapa.')}
              >
                Configurar grupos
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
