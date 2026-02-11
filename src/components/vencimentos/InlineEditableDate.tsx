import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InlineEditableDateProps {
  date: Date;
  field: 'data_fechamento' | 'data_vencimento';
  interacaoId: string;
  onSuccess: () => void;
}

export function InlineEditableDate({ date, field, interacaoId, onSuccess }: InlineEditableDateProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(format(date, 'yyyy-MM-dd'));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = async () => {
    if (!value || value === format(date, 'yyyy-MM-dd')) {
      setEditing(false);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('interacoes')
      .update({ [field]: value })
      .eq('id', interacaoId);

    setSaving(false);

    if (error) {
      toast.error('Erro ao salvar data');
      setValue(format(date, 'yyyy-MM-dd'));
    } else {
      toast.success('Data atualizada com sucesso');
      onSuccess();
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setValue(format(date, 'yyyy-MM-dd'));
      setEditing(false);
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
      <Input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-8 w-[140px] text-sm border-primary/50 focus-visible:ring-primary/30"
      />
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
      <span>{format(date, 'dd/MM/yyyy', { locale: ptBR })}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
