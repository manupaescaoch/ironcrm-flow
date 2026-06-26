import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, AlertCircle, CheckCircle2, Flame, Sun, Snowflake, X, Sparkles } from 'lucide-react';
import {
  ConversionScoreResult,
  NIVEL_INTERESSE_META,
  NivelInteresse,
} from '@/hooks/useConversionScore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatTimestampInBrasilia } from '@/lib/brasilia';

interface Props {
  leadId: string;
  scoreData: ConversionScoreResult;
  nivelAtual: NivelInteresse | null | undefined;
  atualizadoEm?: string | null;
  atualizadoPor?: string | null;
  onChange: (
    nivel: NivelInteresse | null,
    atualizadoEm: string | null,
    atualizadoPor: string | null,
  ) => void;
}

const OPTIONS: { value: NivelInteresse; icon: typeof Flame; hint: string }[] = [
  { value: 'alto', icon: Flame, hint: 'Pronto pra fechar' },
  { value: 'medio', icon: Sun, hint: 'Avaliando ainda' },
  { value: 'baixo', icon: Snowflake, hint: 'Sem urgência' },
];

export const NivelInteresseCard = ({
  leadId,
  scoreData,
  nivelAtual,
  atualizadoEm,
  atualizadoPor,
  onChange,
}: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState<NivelInteresse | 'clear' | null>(null);

  const { score, fatoresPositivos, podeMelhorar, nivelSugerido } = scoreData;
  const sugestaoMeta = NIVEL_INTERESSE_META[nivelSugerido];
  const atualMeta = nivelAtual ? NIVEL_INTERESSE_META[nivelAtual] : null;

  const salvar = async (novo: NivelInteresse | null) => {
    setSaving(novo ?? 'clear');
    const agora = new Date().toISOString();
    const por =
      (user?.user_metadata as any)?.full_name ||
      (user?.user_metadata as any)?.name ||
      user?.email ||
      'USUÁRIO';

    const { error } = await supabase
      .from('leads')
      .update({
        nivel_interesse: novo,
        nivel_interesse_atualizado_em: agora,
        nivel_interesse_atualizado_por: por,
      })
      .eq('id', leadId);

    setSaving(null);

    if (error) {
      toast({
        title: 'Erro ao atualizar nível',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    onChange(novo, agora, por);
    toast({
      title: novo ? `Marcado como ${NIVEL_INTERESSE_META[novo].label}` : 'Nível removido',
    });
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Nível de Interesse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Botões de nível */}
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((opt) => {
            const meta = NIVEL_INTERESSE_META[opt.value];
            const isActive = nivelAtual === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => salvar(opt.value)}
                disabled={saving !== null}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 transition-all text-xs font-medium',
                  isActive
                    ? `${meta.badge} border-current shadow-sm`
                    : 'border-border bg-background hover:bg-accent text-muted-foreground',
                  saving !== null && 'opacity-50 cursor-not-allowed',
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{meta.label}</span>
                <span className="text-[10px] opacity-70 leading-tight text-center">{opt.hint}</span>
              </button>
            );
          })}
        </div>

        {/* Sugestão automática */}
        {!nivelAtual && (
          <div className="rounded-lg border border-dashed bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Sugestão automática ({score}%):</span>
                <Badge variant="outline" className={cn('border-current', sugestaoMeta.badge)}>
                  {sugestaoMeta.emoji} {sugestaoMeta.label}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => salvar(nivelSugerido)}
                disabled={saving !== null}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}

        {nivelAtual && atualizadoEm && (
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Marcado como {atualMeta?.label} por{' '}
              <strong>{atualizadoPor || '—'}</strong> em{' '}
              {formatTimestampInBrasilia(atualizadoEm)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => salvar(null)}
              disabled={saving !== null}
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          </div>
        )}

        {/* Fatores Positivos */}
        {fatoresPositivos.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400">
              <TrendingUp className="h-3.5 w-3.5" />
              Fatores Positivos
            </div>
            <ul className="space-y-0.5">
              {fatoresPositivos.map((fator, idx) => (
                <li key={idx} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                  {fator}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pode Melhorar */}
        {podeMelhorar.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              Pode Melhorar
            </div>
            <ul className="space-y-0.5">
              {podeMelhorar.map((item, idx) => (
                <li key={idx} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="w-3 h-3 flex items-center justify-center text-amber-500 flex-shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
