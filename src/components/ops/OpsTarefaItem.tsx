import { Clock, User, Paperclip, ChevronRight } from 'lucide-react';
import { OpsStatusBadge } from '@/components/ops/OpsStatusBadge';
import { AtividadeExecucaoPanel } from '@/components/ops/AtividadeExecucaoPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { OpsTarefaDoDia } from '@/hooks/useOpsMeuDia';
import { cn } from '@/lib/utils';

export const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  critica: 'Crítica',
};

export const PRIORIDADE_DOT: Record<string, string> = {
  baixa: 'bg-emerald-500',
  normal: 'bg-primary',
  alta: 'bg-amber-500',
  critica: 'bg-destructive',
};

export function OpsTarefaRow({ tarefa, onClick }: { tarefa: OpsTarefaDoDia; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/40"
    >
      <div className="w-14 shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {tarefa.horario ? tarefa.horario.slice(0, 5) : '--:--'}
        </p>
        <span
          className={cn('mt-1 block h-1.5 w-1.5 rounded-full', PRIORIDADE_DOT[tarefa.prioridade || 'normal'])}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tarefa.titulo}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {tarefa.responsavel_nome && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {tarefa.responsavel_nome}
            </span>
          )}
          {tarefa.setor && <span>{tarefa.setor}</span>}
          {tarefa.prazo && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> até {tarefa.prazo.slice(0, 5)}
            </span>
          )}
          {tarefa.exige_evidencia && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> evidência
            </span>
          )}
          {tarefa.prioridade === 'critica' && <span className="font-medium text-destructive">Crítica</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <OpsStatusBadge status={tarefa.status} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

export function OpsTarefaSheet({
  tarefa,
  data,
  onClose,
}: {
  tarefa: OpsTarefaDoDia | null;
  data: Date;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!tarefa} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="ops-theme max-h-[92vh] overflow-y-auto rounded-t-3xl">
        {tarefa && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="pr-8 text-base">{tarefa.titulo}</SheetTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {tarefa.horario && <span>{tarefa.horario.slice(0, 5)}</span>}
                {tarefa.responsavel_nome && <span>{tarefa.responsavel_nome}</span>}
                {tarefa.setor && <span>{tarefa.setor}</span>}
                <span>Prioridade: {PRIORIDADE_LABEL[tarefa.prioridade || 'normal']}</span>
              </div>
            </SheetHeader>

            {tarefa.descricao && (
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{tarefa.descricao}</p>
            )}

            <div className="mt-4">
              <AtividadeExecucaoPanel
                atividadeId={tarefa.id}
                unidadeId={tarefa.unidade_id}
                data={data}
                horario={tarefa.horario}
                prazo={tarefa.prazo}
                exigeEvidencia={tarefa.exige_evidencia}
                exigeConfirmacao={tarefa.exige_confirmacao}
                instrucao={tarefa.instrucao}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
