import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCronogramaHistorico } from '@/hooks/useCronogramaAdmin';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

export function HistoricoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data = [], isLoading } = useCronogramaHistorico(open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico de alterações</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma alteração registrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Usuário</th>
                  <th className="text-left p-2">Atividade</th>
                  <th className="text-left p-2">Campo</th>
                  <th className="text-left p-2">Antes → Depois</th>
                </tr>
              </thead>
              <tbody>
                {data.map((h: any) => (
                  <tr key={h.id} className="border-b hover:bg-muted/40">
                    <td className="p-2 whitespace-nowrap text-xs">{format(new Date(h.created_at), "dd/MM HH:mm", { locale: ptBR })}</td>
                    <td className="p-2 text-xs">{h.user_name}</td>
                    <td className="p-2 text-xs truncate max-w-[180px]" title={h.atividade_titulo}>{h.atividade_titulo || '—'}</td>
                    <td className="p-2 text-xs"><code>{h.campo}</code></td>
                    <td className="p-2 text-xs">
                      <span className="text-muted-foreground line-through">{h.valor_anterior || '∅'}</span>
                      {' → '}
                      <span className="font-medium">{h.valor_novo || '∅'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
