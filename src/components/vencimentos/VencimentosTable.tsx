import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw } from 'lucide-react';
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
import { VencimentoItem } from '@/hooks/useVencimentosData';

interface VencimentosTableProps {
  vencimentos: VencimentoItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function VencimentosTable({ vencimentos, isLoading, onRefresh }: VencimentosTableProps) {
  const [renovacaoModalOpen, setRenovacaoModalOpen] = useState(false);
  const [selectedVencimento, setSelectedVencimento] = useState<VencimentoItem | null>(null);

  const handleRenovar = (item: VencimentoItem) => {
    setSelectedVencimento(item);
    setRenovacaoModalOpen(true);
  };

  const handleRenovacaoSuccess = () => {
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
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Fechamento</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
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
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRenovar(item)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
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
                          <Button variant="ghost" size="icon" asChild>
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
        onSuccess={handleRenovacaoSuccess}
      />
    </>
  );
}
