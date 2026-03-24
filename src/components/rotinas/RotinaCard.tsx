import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Copy, Archive, ArchiveRestore, Trash2, Clock, User } from 'lucide-react';
import { Rotina, RotinaAtividade, RotinaExecucao, PRIORIDADES_ROTINA, FREQUENCIAS } from '@/hooks/useRotinasData';
import { cn } from '@/lib/utils';

interface Props {
  rotina: Rotina;
  atividades: RotinaAtividade[];
  execucoes: RotinaExecucao[];
  onEdit: (rotina: Rotina) => void;
  onDuplicate: (rotina: Rotina) => void;
  onArchive: (rotina: Rotina) => void;
  onDelete: (rotina: Rotina) => void;
  onToggleExecucao: (rotinaId: string, atividadeId: string | null, concluida: boolean) => void;
  canEdit: boolean;
  isAdmin?: boolean;
}

export function RotinaCard({ rotina, atividades, execucoes, onEdit, onDuplicate, onArchive, onDelete, onToggleExecucao, canEdit, isAdmin }: Props) {
  const rotinaAtividades = atividades.filter(a => a.rotina_id === rotina.id);
  const prioridadeInfo = PRIORIDADES_ROTINA.find(p => p.value === rotina.prioridade);
  const frequenciaLabel = FREQUENCIAS.find(f => f.value === rotina.frequencia)?.label || rotina.frequencia;

  const now = new Date();
  const horaAtual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const isAtrasada = rotina.horario_esperado && rotina.horario_esperado < horaAtual && rotinaAtividades.some(a => {
    return !execucoes.some(e => e.atividade_id === a.id && e.concluida);
  });

  const totalAtividades = rotinaAtividades.length;
  const concluidasCount = rotinaAtividades.filter(a => execucoes.some(e => e.atividade_id === a.id && e.concluida)).length;
  const allDone = totalAtividades > 0 && concluidasCount === totalAtividades;

  return (
    <Card className={cn(
      'transition-all',
      isAtrasada && 'border-destructive/50 bg-destructive/5',
      allDone && 'border-green-500/50 bg-green-500/5',
      rotina.arquivada && 'opacity-60'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{rotina.nome}</CardTitle>
            {rotina.descricao && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rotina.descricao}</p>
            )}
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(rotina)}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(rotina)}><Copy className="w-4 h-4 mr-2" />Duplicar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive(rotina)}>
                  {rotina.arquivada ? <ArchiveRestore className="w-4 h-4 mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
                  {rotina.arquivada ? 'Desarquivar' : 'Arquivar'}
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={() => onDelete(rotina)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge variant="outline" className={prioridadeInfo?.color}>{prioridadeInfo?.label}</Badge>
          <Badge variant="secondary" className="text-xs">{frequenciaLabel}</Badge>
          {rotina.horario_esperado && (
            <Badge variant="outline" className="text-xs gap-1"><Clock className="w-3 h-3" />{rotina.horario_esperado.slice(0, 5)}</Badge>
          )}
          {isAtrasada && <Badge variant="destructive" className="text-xs">Atrasada</Badge>}
          {allDone && <Badge className="bg-green-600 text-xs">Concluída</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {rotina.responsavel_principal && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <User className="w-3 h-3" />{rotina.responsavel_principal}
          </div>
        )}
        {rotinaAtividades.length > 0 ? (
          <div className="space-y-1.5">
            {rotinaAtividades.map(atividade => {
              const exec = execucoes.find(e => e.atividade_id === atividade.id && e.concluida);
              return (
                <div key={atividade.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={!!exec}
                    onCheckedChange={(checked) => onToggleExecucao(rotina.id, atividade.id, !!checked)}
                  />
                  <span className={cn('text-sm flex-1', exec && 'line-through text-muted-foreground')}>{atividade.titulo}</span>
                  {exec?.concluida_por && (
                    <span className="text-[10px] text-muted-foreground">{exec.concluida_por}</span>
                  )}
                </div>
              );
            })}
            <div className="text-xs text-muted-foreground mt-1">
              {concluidasCount}/{totalAtividades} concluídas
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Sem atividades cadastradas</p>
        )}
      </CardContent>
    </Card>
  );
}
