import { Rotina, RotinaAtividade, RotinaExecucao, SETORES } from '@/hooks/useRotinasData';
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
}

export function RotinasLista({ rotinas, atividades, execucoes, onEdit, onDuplicate, onArchive, onDelete, onToggleExecucao, canEdit }: Props) {
  const setoresComRotinas = SETORES.filter(s => rotinas.some(r => r.setor === s));
  const outrosSetores = [...new Set(rotinas.map(r => r.setor).filter(s => !SETORES.includes(s as any)))];
  const todosSetores = [...setoresComRotinas, ...outrosSetores];

  if (rotinas.length === 0) {
    return <p className="text-center text-muted-foreground py-12">Nenhuma rotina encontrada.</p>;
  }

  return (
    <div className="space-y-8">
      {todosSetores.map(setor => {
        const setorRotinas = rotinas.filter(r => r.setor === setor);
        if (setorRotinas.length === 0) return null;
        return (
          <div key={setor}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {setor}
              <span className="text-sm font-normal text-muted-foreground">({setorRotinas.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {setorRotinas.map(rotina => (
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
