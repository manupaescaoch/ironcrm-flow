import { useOpsEscopoLabel } from '@/hooks/useOpsEscopoLabel';
import { useMemo, useState } from 'react';
import { Loader2, CalendarDays } from 'lucide-react';
import { OpsLayout } from '@/components/ops/OpsLayout';
import { OpsTarefaRow, OpsTarefaSheet } from '@/components/ops/OpsTarefaItem';
import { useOpsMeuDia, type OpsEscopo, type OpsTarefaDoDia } from '@/hooks/useOpsMeuDia';
import { cn } from '@/lib/utils';

const DIAS_CURTOS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function proximosDias(qtd = 7) {
  const hoje = new Date();
  return Array.from({ length: qtd }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    return d;
  });
}

type Periodo = 'manha' | 'tarde' | 'noite' | 'sem-hora';

const PERIODO_LABEL: Record<Periodo, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  'sem-hora': 'Sem horário',
};

function periodoDe(horario: string | null): Periodo {
  if (!horario) return 'sem-hora';
  const h = Number(horario.slice(0, 2));
  if (h < 12) return 'manha';
  if (h < 18) return 'tarde';
  return 'noite';
}

export default function OpsCronograma() {
  const dias = useMemo(() => proximosDias(7), []);
  const [diaIdx, setDiaIdx] = useState(0);
  const [escopo, setEscopo] = useState<OpsEscopo>('unidade');
  const dia = dias[diaIdx];
  const { tarefas, temVinculo, isLoading, refetch } = useOpsMeuDia(escopo, dia);
  const [selecionada, setSelecionada] = useState<OpsTarefaDoDia | null>(null);

  const grupos = useMemo(() => {
    const ordem: Periodo[] = ['manha', 'tarde', 'noite', 'sem-hora'];
    return ordem
      .map((p) => ({ periodo: p, itens: tarefas.filter((t) => periodoDe(t.horario) === p) }))
      .filter((g) => g.itens.length > 0);
  }, [tarefas]);

  return (
    <OpsLayout title="Cronograma">
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Cronograma</h2>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">
            {dia.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>

        {/* Seletor de dias */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {dias.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDiaIdx(i)}
              className={cn(
                'flex min-w-[56px] flex-col items-center rounded-2xl px-3 py-2 text-xs shadow-sm transition-colors',
                i === diaIdx ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
              )}
            >
              <span className="text-[10px] font-medium tracking-wide">{DIAS_CURTOS[d.getDay()]}</span>
              <span className="mt-0.5 text-base font-semibold tabular-nums">
                {String(d.getDate()).padStart(2, '0')}
              </span>
            </button>
          ))}
        </div>

        {temVinculo && (
          <div className="inline-flex rounded-full bg-muted p-1 text-xs font-medium">
            {(['unidade', 'minhas'] as OpsEscopo[]).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setEscopo(op)}
                className={cn(
                  'rounded-full px-3 py-1.5 transition-colors',
                  escopo === op ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {op === 'minhas' ? 'Minhas tarefas' : escopoAmploLabel}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : grupos.length === 0 ? (
          <div className="rounded-2xl bg-card p-10 text-center shadow-sm">
            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Nenhuma atividade neste dia</p>
            <p className="mt-1 text-xs text-muted-foreground">Escolha outro dia no seletor acima.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grupos.map((g) => (
              <section key={g.periodo} className="space-y-2">
                <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {PERIODO_LABEL[g.periodo]} · {g.itens.length}
                </h3>
                {g.itens.map((t) => (
                  <OpsTarefaRow key={t.id} tarefa={t} onClick={() => setSelecionada(t)} />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      <OpsTarefaSheet
        tarefa={selecionada}
        data={dia}
        onClose={() => {
          setSelecionada(null);
          refetch();
        }}
      />
    </OpsLayout>
  );
}
