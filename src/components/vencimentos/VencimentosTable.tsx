import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { VencimentoBadge } from './VencimentoBadge';
import { RenovacaoModal } from './RenovacaoModal';
import { EditarVencimentoModal } from './EditarVencimentoModal';
import { ConfirmarPagamentoModal } from './ConfirmarPagamentoModal';
import { VencimentoItem } from '@/hooks/useVencimentosData';
import { cn } from '@/lib/utils';

interface VencimentosTableProps {
  vencimentos: VencimentoItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function VencimentosTable({ vencimentos, isLoading, onRefresh }: VencimentosTableProps) {
  const [renovacaoModalOpen, setRenovacaoModalOpen] = useState(false);
  const [editarModalOpen, setEditarModalOpen] = useState(false);
  const [confirmarPagamentoModalOpen, setConfirmarPagamentoModalOpen] = useState(false);
  const [selectedVencimento, setSelectedVencimento] = useState<VencimentoItem | null>(null);

  const handleRenovar = (item: VencimentoItem) => {
    setSelectedVencimento(item);
    setRenovacaoModalOpen(true);
  };

  const handleEditar = (item: VencimentoItem) => {
    setSelectedVencimento(item);
    setEditarModalOpen(true);
  };

  const handleConfirmarPagamento = (item: VencimentoItem) => {
    setSelectedVencimento(item);
    setConfirmarPagamentoModalOpen(true);
  };

  const handleSuccess = () => {
    onRefresh?.();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (vencimentos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum vencimento encontrado com os filtros selecionados.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Aluno</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Fechamento</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vencimentos.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.nome}</span>
                    {item.telefone && (
                      <span className="text-sm text-muted-foreground">{item.telefone}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{item.planoEscolhido}</TableCell>
                <TableCell>
                  {format(item.dataFechamento, 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  {format(item.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <VencimentoBadge status={item.status} diasRestantes={item.diasRestantes} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {/* Status de pagamento */}
                    {item.pagamentoConfirmado ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Pago
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Pagamento Confirmado</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConfirmarPagamento(item)}
                        className={cn(
                          'gap-1.5 h-7 px-2.5 text-xs font-medium border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 hover:border-emerald-500',
                          item.status === 'inadimplente' && 'animate-pulse border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive'
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {item.status === 'inadimplente' ? 'Confirmar' : 'Confirmar'}
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditar(item)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar datas</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRenovar(item)}
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Renovar matrícula</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {item.telefone && (
                      <WhatsAppLink
                        phone={item.telefone}
                        message={`Olá ${item.nome}! Tudo bem? Notamos que seu plano ${item.planoEscolhido} está próximo do vencimento. Podemos conversar sobre a renovação?`}
                        iconOnly
                      />
                    )}

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link to={`/lead/${item.leadId}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver detalhes</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RenovacaoModal
        open={renovacaoModalOpen}
        onOpenChange={setRenovacaoModalOpen}
        vencimento={selectedVencimento}
        onSuccess={handleSuccess}
      />

      <EditarVencimentoModal
        open={editarModalOpen}
        onOpenChange={setEditarModalOpen}
        vencimento={selectedVencimento}
        onSuccess={handleSuccess}
      />

      <ConfirmarPagamentoModal
        open={confirmarPagamentoModalOpen}
        onOpenChange={setConfirmarPagamentoModalOpen}
        vencimento={selectedVencimento}
        onSuccess={handleSuccess}
      />
    </>
  );
}
