import { ConversionScoreResult, NIVEL_INTERESSE_META } from '@/hooks/useConversionScore';
import { cn } from '@/lib/utils';

interface Props {
  scoreData: ConversionScoreResult;
  size?: 'sm' | 'xs';
}

/**
 * Mostra o nível efetivo (manual ou sugerido) com um pequeno indicador
 * de origem: borda sólida = manual, tracejada = sugerido.
 */
export const NivelInteresseBadge = ({ scoreData, size = 'sm' }: Props) => {
  const meta = NIVEL_INTERESSE_META[scoreData.nivelEfetivo];
  return (
    <span
      title={
        scoreData.manual
          ? `Marcado manualmente como ${meta.label}`
          : `Sugestão automática (${scoreData.score}%): ${meta.label}`
      }
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
        meta.badge,
        scoreData.manual ? 'border-solid' : 'border-dashed opacity-80',
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      )}
    >
      <span>{meta.emoji}</span>
      <span>{meta.label}</span>
      {!scoreData.manual && <span className="opacity-60">• {scoreData.score}%</span>}
    </span>
  );
};
