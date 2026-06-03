import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2 } from 'lucide-react';
import { UNIDADE_NAO_DEFINIDA_ID } from '@/lib/crm';

interface Props {
  leadId: string;
  unidadeAtual: string;
  isAdmin: boolean;
  onChanged: (novaUnidadeId: string) => void;
}

interface UnidadeOpt {
  id: string;
  nome: string;
}

export function AlterarUnidadeButton({ leadId, unidadeAtual, isAdmin, onChanged }: Props) {
  const { toast } = useToast();
  const [unidades, setUnidades] = useState<UnidadeOpt[]>([]);
  const [selected, setSelected] = useState(unidadeAtual);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('unidades')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      setUnidades(data || []);
    })();
  }, []);

  async function handleSave() {
    if (selected === unidadeAtual) return;
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ unidade_id: selected } as any)
      .eq('id', leadId);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao alterar unidade', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Unidade atualizada' });
    onChanged(selected);
  }

  const opcoes = unidades.filter((u) => isAdmin || u.id !== UNIDADE_NAO_DEFINIDA_ID);

  return (
    <div className="flex items-center gap-2">
      <Building2 className="w-4 h-4 text-muted-foreground" />
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.id === UNIDADE_NAO_DEFINIDA_ID ? 'Não definida' : u.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected !== unidadeAtual && (
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Salvar
        </Button>
      )}
    </div>
  );
}
