import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Granularidade = 'dia' | 'semana' | 'mes';

export interface SerieIndicador {
  periodo: string;
  atendimentos: number;
  media_treinador: number | null;
  limpeza: number | null;
  organizacao: number | null;
  climatizacao: number | null;
  equipamentos: number | null;
  clima: number | null;
  postura: number | null;
  proatividade: number | null;
  nota_geral: number | null;
}

const INDICADORES: { key: keyof SerieIndicador; label: string; eixo: 'qtd' | 'nota'; color: string }[] = [
  { key: 'atendimentos', label: 'Total de atendimentos', eixo: 'qtd', color: 'hsl(var(--primary))' },
  { key: 'media_treinador', label: 'Média por treinador', eixo: 'qtd', color: '#8b5cf6' },
  { key: 'limpeza', label: 'Limpeza', eixo: 'nota', color: '#10b981' },
  { key: 'organizacao', label: 'Organização', eixo: 'nota', color: '#0ea5e9' },
  { key: 'climatizacao', label: 'Climatização', eixo: 'nota', color: '#f59e0b' },
  { key: 'equipamentos', label: 'Equipamentos', eixo: 'nota', color: '#ef4444' },
  { key: 'clima', label: 'Clima da equipe', eixo: 'nota', color: '#ec4899' },
  { key: 'postura', label: 'Postura', eixo: 'nota', color: '#14b8a6' },
  { key: 'proatividade', label: 'Proatividade', eixo: 'nota', color: '#a3a3a3' },
  { key: 'nota_geral', label: 'Nota geral', eixo: 'nota', color: '#6366f1' },
];

export function EvolucaoIndicadoresCard({ buildSerie }: { buildSerie: (g: Granularidade) => SerieIndicador[] }) {
  const [gran, setGran] = useState<Granularidade>('dia');
  const [ativos, setAtivos] = useState<string[]>(['atendimentos', 'nota_geral']);

  const serie = buildSerie(gran);
  const selecionados = INDICADORES.filter((i) => ativos.includes(i.key as string));
  const usaQtd = selecionados.some((i) => i.eixo === 'qtd');
  const usaNota = selecionados.some((i) => i.eixo === 'nota');

  const toggle = (k: string) => setAtivos((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Evolução dos indicadores
          </CardTitle>
          <div className="flex gap-1">
            {(['dia', 'semana', 'mes'] as Granularidade[]).map((g) => (
              <Button key={g} size="sm" variant={gran === g ? 'default' : 'outline'} className="h-7 text-xs capitalize" onClick={() => setGran(g)}>
                {g === 'mes' ? 'Mês' : g}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-2">
          {INDICADORES.map((i) => (
            <Badge
              key={i.key as string}
              variant={ativos.includes(i.key as string) ? 'default' : 'outline'}
              className="cursor-pointer text-[10px]"
              onClick={() => toggle(i.key as string)}
            >
              {i.label}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {serie.length === 0 || selecionados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {serie.length === 0 ? 'Sem dados suficientes no período selecionado.' : 'Selecione ao menos um indicador.'}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={serie} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
              {usaQtd && <YAxis yAxisId="qtd" tick={{ fontSize: 10 }} />}
              {usaNota && <YAxis yAxisId="nota" orientation="right" domain={[0, 5]} tick={{ fontSize: 10 }} />}
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {selecionados.map((i) => (
                <Line
                  key={i.key as string}
                  yAxisId={i.eixo}
                  type="monotone"
                  dataKey={i.key as string}
                  name={i.label}
                  stroke={i.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          Quantidades usam o eixo esquerdo e notas de 1 a 5 o eixo direito, em escalas separadas.
        </p>
      </CardContent>
    </Card>
  );
}
