import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ContaPagar, formatCurrency, formatDateBR } from './constants';

interface Props {
  open: boolean;
  duplicados: ContaPagar[];
  canForce: boolean;
  onVerExistente: (conta: ContaPagar) => void;
  onCancelar: () => void;
  onCadastrarMesmoAssim: () => void;
  saving?: boolean;
}

export function DuplicidadeDialog({
  open,
  duplicados,
  canForce,
  onVerExistente,
  onCancelar,
  onCadastrarMesmoAssim,
  saving,
}: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Já existe uma conta semelhante cadastrada nesta unidade.</AlertDialogTitle>
          <AlertDialogDescription>Confira os dados antes de continuar.</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {duplicados.map((c) => (
            <div key={c.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.descricao}</p>
                  <p className="text-muted-foreground text-xs">{c.fornecedor}</p>
                  <p className="text-xs mt-1">
                    {formatCurrency(Number(c.valor))} • venc. {formatDateBR(c.data_vencimento)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onVerExistente(c)}>
                  Ver conta existente
                </Button>
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancelar}>Cancelar</AlertDialogCancel>
          {canForce && (
            <AlertDialogAction onClick={onCadastrarMesmoAssim} disabled={saving}>
              Cadastrar mesmo assim
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
