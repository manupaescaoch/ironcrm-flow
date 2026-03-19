import { Rotina, RotinaAtividade, RotinaExecucao } from '@/hooks/useRotinasData';
import { RotinaCard } from './RotinaCard';

interface Props {
  rotinas: Rotina[];
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

function getStatus(rotina: Rotina, atividades: RotinaAtividade[], execucoes: RotinaExecucao[]): string {
  const rotinaAtivs = atividades.filter(a => a.rotina_id === rotina.id);
  if (rotinaAtivs.length === 0) return 'pendente';
  const concluidas = rotinaAtivs.filter(a => execucoes.some(e => e.atividade_id === a.id && e.concluida));
  if (concluidas.length === rotinaAtivs.length) return 'concluida';
  if (concluidas.length > 0) return 'em_andamento';

  const now = new Date();
  const horaAtual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (rotina.horario_esperado && rotina.horario_esperado < horaAtual) return 'atrasada';
  return 'pendente';
}

const columns = [
  { key: 'pendente', label: 'Pendente', color: 'border-yellow-500' },
  { key: 'em_andamento', label: 'Em Andamento', color: 'border-blue-500' },
  { key: 'concluida', label: 'Concluída', color: 'border-green-500' },
  { key: 'atrasada', label: 'Atrasada', color: 'border-red-500' },
];

export function RotinasKanban({ rotinas, atividades, execucoes, onEdit, onDuplicate, onArchive, onDelete, onToggleExecucao, canEdit }: Props) {
  if (rotinas.length === 0) {
    return <p className="text-center text-muted-foreground py-12">Nenhuma rotina encontrada.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map(col => {
        const colRotinas = rotinas.filter(r => getStatus(r, atividades, execucoes) === col.key);
        return (
          <div key={col.key} className="space-y-3">
            <div className={`border-b-2 ${col.color} pb-2 flex items-center justify-between`}>
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{colRotinas.length}</span>
            </div>
            <div className="space-y-3">
              {colRotinas.map(rotina => (
                <RotinaCard
                  key={rotina.id}
                  rotina={rotina}
                  atividades={atividades}
                  execucoes={execucoes}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onToggleExecucao={onToggleExecucao}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
