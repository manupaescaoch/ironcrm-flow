import { useState } from 'react';
import { format, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VencimentoItem } from '@/hooks/useVencimentosData';

interface RenovacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vencimento: VencimentoItem | null;
  onSuccess: () => void;
}

const PLANOS = [
  'Mensal',
  'Trimestral',
  'Semestral',
  'Anual',
  'Executivo Mensal',
  'Executivo Anual',
];

// Calcular data de vencimento baseado no plano
const calcularDataVencimento = (plano: string, dataFechamento: Date): Date => {
  const planoNormalizado = plano.toLowerCase().trim();
  
  if (planoNormalizado.includes('mensal')) {
    return addMonths(dataFechamento, 1);
  }
  if (planoNormalizado.includes('trimestral')) {
    return addMonths(dataFechamento, 3);
  }
  if (planoNormalizado.includes('semestral')) {
    return addMonths(dataFechamento, 6);
  }
  // Anual é o default
  return addMonths(dataFechamento, 12);
};

export function RenovacaoModal({ open, onOpenChange, vencimento, onSuccess }: RenovacaoModalProps) {
  const [loading, setLoading] = useState(false);
  const [plano, setPlano] = useState('');
  const [valorPlano, setValorPlano] = useState('');
  const [observacao, setObservacao] = useState('');
  const [dataFechamento, setDataFechamento] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleRenovar = async () => {
    if (!vencimento) return;

    if (!plano) {
      toast.error('Selecione um plano');
      return;
    }

    setLoading(true);

    try {
      // Calcular data de vencimento
      const dataFechamentoDate = parseISO(dataFechamento);
      const dataVencimento = calcularDataVencimento(plano, dataFechamentoDate);
      
      // Create new interaction for renewal
      const { error } = await supabase.from('interacoes').insert({
        lead_id: vencimento.leadId,
        unidade_id: vencimento.unidadeId,
        tipo: 'renovacao',
        data_interacao: new Date().toISOString(),
        fechou_matricula: true,
        data_fechamento: dataFechamento,
        data_vencimento: format(dataVencimento, 'yyyy-MM-dd'),
        plano_escolhido: plano,
        valor_plano: valorPlano ? parseFloat(valorPlano) : null,
        descricao: observacao || `Renovação do plano ${vencimento.planoEscolhido} para ${plano}`,
        origem_fechamento: 'renovacao',
      });

      if (error) throw error;

      toast.success('Renovação registrada com sucesso!');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setPlano('');
      setValorPlano('');
      setObservacao('');
      setDataFechamento(format(new Date(), 'yyyy-MM-dd'));
    } catch (error) {
      console.error('Erro ao renovar:', error);
      toast.error('Erro ao registrar renovação');
    } finally {
      setLoading(false);
    }
  };

  if (!vencimento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Renovar Matrícula
          </DialogTitle>
          <DialogDescription>
            Registre a renovação do plano de {vencimento.nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">{vencimento.nome}</p>
            <p className="text-xs text-muted-foreground">
              Plano atual: {vencimento.planoEscolhido}
            </p>
            <p className="text-xs text-muted-foreground">
              Vencimento: {format(vencimento.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>

          {/* New plan selection */}
          <div className="space-y-2">
            <Label htmlFor="plano">Novo Plano *</Label>
            <Select value={plano} onValueChange={setPlano}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {PLANOS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Closing date */}
          <div className="space-y-2">
            <Label htmlFor="dataFechamento">Data de Fechamento</Label>
            <Input
              id="dataFechamento"
              type="date"
              value={dataFechamento}
              onChange={(e) => setDataFechamento(e.target.value)}
            />
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="valorPlano">Valor do Plano (R$)</Label>
            <Input
              id="valorPlano"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={valorPlano}
              onChange={(e) => setValorPlano(e.target.value)}
            />
          </div>

          {/* Observation */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              placeholder="Observações sobre a renovação..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleRenovar} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Confirmar Renovação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
