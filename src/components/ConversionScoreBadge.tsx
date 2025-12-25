import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConversionScoreResult } from '@/hooks/useConversionScore';

interface ConversionScoreBadgeProps {
  scoreData: ConversionScoreResult;
  showLabel?: boolean;
}

export const ConversionScoreBadge = ({ scoreData, showLabel = false }: ConversionScoreBadgeProps) => {
  const { score, label, bgColor } = scoreData;

  const getIcon = () => {
    if (score >= 80) return '🔥';
    if (score >= 60) return '☀️';
    if (score >= 40) return '❄️';
    return '🧊';
  };

  const getBarColor = () => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${getBarColor()} transition-all duration-300`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums min-w-[32px] text-right">
              {score}%
            </span>
            <span className="text-xs">{getIcon()}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{label} - {score}% de chance</p>
          {scoreData.fatoresPositivos.length > 0 && (
            <p className="text-green-400 mt-1">✓ {scoreData.fatoresPositivos[0]}</p>
          )}
          {scoreData.podeMelhorar.length > 0 && (
            <p className="text-amber-400">→ {scoreData.podeMelhorar[0]}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
