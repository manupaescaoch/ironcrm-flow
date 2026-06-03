import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  unidadeId: string | undefined;
  unidadeNome?: string;
  refreshKey?: number;
}

export function MetaVsRealizadoCard({ unidadeId, unidadeNome, refreshKey }: Props) {
  const [ativos, setAtivos] = useState(0);
  const [meta, setMeta] = useState(0);

  useEffect(() => {
    if (!unidadeId) return;
    supabase
      .from('gestao_metas')
      .select('alunos_ativos_manual, meta_alunos_mes')
      .eq('unidade_id', unidadeId)
      .maybeSingle()
      .then(({ data }) => {
        setAtivos(data?.alunos_ativos_manual ?? 0);
        setMeta(data?.meta_alunos_mes ?? 0);
      });
  }, [unidadeId, refreshKey]);

  if (!unidadeId) return null;

  const pct = meta > 0 ? Math.round((ativos / meta) * 100) : 0;
  const faltam = Math.max(0, meta - ativos);
  const acima = Math.max(0, ativos - meta);
  const atingiu = meta > 0 && ativos >= meta;

  // Cor reativa
  let barColor = 'bg-destructive';
  let numColor = 'text-destructive';
  if (atingiu) {
    barColor = 'bg-emerald-500';
    numColor = 'text-emerald-500';
  } else if (pct >= 80) {
    barColor = 'bg-primary';
    numColor = 'text-primary';
  } else if (pct >= 50) {
    barColor = 'bg-amber-500';
    numColor = 'text-amber-500';
  }

  // Mensagem motivacional
  let mensagem = '';
  if (meta === 0) mensagem = 'Defina uma meta mensal para acompanhar a evolução.';
  else if (atingiu) mensagem = acima > 0 ? `🏆 Meta batida! +${acima} aluno${acima > 1 ? 's' : ''} acima do alvo.` : '🏆 Meta atingida! Excelente trabalho.';
  else if (pct >= 80) mensagem = `⚡ Quase lá! Falta${faltam > 1 ? 'm' : ''} ${faltam} aluno${faltam > 1 ? 's' : ''} para bater a meta.`;
  else if (pct >= 50) mensagem = '🔥 Já passou da metade, mantém a pegada!';
  else if (pct > 0) mensagem = '💪 Time forte, segue o ritmo!';
  else mensagem = '🚀 Bora começar! Cada matrícula conta.';

  return (
    <Card className="mb-3 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {atingiu ? (
            <Trophy className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <Target className="w-4 h-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-semibold truncate">
            Meta vs Realizado{unidadeNome ? ` — ${unidadeNome}` : ''}
          </span>
          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
            {ativos} de {meta || '—'} · {pct}%
          </span>
        </div>

        <div className="flex items-end gap-3 mb-3">
          <div
            key={`${faltam}-${acima}`}
            className={`text-5xl sm:text-6xl font-bold leading-none tabular-nums ${numColor} animate-in fade-in slide-in-from-bottom-1 duration-500`}
          >
            {atingiu ? `+${acima}` : faltam}
          </div>
          <div className="pb-1 text-xs text-muted-foreground leading-tight">
            {atingiu ? (
              <>
                aluno{acima === 1 ? '' : 's'}
                <br />
                acima da meta
              </>
            ) : (
              <>
                aluno{faltam === 1 ? '' : 's'}
                <br />
                para a meta
              </>
            )}
          </div>
        </div>

        {/* Barra de progresso customizada */}
        <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-700 ease-out rounded-full`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        <div className="mt-2 text-xs font-medium text-foreground/80">
          {mensagem}
        </div>
      </CardContent>
    </Card>
  );
}
