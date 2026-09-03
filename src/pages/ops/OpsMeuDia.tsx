import { useMemo, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { OpsLayout } from '@/components/ops/OpsLayout';
import { OpsTarefaRow, OpsTarefaSheet } from '@/components/ops/OpsTarefaItem';
import { useOpsMeuDia, type OpsEscopo, type OpsTarefaDoDia } from '@/hooks/useOpsMeuDia';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

function saudacao(hora: number) {
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function ResumoCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm">
      <p className={cn('text-2xl font-semibold tabular-nums', tone)}>{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
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
              <OpsTarefaRow key={t.id} tarefa={t} onClick={() => setSelecionada(t)} />
            ))}
          </div>
        )}
      </div>

      <OpsTarefaSheet
        tarefa={selecionada}
        data={hoje}
        onClose={() => {
          setSelecionada(null);
          refetch();
        }}
      />
    </OpsLayout>
  );
}
