import { useOpsEscopoLabel } from '@/hooks/useOpsEscopoLabel';
import { useMemo, useState } from 'react';
import { Loader2, Search, ListChecks } from 'lucide-react';
import { OpsLayout } from '@/components/ops/OpsLayout';
import { OpsTarefaRow, OpsTarefaSheet } from '@/components/ops/OpsTarefaItem';
import { useOpsMeuDia, type OpsEscopo, type OpsTarefaDoDia } from '@/hooks/useOpsMeuDia';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { OpsStatus } from '@/hooks/useOpsExecucao';

const STATUS_FILTROS: { valor: OpsStatus | 'todas'; label: string }[] = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'pendente', label: 'Pendentes' },
  { valor: 'em_andamento', label: 'Em andamento' },
  { valor: 'atrasada', label: 'Atrasadas' },
  { valor: 'concluida', label: 'Concluídas' },
];

const PRIORIDADE_FILTROS: { valor: string; label: string }[] = [
  { valor: 'todas', label: 'Toda prioridade' },
  { valor: 'critica', label: 'Crítica' },
  { valor: 'alta', label: 'Alta' },
  { valor: 'normal', label: 'Normal' },
  { valor: 'baixa', label: 'Baixa' },
];

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors',
        ativo ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function OpsTarefas() {
  const hoje = useMemo(() => new Date(), []);
  const [escopo, setEscopo] = useState<OpsEscopo>('minhas');
  const { tarefas, temVinculo, isLoading, refetch } = useOpsMeuDia(escopo, hoje);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<OpsStatus | 'todas'>('todas');
  const [prioridade, setPrioridade] = useState('todas');
  const [setor, setSetor] = useState('todos');
  const [selecionada, setSelecionada] = useState<OpsTarefaDoDia | null>(null);

  const setores = useMemo(() => {
    const s = new Set<string>();
    tarefas.forEach((t) => { if (t.setor) s.add(t.setor); });
    return Array.from(s).sort();
  }, [tarefas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return tarefas.filter((t) => {
      if (status !== 'todas' && t.status !== status) return false;
      if (prioridade !== 'todas' && (t.prioridade || 'normal') !== prioridade) return false;
      if (setor !== 'todos' && t.setor !== setor) return false;
      if (termo) {
        const alvo = `${t.titulo} ${t.descricao || ''} ${t.responsavel_nome || ''} ${t.setor || ''}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [tarefas, status, prioridade, setor, busca]);

  return (
    <OpsLayout title="Tarefas">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Tarefas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtradas.length} de {tarefas.length} atividades de hoje
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, responsável ou setor"
            className="h-11 rounded-2xl border-0 bg-card pl-9 shadow-sm"
          />
        </div>

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
                {op === 'minhas' ? 'Minhas tarefas' : escopoAmploLabel}
              </button>
            ))}
          </div>
        )}

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {STATUS_FILTROS.map((f) => (
            <Chip key={f.valor} ativo={status === f.valor} onClick={() => setStatus(f.valor)}>
              {f.label}
            </Chip>
          ))}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {PRIORIDADE_FILTROS.map((f) => (
            <Chip key={f.valor} ativo={prioridade === f.valor} onClick={() => setPrioridade(f.valor)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {setores.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip ativo={setor === 'todos'} onClick={() => setSetor('todos')}>
              Todos os setores
            </Chip>
            {setores.map((s) => (
              <Chip key={s} ativo={setor === s} onClick={() => setSetor(s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-2xl bg-card p-10 text-center shadow-sm">
            <ListChecks className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Nenhuma tarefa encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">Ajuste a busca ou os filtros acima.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map((t) => (
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
