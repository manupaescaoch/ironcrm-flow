import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContaPagar, formatDateBR } from './constants';

interface Props {
  conta: ContaPagar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (novaData: string) => Promise<void> | void;
  saving?: boolean;
}

export function ReagendarModal({ conta, open, onOpenChange, onConfirm, saving }: Props) {
  const [data, setData] = useState('');

  useEffect(() => {
    if (open && conta) setData(conta.data_vencimento?.slice(0, 10) || '');
  }, [open, conta]);

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reagendar vencimento</DialogTitle>
          <DialogDescription>
            {conta.descricao} · vencimento atual {formatDateBR(conta.data_vencimento)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="nova-data">Novo vencimento</Label>
          <Input id="nova-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!data || saving} onClick={() => onConfirm(data)}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
