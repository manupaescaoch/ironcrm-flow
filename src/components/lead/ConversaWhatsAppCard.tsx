import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Msg {
  id: string;
  role: string;
  conteudo: string;
  created_at: string;
}

interface Props {
  leadId: string;
}

export function ConversaWhatsAppCard({ leadId }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [atendimentoId, setAtendimentoId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: atend } = await supabase
        .from('agente_atendimentos')
        .select('id')
        .eq('lead_id', leadId)
        .order('ultima_interacao_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!atend) {
        setLoading(false);
        return;
      }
      setAtendimentoId(atend.id);

      const { data } = await supabase
        .from('agente_mensagens')
        .select('id, role, conteudo, created_at')
        .eq('atendimento_id', atend.id)
        .order('created_at', { ascending: true })
        .limit(200);
      setMsgs(data || []);
      setLoading(false);
    })();
  }, [leadId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Conversa WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!atendimentoId || msgs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Conversa WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma mensagem registrada ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Conversa WhatsApp
          <span className="text-xs font-normal text-muted-foreground">({msgs.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[360px] pr-3">
          <div className="space-y-2">
            {msgs.map((m) => {
              const isEquipe = m.role === 'assistant';
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex flex-col max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    isEquipe
                      ? 'ml-auto bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                      : 'mr-auto bg-muted',
                  )}
                >
                  <span className="whitespace-pre-wrap">{m.conteudo}</span>
                  <span className="text-[10px] text-muted-foreground mt-1 self-end">
                    {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
