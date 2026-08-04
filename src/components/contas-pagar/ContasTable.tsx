import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CalendarClock, Check, Copy, Eye, Loader2, Loader, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  ContaPagar,
  ContaStatusView,
  formatCurrency,
  formatDateBR,
  labelFormaPagamento,
  labelPrioridade,
  labelStatus,
  prioridadeBadgeClass,
  statusBadgeClass,
} from './constants';

interface Props {
  contas: ContaPagar[];
  isLoading: boolean;
  statusDe: (conta: ContaPagar) => ContaStatusView;
  canManage: boolean;
  onVer: (conta: ContaPagar) => void;
  onEditar: (conta: ContaPagar) => void;
  onDarBaixa: (conta: ContaPagar) => void;
  onReagendar: (conta: ContaPagar) => void;
  onExcluir: (conta: ContaPagar) => void;
}

export function ContasTable({
  contas,
  isLoading,
  statusDe,
  canManage,
  onVer,
  onEditar,
  onDarBaixa,
  onReagendar,
  onExcluir,
}: Props) {
  const { toast } = useToast();

  const copiarPagamento = async (conta: ContaPagar) => {
    const value = conta.codigo_pix || conta.linha_digitavel || conta.chave_pix || conta.codigo_barras;
    if (!value) {
      toast({ title: 'Esta conta não possui dados de pagamento.', variant: 'destructive' });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Dados de pagamento copiados.' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const AcoesMenu = ({ conta }: { conta: ContaPagar }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" title="Ações" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {canManage && conta.status === 'pendente' && (
          <DropdownMenuItem onClick={() => onDarBaixa(conta)}>
            <Check className="w-4 h-4 mr-2" /> Marcar como Pago
          </DropdownMenuItem>
        )}
        {canManage && (
          <DropdownMenuItem onClick={() => onEditar(conta)}>
            <Pencil className="w-4 h-4 mr-2" /> Editar
          </DropdownMenuItem>
        )}
        {canManage && (
          <DropdownMenuItem onClick={() => onReagendar(conta)}>
            <CalendarClock className="w-4 h-4 mr-2" /> Reagendar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onVer(conta)}>
          <Eye className="w-4 h-4 mr-2" /> Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copiarPagamento(conta)}>
          <Copy className="w-4 h-4 mr-2" /> Copiar dados de pagamento
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onExcluir(conta)}>
              <Trash2 className="w-4 h-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isLoading) {
    return (
      <Card className="p-10 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (contas.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Nenhuma conta encontrada para os filtros selecionados.
      </Card>
    );
  }

  return (
    <>
      {/* Desktop */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map((conta) => {
                const status = statusDe(conta);
                return (
                  <TableRow key={conta.id} className="cursor-pointer" onClick={() => onVer(conta)}>
                    <TableCell className="font-medium max-w-[220px] truncate">{conta.descricao}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">{conta.fornecedor || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{conta.categoria || '—'}</TableCell>
                    <TableCell>{formatDateBR(conta.data_vencimento)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(Number(conta.valor))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', statusBadgeClass(status))}>
                        {labelStatus(status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', prioridadeBadgeClass(conta.prioridade))}>
                        {labelPrioridade(conta.prioridade)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {labelFormaPagamento(conta.forma_pagamento)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <AcoesMenu conta={conta} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {contas.map((conta) => {
          const status = statusDe(conta);
          return (
            <Card key={conta.id} className="p-3 space-y-2" onClick={() => onVer(conta)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{conta.descricao}</p>
                  <p className="text-xs text-muted-foreground truncate">{conta.fornecedor || ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className={cn('text-xs', statusBadgeClass(status))}>
                    {labelStatus(status)}
                  </Badge>
                  <div onClick={(e) => e.stopPropagation()}>
                    <AcoesMenu conta={conta} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{formatCurrency(Number(conta.valor))}</span>
                <span className="text-muted-foreground">venc. {formatDateBR(conta.data_vencimento)}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
