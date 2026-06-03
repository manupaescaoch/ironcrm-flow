import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';
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

  return (
    <Card className="mb-2">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">Meta vs Realizado{unidadeNome ? ` — ${unidadeNome}` : ''}</span>
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {ativos} de {meta || '—'} alunos
          </div>
        </div>
        <Progress value={Math.min(100, pct)} />
        {meta > 0 && (
          <div className="text-[11px] text-muted-foreground mt-1">
            {faltam > 0 ? `Faltam ${faltam} alunos para a meta` : 'Meta atingida'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
