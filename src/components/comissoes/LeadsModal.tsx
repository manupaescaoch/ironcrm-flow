import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExternalLink } from 'lucide-react';
import { InteracaoComLead } from './constants';
import { formatComissaoCurrency, formatComissaoDate } from '@/utils/comissoesMappers';

interface LeadsModalProps {
  selectedPerson: { name: string; type: 'cadastrador' | 'fechador' } | null;
  interacoes: InteracaoComLead[];
  onClose: () => void;
}

export const LeadsModal = memo(function LeadsModal({
  selectedPerson,
  interacoes,
  onClose,
}: LeadsModalProps) {
  const navigate = useNavigate();

  const leadsForModal = useMemo(() => {
    if (!selectedPerson) return [];
    
    return interacoes.filter((int) => {
      if (selectedPerson.type === 'cadastrador') {
        return int.lead_cadastrado_por === selectedPerson.name;
      } else {
        return int.responsavel_fechamento === selectedPerson.name;
      }
    });
  }, [selectedPerson, interacoes]);

  const handleNavigateToLead = (leadId: string) => {
    navigate(`/lead/${leadId}`);
  };

  return (
    <Dialog open={!!selectedPerson} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Leads de {selectedPerson?.name} ({selectedPerson?.type === 'cadastrador' ? 'Cadastrador' : 'Fechador'})
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {leadsForModal.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsForModal.map((int) => (
                  <TableRow key={int.id}>
                    <TableCell className="font-medium">{int.lead_nome}</TableCell>
                    <TableCell>{int.plano_escolhido || '-'}</TableCell>
                    <TableCell className="text-right">{formatComissaoCurrency(int.valor_plano || 0)}</TableCell>
                    <TableCell>{formatComissaoDate(int.data_fechamento)}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleNavigateToLead(int.lead_id)}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Ver Lead
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
