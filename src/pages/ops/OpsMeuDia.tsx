import { useMemo, useState } from 'react';
import { Loader2, Clock, User, Paperclip, ChevronRight, CheckCircle2 } from 'lucide-react';
import { OpsLayout } from '@/components/ops/OpsLayout';
import { OpsStatusBadge } from '@/components/ops/OpsStatusBadge';
import { AtividadeExecucaoPanel } from '@/components/ops/AtividadeExecucaoPanel';
import { useOpsMeuDia, type OpsEscopo, type OpsTarefaDoDia } from '@/hooks/useOpsMeuDia';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function saudacao(hora: number) {
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  critica: 'Crítica',
};

const PRIORIDADE_DOT: Record<string, string> = {
  baixa: 'bg-emerald-500',
  normal: 'bg-primary',
  alta: 'bg-amber-500',
  critica: 'bg-destructive',
};

function ResumoCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm">
      <p className={cn('text-2xl font-semibold tabular-nums', tone)}>{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function TarefaRow({ tarefa, onClick }: { tarefa: OpsTarefaDoDia; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/40"
    >
      <div className="w-14 shrink-0">
        <p className="text-sm font-semibold tabular-nums">{tarefa.horario ? tarefa.horario.slice(0, 5) : '--:--'}</p>
        <span className={cn('mt-1 block h-1.5 w-1.5 rounded-full', PRIORIDADE_DOT[tarefa.prioridade || 'normal'])} />
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

export default function OpsMeuDia() {
  const { userName } = useAuth();
  const [escopo, setEscopo] = useState<OpsEscopo>('minhas');
  const hoje = useMemo(() => new Date(), []);
  const { tarefas, resumo, temVinculo, isLoading, refetch } = useOpsMeuDia(escopo, hoje);
  const [selecionada, setSelecionada] = useState<OpsTarefaDoDia | null>(null);

  const dataLabel = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const nome = userName ? userName.charAt(0).toUpperCase() + userName.slice(1) : '';

  return (
    <OpsLayout title="Meu Dia">
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {saudacao(hoje.getHours())}{nome ? `, ${nome}` : ''}
          </h2>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{dataLabel}</p>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-4 gap-2">
          <ResumoCard label="Hoje" value={resumo.total} />
          <ResumoCard label="Feitas" value={resumo.concluidas} tone="text-emerald-600" />
          <ResumoCard label="Em curso" value={resumo.emAndamento} tone="text-primary" />
          <ResumoCard label="Atrasadas" value={resumo.atrasadas} tone="text-destructive" />
        </div>

        {/* Escopo */}
        {temVinculo && (
          <div className="inline-flex rounded-full bg-muted p-1 text-xs font-medium">
            {(['minhas', 'unidade'] as OpsEscopo[]).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setEscopo(op)}
                className={cn(
                  'rounded-full px-3 py-1.5 transition-colors',
                  escopo === op ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {op === 'minhas' ? 'Minhas tarefas' : 'Toda a unidade'}
              </button>
            ))}
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tarefas.length === 0 ? (
          <div className="rounded-2xl bg-card p-10 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-3 text-sm font-medium">Nada previsto para hoje</p>
            <p className="mt-1 text-xs text-muted-foreground">Sem atividades no cronograma deste dia.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tarefas.map((t) => (
              <TarefaRow key={t.id} tarefa={t} onClick={() => setSelecionada(t)} />
            ))}
          </div>
        )}
      </div>

      {/* Detalhe da tarefa */}
      <Sheet
        open={!!selecionada}
        onOpenChange={(o) => {
          if (!o) {
            setSelecionada(null);
            refetch();
          }
        }}
      >
        <SheetContent side="bottom" className="ops-theme max-h-[92vh] overflow-y-auto rounded-t-3xl">
          {selecionada && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="pr-8 text-base">{selecionada.titulo}</SheetTitle>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {selecionada.horario && <span>{selecionada.horario.slice(0, 5)}</span>}
                  {selecionada.responsavel_nome && <span>{selecionada.responsavel_nome}</span>}
                  {selecionada.setor && <span>{selecionada.setor}</span>}
                  <span>Prioridade: {PRIORIDADE_LABEL[selecionada.prioridade || 'normal']}</span>
                </div>
              </SheetHeader>

              {selecionada.descricao && (
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{selecionada.descricao}</p>
              )}

              <div className="mt-4">
                <AtividadeExecucaoPanel
                  atividadeId={selecionada.id}
                  unidadeId={selecionada.unidade_id}
                  data={hoje}
                  horario={selecionada.horario}
                  prazo={selecionada.prazo}
                  exigeEvidencia={selecionada.exige_evidencia}
                  exigeConfirmacao={selecionada.exige_confirmacao}
                  instrucao={selecionada.instrucao}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </OpsLayout>
  );
}
