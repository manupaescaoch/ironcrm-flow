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
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          {atingiu ? (
            <Trophy className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <Target className="w-3.5 h-3.5 text-primary shrink-0" />
          )}
          <span className="text-xs font-semibold truncate">
            Meta vs Realizado{unidadeNome ? ` — ${unidadeNome}` : ''}
          </span>
        </div>

        <div className="flex items-end gap-2 mb-2">
          <div
            key={`${faltam}-${acima}`}
            className={`text-3xl font-bold leading-none tabular-nums ${numColor}`}
          >
            {atingiu ? `+${acima}` : faltam}
          </div>
          <div className="pb-0.5 text-[11px] text-muted-foreground leading-tight">
            {atingiu ? (
              <>aluno{acima === 1 ? '' : 's'} acima</>
            ) : (
              <>aluno{faltam === 1 ? '' : 's'} para meta</>
            )}
          </div>
          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
            {ativos} / {meta || '—'} · {pct}%
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-700 ease-out rounded-full`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        <div className="mt-1.5 text-[11px] font-medium text-foreground/80 truncate">
          {mensagem}
        </div>
      </CardContent>
    </Card>
  );
}
