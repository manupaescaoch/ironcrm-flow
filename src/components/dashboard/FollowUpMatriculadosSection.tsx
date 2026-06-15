import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Check, Eye, CalendarClock } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { differenceInDays, isToday, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FollowUpMatriculadoItem } from '@/hooks/useFollowUpsMatriculados';

interface Props {
  urgentItems: FollowUpMatriculadoItem[];
  onRefresh: () => void;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'M+7':  { label: 'M+7',  color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'M+30': { label: 'M+30', color: 'text-purple-700', bgColor: 'bg-purple-100' },
};

const MESSAGES: Record<string, (nome: string) => string> = {
  'M+7': (nome) => `Oi, ${nome}! Aqui é da IRON CLUB.

Faz uma semana desde que você começou seu plano com a gente. Como está sendo a adaptação aos treinos?

Qualquer dúvida sobre execução, frequência ou ajuste de treino, é só me chamar. Estamos aqui pra te ajudar a manter a constância.`,
  'M+30': (nome) => `Oi, ${nome}! Tudo bem?

Já se passou 1 mês desde o início do seu plano na IRON CLUB. Que tal me contar como está sendo sua experiência até aqui?

Está conseguindo manter a frequência? Quer ajustar algo no treino? Me fala, vou te ajudar a evoluir cada vez mais.`,
};

export function FollowUpMatriculadosSection({ urgentItems, onRefresh }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selected, setSelected] = useState<FollowUpMatriculadoItem | null>(null);
  const [newDate, setNewDate] = useState('');

  const sorted = useMemo(() => {
    return [...urgentItems].sort((a, b) =>
      new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime()
    );
  }, [urgentItems]);

  const getTimeInfo = (dataPrevista: string) => {
    const date = new Date(dataPrevista);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diff = differenceInDays(date, hoje);
    if (isToday(date)) {
      return { text: 'hoje', className: 'text-amber-700 bg-amber-100' };
    } else if (isPast(date)) {
      const daysOverdue = Math.abs(diff);
      return { text: `${daysOverdue}d atrasado`, className: 'text-red-700 bg-red-100' };
    } else {
      return { text: `em ${diff}d`, className: 'text-muted-foreground bg-muted' };
    }
  };

  const handleMarkDone = async (item: FollowUpMatriculadoItem) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('follow_ups')
        .update({
          status: 'concluido',
          concluido_em: new Date().toISOString(),
          concluido_por: 'dashboard',
        })
        .eq('id', item.id);
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
    if (!selected || !newDate) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('follow_ups')
        .update({ data_prevista: `${newDate}T00:00:00-03:00` })
        .eq('id', selected.id);
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
    const tipoCfg = TIPO_CONFIG[item.tipo] || { label: item.tipo, color: 'text-foreground', bgColor: 'bg-muted' };
    const timeInfo = getTimeInfo(item.data_prevista);
    const primeiroNome = item.lead.nome?.split(' ')[0] || 'Aluno';
    const messageFn = MESSAGES[item.tipo] || ((n: string) => `Oi, ${n}!`);
    const message = messageFn(primeiroNome);

    return (
      <div
        key={item.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-background gap-3"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Badge className={cn('shrink-0', tipoCfg.bgColor, tipoCfg.color)}>
            {tipoCfg.label}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{item.lead.nome}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {item.lead.telefone && (
                <WhatsAppLink
                  phone={item.lead.telefone}
                  message={message}
                  showIcon={true}
                  className="text-green-600 hover:text-green-700"
                />
              )}
              <Badge variant="outline" className={cn('text-xs', timeInfo.className)}>
                {timeInfo.text}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost" size="sm"
            onClick={() => handleMarkDone(item)}
            disabled={loading}
            title="Marcar como enviado"
          >
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => openReschedule(item)}
            disabled={loading}
            title="Reagendar"
          >
            <CalendarClock className="w-4 h-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate(`/lead/${item.lead_id}`)}
            title="Ver aluno"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {item.lead.telefone && (
            <WhatsAppLink phone={item.lead.telefone} message={message} iconOnly />
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
              <span>Vencidos / Hoje</span>
            </div>
            <Badge variant="destructive">{sorted.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2 pr-4">
                {sorted.map(renderItem)}
              </div>
            </ScrollArea>
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
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
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
