import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lead, Interacao } from '@/types/database';
import { Loader2 } from 'lucide-react';

interface ExperimentalItem {
  lead: Lead;
  interacao: Interacao;
}

interface ReagendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ExperimentalItem | null;
  onSuccess: () => void;
}

export function ReagendarModal({ open, onOpenChange, item, onSuccess }: ReagendarModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [novaData, setNovaData] = useState('');
  const [novoHorario, setNovoHorario] = useState('');
  const [observacao, setObservacao] = useState('');

  const handleReagendar = async () => {
    if (!item || !novaData || !novoHorario) {
      toast({ title: 'Preencha data e horário', variant: 'destructive' });
      return;
    }

    setLoading(true);

    // Update the interaction
    const { error: interacaoError } = await supabase
      .from('interacoes')
      .update({
        data_experimental: novaData,
        hora_experimental: novoHorario,
        confirmado: false,
        compareceu: null,
        reagendou: true,
        descricao: observacao || item.interacao.descricao,
      })
      .eq('id', item.interacao.id);

    if (interacaoError) {
      toast({ title: 'Erro ao reagendar', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Update lead status back to aula_agendada
    const { error: leadError } = await supabase
      .from('leads')
      .update({ status_funil: 'aula_agendada' })
      .eq('id', item.lead.id);

    if (leadError) {
      toast({ title: 'Erro ao atualizar status do lead', variant: 'destructive' });
    } else {
      toast({ title: 'Experimental reagendado com sucesso!' });
      onOpenChange(false);
      setNovaData('');
      setNovoHorario('');
      setObservacao('');
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar Experimental</DialogTitle>
        </DialogHeader>
        
        {item && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Reagendando aula experimental de <strong>{item.lead.nome}</strong>
            </p>
            
            <div className="space-y-2">
              <Label>Nova Data</Label>
              <Input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Novo Horário</Label>
              <Input
                type="time"
                value={novoHorario}
                onChange={(e) => setNovoHorario(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Motivo do reagendamento..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleReagendar} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Reagendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
