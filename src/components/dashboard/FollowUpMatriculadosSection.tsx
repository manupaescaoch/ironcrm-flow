import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Eye, CalendarClock, MessageCircle, Loader2, RefreshCw } from 'lucide-react';
import { WhatsAppLink, normalizePhoneForWhatsApp } from '@/components/WhatsAppLink';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FollowUpMatriculadoItem, FollowUpMatriculadoTipo } from '@/hooks/useFollowUpsMatriculados';
import { fuDate, diffFuBusinessDays, fuDay } from '@/lib/fuBusinessDays';

interface Props {
  urgentItems: FollowUpMatriculadoItem[];
  onRefresh: () => void;
  fetching?: boolean;
  error?: string | null;
}

const TIPO_CONFIG: Record<FollowUpMatriculadoTipo, { label: string; color: string; bgColor: string }> = {
  'D+1':  { label: 'D+1',  color: 'text-green-700',  bgColor: 'bg-green-100' },
  'D+7':  { label: 'D+7',  color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  'D+30': { label: 'D+30', color: 'text-purple-700', bgColor: 'bg-purple-100' },
};

const MESSAGES: Record<FollowUpMatriculadoTipo, (nome: string) => string> = {
  'D+1': (nome) => `Oi, ${nome}! Seja muito bem-vindo(a) à EVO CLUB.

Tô passando pra confirmar sua matrícula e tirar qualquer dúvida do primeiro treino. Qualquer coisa, me chama por aqui.`,
  'D+7': (nome) => `Oi, ${nome}! Aqui é da EVO CLUB.

Faz uma semana desde sua matrícula. Como está sendo a adaptação aos treinos?

Qualquer dúvida sobre execução, frequência ou ajuste de treino, é só me chamar.`,
  'D+30': (nome) => `Oi, ${nome}! Tudo bem?

Já fechou 1 mês desde sua matrícula na EVO CLUB. Bora bater um papo rápido sobre evolução, frequência e próximos passos do seu treino?`,
};

// alvo de dias por etapa para calcular atraso visual
const ALVO_DIAS: Record<FollowUpMatriculadoTipo, number> = {
  'D+1': 1,
  'D+7': 7,
  'D+30': 30,
};

export function FollowUpMatriculadosSection({ urgentItems, onRefresh, fetching = false, error = null }: Props) {
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selected, setSelected] = useState<FollowUpMatriculadoItem | null>(null);
  const [newDate, setNewDate] = useState('');

  // Ordena por mais atrasado primeiro (maior dias além do alvo)
  const sorted = useMemo(() => {
    return [...urgentItems].sort((a, b) => {
      const atrasoA = diffFuBusinessDays(a.data_prevista, fuDay(fuDate(new Date())));
      const atrasoB = diffFuBusinessDays(b.data_prevista, fuDay(fuDate(new Date())));
      return atrasoB - atrasoA;
    });
  }, [urgentItems]);

  const getTimeInfo = (item: FollowUpMatriculadoItem) => {
    const atraso = diffFuBusinessDays(item.data_prevista, fuDay(fuDate(new Date())));
    if (atraso <= 0) {
      return { text: 'hoje', className: 'text-amber-700 bg-amber-100' };
    }
    return { text: `${atraso}d atrasado`, className: 'text-red-700 bg-red-100' };
  };

  const getFuDate = (item: FollowUpMatriculadoItem) => {
    const base = fuDate(item.data_prevista);
    return base.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const handleMarkDone = async (item: FollowUpMatriculadoItem) => {
    if (!unidadeAtual) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('follow_ups')
        .upsert({
          lead_id: item.lead_id,
          unidade_id: unidadeAtual.id,
          tipo: item.tipo,
          data_referencia: item.data_matricula,
          data_prevista: new Date().toISOString(),
          status: 'concluido',
          concluido_em: new Date().toISOString(),
          concluido_por: 'dashboard',
          cancelado_motivo: null,
        }, { onConflict: 'lead_id,tipo' });
      if (error) throw error;
      toast.success('Follow-up marcado como realizado!');
      onRefresh();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao marcar follow-up');
    } finally {
      setLoading(false);
    }
  };

  const openReschedule = (item: FollowUpMatriculadoItem) => {
    setSelected(item);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setNewDate(d.toISOString().slice(0, 10));
    setRescheduleOpen(true);
  };

  const confirmReschedule = async () => {
    if (!selected || !newDate || !unidadeAtual) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('follow_ups')
        .upsert({
          lead_id: selected.lead_id,
          unidade_id: unidadeAtual.id,
          tipo: selected.tipo,
          data_referencia: selected.data_matricula,
          data_prevista: `${newDate}T00:00:00-03:00`,
          status: 'pendente',
          concluido_em: null,
          concluido_por: null,
          cancelado_motivo: 'reagendado',
        }, { onConflict: 'lead_id,tipo' });
      if (error) throw error;
      toast.success('Follow-up reagendado!');
      setRescheduleOpen(false);
      setSelected(null);
      onRefresh();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao reagendar');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = (item: FollowUpMatriculadoItem) => {
    const tipoCfg = TIPO_CONFIG[item.tipo];
    const timeInfo = getTimeInfo(item);
    const primeiroNome = item.lead.nome?.split(' ')[0] || 'Aluno';
    const message = MESSAGES[item.tipo](primeiroNome);
    const displayFuDate = getFuDate(item);
    const atraso = diffFuBusinessDays(item.data_prevista, fuDay(fuDate(new Date())));

    return (
      <div
        key={`${item.lead_id}-${item.tipo}`}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-background gap-3"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Badge className={cn('shrink-0', tipoCfg.bgColor, tipoCfg.color)}>
            {tipoCfg.label}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="font-semibold break-words">{item.lead.nome}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {item.lead.telefone && (
                <WhatsAppLink
                  phone={item.lead.telefone}
                  message={message}
                  showIcon={true}
                  className="text-green-600 hover:text-green-700"
                />
              )}
              {displayFuDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="w-3 h-3" />
                  FU: {displayFuDate}
                  {atraso > 0 && (
                    <span className="text-red-600 font-medium">
                      · há {atraso}d
                    </span>
                  )}
                </span>
              )}
              <Badge variant="outline" className={cn('text-xs', timeInfo.className)}>
                {timeInfo.text}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => handleMarkDone(item)} disabled={loading || fetching || !!error} title="Marcar como realizado" aria-label={`Marcar FU de ${item.lead.nome} como realizado`}>
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openReschedule(item)} disabled={loading || fetching || !!error} title="Reagendar" aria-label={`Reagendar FU de ${item.lead.nome}`}>
            <CalendarClock className="w-4 h-4 text-blue-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/lead/${item.lead_id}`)} title="Ver aluno">
            <Eye className="w-4 h-4" />
          </Button>
          {item.lead.telefone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://wa.me/${normalizePhoneForWhatsApp(item.lead.telefone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-label={`Enviar FU para ${item.lead.nome} pelo WhatsApp`}>
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>FU Matriculados</span>
            </div>
            <Badge variant="destructive">{sorted.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Vencidos / Hoje</p>
          {error ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 py-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={fetching}>
                <RefreshCw className="w-4 h-4 mr-2" />Tentar novamente
              </Button>
            </div>
          ) : fetching ? (
            <div role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />Carregando FU de matriculados…
            </div>
          ) : sorted.length > 0 ? (
            <div className="max-h-[500px] overflow-y-auto">
              <div className="space-y-2">
                {sorted.map(renderItem)}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p>Nenhum follow-up de matriculado vencido ou para hoje!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar follow-up</DialogTitle>
            <DialogDescription>
              Escolha a nova data para {selected?.lead.nome}.
            </DialogDescription>
          </DialogHeader>
          <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancelar</Button>
            <Button onClick={confirmReschedule} disabled={loading || !newDate}>
              {loading ? 'Salvando...' : 'Reagendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
