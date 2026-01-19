import { useState, useEffect } from 'react';
import { format, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Loader2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VencimentoItem } from '@/hooks/useVencimentosData';

interface EditarVencimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vencimento: VencimentoItem | null;
  onSuccess: () => void;
}

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

export function EditarVencimentoModal({ open, onOpenChange, vencimento, onSuccess }: EditarVencimentoModalProps) {
  const [loading, setLoading] = useState(false);
  const [dataFechamento, setDataFechamento] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [autoCalculate, setAutoCalculate] = useState(true);

  // Atualiza os campos quando o vencimento muda
  useEffect(() => {
    if (vencimento) {
      setDataFechamento(format(vencimento.dataFechamento, 'yyyy-MM-dd'));
      setDataVencimento(format(vencimento.dataVencimento, 'yyyy-MM-dd'));
    }
  }, [vencimento]);

  // Recalcula a data de vencimento quando a data de fechamento muda
  useEffect(() => {
    if (autoCalculate && dataFechamento && vencimento?.planoEscolhido) {
      const novaDataVencimento = calcularDataVencimento(
        vencimento.planoEscolhido,
        parseISO(dataFechamento)
      );
      setDataVencimento(format(novaDataVencimento, 'yyyy-MM-dd'));
    }
  }, [dataFechamento, autoCalculate, vencimento?.planoEscolhido]);

  const handleSalvar = async () => {
    if (!vencimento) return;

    if (!dataFechamento || !dataVencimento) {
      toast.error('Preencha todas as datas');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('interacoes')
        .update({
          data_fechamento: dataFechamento,
          data_vencimento: dataVencimento,
        })
        .eq('id', vencimento.id);

      if (error) throw error;

      toast.success('Datas atualizadas com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar datas');
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
            <Pencil className="h-5 w-5 text-primary" />
            Editar Datas
          </DialogTitle>
          <DialogDescription>
            Altere as datas de fechamento e vencimento de {vencimento.nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">{vencimento.nome}</p>
            <p className="text-xs text-muted-foreground">
              Plano: {vencimento.planoEscolhido}
            </p>
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

          {/* Expiration date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="dataVencimento">Data de Vencimento</Label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCalculate}
                  onChange={(e) => setAutoCalculate(e.target.checked)}
                  className="rounded"
                />
                Calcular automático
              </label>
            </div>
            <Input
              id="dataVencimento"
              type="date"
              value={dataVencimento}
              onChange={(e) => {
                setAutoCalculate(false);
                setDataVencimento(e.target.value);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
