import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
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
import { InlineEditableDate } from './InlineEditableDate';
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
                  <InlineEditableDate
                    date={item.dataFechamento}
                    field="data_fechamento"
                    interacaoId={item.id}
                    onSuccess={handleSuccess}
                  />
                </TableCell>
                <TableCell>
                  <InlineEditableDate
                    date={item.dataVencimento}
                    field="data_vencimento"
                    interacaoId={item.id}
                    onSuccess={handleSuccess}
                  />
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
                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-1.5 py-1">
                      {/* Ação de Contato */}
                      {item.telefone && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const normalizedPhone = item.telefone!.replace(/\D/g, '');
                                  const phone = normalizedPhone.startsWith('55') ? normalizedPhone : '55' + normalizedPhone;
                                  const message = encodeURIComponent(`Olá ${item.nome}! Tudo bem? Notamos que seu plano ${item.planoEscolhido} está próximo do vencimento. Podemos conversar sobre a renovação?`);
                                  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                                }}
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100/50 transition-all hover:scale-105"
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Abrir WhatsApp</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Separador Visual */}
                      <Separator orientation="vertical" className="h-5 mx-0.5" />

                      {/* Ações de Gestão */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditar(item)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground transition-all hover:scale-105"
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
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 transition-all hover:scale-105"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Renovar matrícula</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="h-8 w-8 text-muted-foreground hover:text-foreground transition-all hover:scale-105"
                            >
                              <Link to={`/lead/${item.leadId}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver detalhes</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
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
