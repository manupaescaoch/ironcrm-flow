import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Award, Eye, Trash2 } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { MatriculaItem } from '@/components/dashboard/constants';
import { formatDate, formatCurrency } from '@/utils/dashboardMappers';
import { format } from 'date-fns';
import { Lead } from '@/types/database';

interface MatriculasDetailSectionProps {
  items: MatriculaItem[];
  startDate: Date;
  endDate: Date;
  onClose: () => void;
  onDelete: (interacaoId: string) => void;
  isAdmin: boolean;
  canEditLead: (lead: Lead) => boolean;
}

export const MatriculasDetailSection = memo(function MatriculasDetailSection({
  items,
  startDate,
  endDate,
  onClose,
  onDelete,
  isAdmin,
  canEditLead,
}: MatriculasDetailSectionProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Matrículas no Período
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
            <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma matrícula registrada nesse período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Cadastrado Por</TableHead>
                  <TableHead>Resp. Fechamento</TableHead>
                  <TableHead>Treinador</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.interacao.id}>
                    <TableCell>{formatDate(item.interacao.data_fechamento)}</TableCell>
                    <TableCell className="font-medium">{item.lead.nome?.toUpperCase()}</TableCell>
                    <TableCell>
                      <WhatsAppLink phone={item.lead.telefone} />
                    </TableCell>
                    <TableCell>{item.lead.origem || '-'}</TableCell>
                    <TableCell>{item.lead.cadastrado_por || '-'}</TableCell>
                    <TableCell>{item.interacao.responsavel_fechamento || '-'}</TableCell>
                    <TableCell>{item.interacao.treinador_responsavel || '-'}</TableCell>
                    <TableCell>
                      {item.interacao.plano_escolhido ? (
                        <Badge variant="outline">{item.interacao.plano_escolhido}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatCurrency(item.interacao.valor_plano)}
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
                                <AlertDialogTitle>Remover Matrícula</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover a matrícula de {item.lead.nome}? Esta ação não pode ser desfeita.
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
