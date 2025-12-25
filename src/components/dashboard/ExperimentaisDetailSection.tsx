import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Eye, Trash2 } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { EventoItem } from '@/components/dashboard/EventosHoje';
import { STATUS_LABELS, STATUS_COLORS } from '@/components/dashboard/constants';
import { formatDate } from '@/utils/dashboardMappers';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Lead } from '@/types/database';

interface ExperimentaisDetailSectionProps {
  items: EventoItem[];
  startDate: Date;
  endDate: Date;
  onClose: () => void;
  onDelete: (interacaoId: string) => void;
  isAdmin: boolean;
  canEditLead: (lead: Lead) => boolean;
}

export const ExperimentaisDetailSection = memo(function ExperimentaisDetailSection({
  items,
  startDate,
  endDate,
  onClose,
  onDelete,
  isAdmin,
  canEditLead,
}: ExperimentaisDetailSectionProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            Experimentais no Período
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma aula experimental agendada nesse período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Atendido Por</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.interacao.id}>
                    <TableCell className="font-medium">{item.lead.nome?.toUpperCase()}</TableCell>
                    <TableCell>
                      <WhatsAppLink phone={item.lead.telefone} />
                    </TableCell>
                    <TableCell>{formatDate(item.interacao.data_experimental)}</TableCell>
                    <TableCell>{item.interacao.hora_experimental || '-'}</TableCell>
                    <TableCell>{item.interacao.atendido_por || '-'}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", STATUS_COLORS[item.lead.status_funil] || 'bg-gray-100 text-gray-700')}>
                        {STATUS_LABELS[item.lead.status_funil] || item.lead.status_funil}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/lead/${item.lead.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {canEditLead(item.lead) ? 'Ver / Editar' : 'Ver'}
                        </Button>
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Experimental</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover esta aula experimental de {item.lead.nome}? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(item.interacao.id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
