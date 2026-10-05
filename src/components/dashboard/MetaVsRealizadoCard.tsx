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
  const [metaMinima, setMetaMinima] = useState(0);
  const [supermeta, setSupermeta] = useState(0);

  useEffect(() => {
    if (!unidadeId) return;
    supabase
      .from('gestao_metas')
      .select('alunos_ativos_manual, meta_alunos_mes, supermeta_alunos_mes')
      .eq('unidade_id', unidadeId)
      .maybeSingle()
      .then(({ data }) => {
        setAtivos(data?.alunos_ativos_manual ?? 0);
        setMetaMinima(data?.meta_alunos_mes ?? 0);
        setSupermeta(data?.supermeta_alunos_mes ?? 0);
      });
  }, [unidadeId, refreshKey]);

  if (!unidadeId) return null;

  const minimaAtingida = metaMinima > 0 && ativos >= metaMinima;
  const supermetaAtingida = supermeta > 0 && ativos >= supermeta;
  const alvoAtual = !minimaAtingida ? metaMinima : (supermeta || metaMinima);
  const pct = alvoAtual > 0 ? Math.round((ativos / alvoAtual) * 100) : 0;
  const faltam = Math.max(0, alvoAtual - ativos);
  const acima = Math.max(0, ativos - alvoAtual);
  const atingiu = alvoAtual > 0 && ativos >= alvoAtual;

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
  if (metaMinima === 0) mensagem = 'Defina a Meta Mínima para acompanhar a evolução.';
  else if (supermetaAtingida) mensagem = acima > 0 ? `🏆 Supermeta batida! +${acima} aluno${acima > 1 ? 's' : ''} acima.` : '🏆 Supermeta atingida! Excelente trabalho.';
  else if (minimaAtingida && supermeta > 0) mensagem = `✅ Meta Mínima atingida. Faltam ${faltam} aluno${faltam === 1 ? '' : 's'} para a Supermeta.`;
  else if (minimaAtingida) mensagem = '✅ Meta Mínima atingida! Excelente trabalho.';
  else if (pct >= 80) mensagem = `⚡ Quase lá! Falta${faltam > 1 ? 'm' : ''} ${faltam} aluno${faltam > 1 ? 's' : ''} para a Meta Mínima.`;
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
            Meta Mínima e Supermeta{unidadeNome ? ` — ${unidadeNome}` : ''}
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
              <>aluno{faltam === 1 ? '' : 's'} para {!minimaAtingida ? 'Meta Mínima' : 'Supermeta'}</>
            )}
          </div>
          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
            {ativos} / {alvoAtual || '—'} · {pct}%
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-700 ease-out rounded-full`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>Meta Mínima: <strong className="text-foreground">{metaMinima || '—'}</strong></span>
          <span>Supermeta: <strong className="text-foreground">{supermeta || '—'}</strong></span>
        </div>
        <div className="mt-1 text-[11px] font-medium text-foreground/80">
          {mensagem}
        </div>
      </CardContent>
    </Card>
  );
}
