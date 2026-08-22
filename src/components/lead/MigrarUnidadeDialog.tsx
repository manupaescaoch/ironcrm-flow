import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface MigrarUnidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadNome: string;
  unidadeAtualId: string | null;
  onMigrated: (novaUnidadeId: string) => void;
}

export function MigrarUnidadeDialog({
  open,
  onOpenChange,
  leadId,
  leadNome,
  unidadeAtualId,
  onMigrated,
}: MigrarUnidadeDialogProps) {
  const { unidadesPermitidas } = useUnidade();
  const { toast } = useToast();
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const opcoes = unidadesPermitidas.filter((u) => u.id !== unidadeAtualId);
  const nomeOrigem = unidadesPermitidas.find((u) => u.id === unidadeAtualId)?.nome;

  const handleMigrar = async () => {
    if (!destino) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('migrar_lead_unidade', {
        p_lead_id: leadId,
        p_unidade_destino: destino,
        p_motivo: motivo.trim() || null,
      });

      if (error) throw error;

      toast({
        title: 'Lead migrado',
        description: `${leadNome} agora pertence a ${opcoes.find((u) => u.id === destino)?.nome}.`,
      });
      onMigrated(destino);
      onOpenChange(false);
      setDestino('');
      setMotivo('');
    } catch (err: any) {
      toast({
        title: 'Não foi possível migrar',
        description: err?.message || 'Erro inesperado ao migrar o lead.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Migrar unidade</DialogTitle>
          <DialogDescription>
            Transfere {leadNome} {nomeOrigem ? `de ${nomeOrigem} ` : ''}para outra unidade, junto
            com interações e follow-ups.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Unidade de destino</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {opcoes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Você não tem acesso a outra unidade para migrar este lead.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: conheceu na Madalena e vai se matricular em Boa Viagem"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleMigrar} disabled={!destino || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Migrar lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
