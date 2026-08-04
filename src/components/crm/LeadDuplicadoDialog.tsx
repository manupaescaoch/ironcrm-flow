import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export interface LeadDuplicado {
  id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  created_at?: string | null;
  cadastrado_por?: string | null;
}

interface Props {
  open: boolean;
  lead: LeadDuplicado | null;
  onAbrirLead: (lead: LeadDuplicado) => void;
  onReativar?: (lead: LeadDuplicado) => void;
  onCancelar: () => void;
  reativando?: boolean;
}

export function LeadDuplicadoDialog({
  open,
  lead,
  onAbrirLead,
  onReativar,
  onCancelar,
  reativando,
}: Props) {
  if (!lead) return null;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Lead já existe</AlertDialogTitle>
          <AlertDialogDescription>
            Este telefone já está cadastrado nesta unidade. O cadastro foi bloqueado para evitar
            duplicidade.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border p-3 text-sm space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{lead.nome}</p>
            <Badge variant={lead.ativo ? 'default' : 'secondary'}>
              {lead.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs">{lead.telefone || 'sem telefone'}</p>
          {lead.created_at && (
            <p className="text-xs text-muted-foreground">
              Cadastrado em {format(new Date(lead.created_at), 'dd/MM/yyyy')}
              {lead.cadastrado_por ? ` por ${lead.cadastrado_por}` : ''}
            </p>
          )}
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onCancelar}>Cancelar</AlertDialogCancel>
          {!lead.ativo && onReativar && (
            <Button variant="outline" onClick={() => onReativar(lead)} disabled={reativando}>
              Reativar lead
            </Button>
          )}
          <Button onClick={() => onAbrirLead(lead)}>Abrir lead existente</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
