import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RelatorioMes {
  id: string;
  mes_ano: string;
  ativos: number;
  adimplentes: number;
  inadimplentes: number;
  vip: number;
  suspensos: number;
  cancelamentos: number;
  renovacoes: number;
  churn_percentual: number;
  tempo_medio_vida: number;
  capacidade_zn: number;
}

interface TabelaHistoricoProps {
  dados: RelatorioMes[];
  isAdmin: boolean;
  onEdit: (record: RelatorioMes) => void;
  onDelete: (id: string) => void;
}

export function TabelaHistorico({ dados, isAdmin, onEdit, onDelete }: TabelaHistoricoProps) {
  const formatMesAno = (mesAno: string) => {
    const date = parse(mesAno, 'yyyy-MM', new Date());
    return format(date, 'MMM/yyyy', { locale: ptBR });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico Mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês/Ano</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Adimplentes</TableHead>
                <TableHead className="text-right">Inadimplentes</TableHead>
                <TableHead className="text-right">VIP</TableHead>
                <TableHead className="text-right">Suspensos</TableHead>
                <TableHead className="text-right">Churn</TableHead>
                <TableHead className="text-right">Tempo Vida</TableHead>
                <TableHead className="text-right">Cancel.</TableHead>
                <TableHead className="text-right">Renov.</TableHead>
                <TableHead className="text-right">Ocupação</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.map((item, index) => {
                const ocupacao = ((item.ativos / item.capacidade_zn) * 100).toFixed(1);
                const isLast = index === dados.length - 1;
                
                return (
                  <TableRow key={item.id} className={isLast ? 'bg-muted/50 font-medium' : ''}>
                    <TableCell className="font-medium">{formatMesAno(item.mes_ano)}</TableCell>
                    <TableCell className="text-right">{item.ativos}</TableCell>
                    <TableCell className="text-right">{item.adimplentes}</TableCell>
                    <TableCell className="text-right">{item.inadimplentes}</TableCell>
                    <TableCell className="text-right">{item.vip}</TableCell>
                    <TableCell className="text-right">{item.suspensos}</TableCell>
                    <TableCell className="text-right">{item.churn_percentual}%</TableCell>
                    <TableCell className="text-right">{item.tempo_medio_vida}</TableCell>
                    <TableCell className="text-right">{item.cancelamentos}</TableCell>
                    <TableCell className="text-right">{item.renovacoes}</TableCell>
                    <TableCell className="text-right">{ocupacao}%</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => onEdit(item as any)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => onDelete(item.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
