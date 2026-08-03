import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Check, Eye, CalendarClock } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FollowUpGerenteItem, FollowUpGerenteTipo } from '@/hooks/useFollowUpsGerente';

interface Props {
  urgentItems: FollowUpGerenteItem[];
  onRefresh: () => void;
}

const TIPO_CONFIG: Record<FollowUpGerenteTipo, { label: string; color: string; bgColor: string }> = {
  'G+7':  { label: 'D+7',  color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  'G+30': { label: 'D+30', color: 'text-purple-700', bgColor: 'bg-purple-100' },
};

const ALVO_DIAS: Record<FollowUpGerenteTipo, number> = {
  'G+7': 7,
  'G+30': 30,
};

function buildMessage(
  tipo: FollowUpGerenteTipo,
  nome: string,
  gerente: string,
  unidade: string,
): string {
  if (tipo === 'G+7') {
    return `Olá, ${nome}! Tudo bem?

Aqui é ${gerente}, gerente da Iron ${unidade}. Estou passando para saber como foi sua primeira semana com a gente.

Você conseguiu realizar os agendamentos normalmente? Foi bem recebido pela equipe e sentiu que teve o acompanhamento necessário durante os treinos?

Também queria saber se ficou alguma dúvida sobre nossa metodologia ou se encontrou alguma dificuldade nesse início.

Pode falar com sinceridade. Seu feedback é muito importante para garantirmos que sua experiência seja cada vez melhor.`;
  }

  return `Olá, ${nome}! Tudo bem?

Você está completando seu primeiro mês na Iron e queria acompanhar um pouco mais de perto como está sendo sua experiência.

Como você avalia sua evolução até aqui? Já percebeu alguma mudança no condicionamento, na execução dos exercícios, na disposição ou nos resultados?

Também estamos avaliando sua frequência para entender se sua rotina de treinos está funcionando bem ou se precisamos realizar algum ajuste.

Tem algum ponto que podemos melhorar no acompanhamento, nos horários, no atendimento ou na sua experiência dentro da unidade?

Conte comigo e com toda a equipe. Nosso objetivo não é apenas que você treine, mas que tenha direção, constância e resultado.`;
}

export function FollowUpGerenteSection({ urgentItems, onRefresh }: Props) {
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selected, setSelected] = useState<FollowUpGerenteItem | null>(null);
  const [newDate, setNewDate] = useState('');

  const gerenteNome = useMemo(() => {
    const metadata = user?.user_metadata as Record<string, unknown> | undefined;
    const raw = (metadata?.full_name || metadata?.name || metadata?.display_name || user?.email || '') as string;
    const primeiro = String(raw).trim().split(/[\s@]+/)[0] || 'Gerente';
    return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
  }, [user]);

  const unidadeNome = useMemo(() => {
    const nome = (unidadeAtual?.nome || '').replace(/^iron\s+/i, '').trim();
    return nome || 'Club';
  }, [unidadeAtual?.nome]);

  const sorted = useMemo(() => {
    return [...urgentItems].sort((a, b) => {
      const atrasoA = a.diasDesdeMatricula - ALVO_DIAS[a.tipo];
      const atrasoB = b.diasDesdeMatricula - ALVO_DIAS[b.tipo];
      return atrasoB - atrasoA;
    });
  }, [urgentItems]);

  const getTimeInfo = (item: FollowUpGerenteItem) => {
    const atraso = item.diasDesdeMatricula - ALVO_DIAS[item.tipo];
    if (atraso <= 0) return { text: 'hoje', className: 'text-amber-700 bg-amber-100' };
    return { text: `${atraso}d atrasado`, className: 'text-red-700 bg-red-100' };
  };

  const getFuDate = (item: FollowUpGerenteItem) => {
    const [y, m, d] = (item.data_matricula || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    const base = new Date(y, m - 1, d);
    base.setDate(base.getDate() + ALVO_DIAS[item.tipo]);
    return base.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const handleMarkDone = async (item: FollowUpGerenteItem) => {
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
          concluido_por: 'gerente',
          cancelado_motivo: null,
        }, { onConflict: 'lead_id,tipo' });
      if (error) throw error;
      toast.success('Follow-up do gerente marcado como realizado!');
      onRefresh();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao marcar follow-up');
    } finally {
      setLoading(false);
    }
  };

  const openReschedule = (item: FollowUpGerenteItem) => {
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

  const renderItem = (item: FollowUpGerenteItem) => {
    const tipoCfg = TIPO_CONFIG[item.tipo];
    const timeInfo = getTimeInfo(item);
    const primeiroNome = item.lead.nome?.split(' ')[0] || 'Aluno';
    const message = buildMessage(item.tipo, primeiroNome, gerenteNome, unidadeNome);
    const fuDate = getFuDate(item);
    const atraso = item.diasDesdeMatricula - ALVO_DIAS[item.tipo];

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
              {fuDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="w-3 h-3" />
                  FU: {fuDate}
                  {atraso > 0 && (
                    <span className="text-red-600 font-medium">· há {atraso}d</span>
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
          <Button variant="ghost" size="sm" onClick={() => handleMarkDone(item)} disabled={loading} title="Marcar como enviado">
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openReschedule(item)} disabled={loading} title="Reagendar">
            <CalendarClock className="w-4 h-4 text-blue-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/lead/${item.lead_id}`)} title="Ver aluno">
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
      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>FU Gerente — Vencidos / Hoje</span>
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
              <p>Nenhum follow-up de gerente pendente!</p>
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
