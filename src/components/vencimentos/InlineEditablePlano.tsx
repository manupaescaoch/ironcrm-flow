import { useState } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';
import { cn } from '@/lib/utils';

const PLANOS_DISPONIVEIS = [
  'MENSAL',
  'EXECUTIVO MENSAL',
  'TRIMESTRAL',
  'SEMESTRAL',
  'ANUAL',
  'EXECUTIVO ANUAL',
];

const calcularNovaDataVencimento = (plano: string, dataFechamento: Date): string | null => {
  const p = plano.toLowerCase().trim();
  let meses = 0;
  if (p.includes('mensal')) meses = 1;
  else if (p.includes('trimestral')) meses = 3;
  else if (p.includes('semestral')) meses = 6;
  else if (p.includes('anual')) meses = 12;
  else return null;
  return format(addMonths(dataFechamento, meses), 'yyyy-MM-dd');
};

interface InlineEditablePlanoProps {
  plano: string;
  interacaoId: string;
  dataFechamento: Date;
  onSuccess: () => void;
}

export function InlineEditablePlano({ plano, interacaoId, dataFechamento, onSuccess }: InlineEditablePlanoProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (novoPlano: string) => {
    if (novoPlano === plano) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setEditing(false);

    const novaDataVencimento = calcularNovaDataVencimento(novoPlano, dataFechamento);

    const updateData: Record<string, string> = { plano_escolhido: novoPlano };
    if (novaDataVencimento) {
      updateData.data_vencimento = novaDataVencimento;
    }

    const { error } = await supabase
      .from('interacoes')
      .update(updateData)
      .eq('id', interacaoId);

    setSaving(false);

    if (error) {
      toast.error('Erro ao atualizar plano');
    } else {
      toast.success('Plano atualizado com sucesso');
      onSuccess();
    }
  };

  if (saving) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-sm">Salvando...</span>
      </div>
    );
  }

  if (editing) {
    return (
      <Select defaultValue={plano} onValueChange={handleSelect} open={true} onOpenChange={(open) => { if (!open) setEditing(false); }}>
        <SelectTrigger className="h-8 w-[180px] text-sm border-primary/50 focus-visible:ring-primary/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLANOS_DISPONIVEIS.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        'group flex items-center gap-1.5 text-sm rounded-md px-1.5 py-0.5 -mx-1.5',
        'hover:bg-muted/60 transition-colors cursor-pointer'
      )}
    >
      <span>{plano}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
