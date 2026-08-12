import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { SectionCard, InfoDica, TOOLTIPS } from './ForecastUI';
import { Premissas, num } from '@/lib/forecast';

interface Campo {
  key: keyof Premissas;
  label: string;
  tipo: 'moeda' | 'pct' | 'int';
  dica?: string;
}

const CAMPOS: Campo[] = [
  { key: 'investimento', label: 'Investimento planejado (R$)', tipo: 'moeda' },
  { key: 'cpl', label: 'CPL projetado (R$)', tipo: 'moeda', dica: TOOLTIPS.cpl },
  { key: 'aproveitamentoAtendimento', label: 'Aproveitamento do atendimento (%)', tipo: 'pct', dica: TOOLTIPS.aproveitamento },
  { key: 'leadExp', label: 'Lead → Experimental (%)', tipo: 'pct', dica: TOOLTIPS.leadExp },
  { key: 'comparecimento', label: 'Comparecimento (%)', tipo: 'pct', dica: TOOLTIPS.comparecimento },
  { key: 'expMat', label: 'Experimental → Matrícula (%)', tipo: 'pct', dica: TOOLTIPS.expMat },
  { key: 'evasao', label: 'Taxa de evasão projetada (%)', tipo: 'pct', dica: TOOLTIPS.evasao },
  { key: 'mensalidade', label: 'Mensalidade média (R$)', tipo: 'moeda' },
  { key: 'baseInicial', label: 'Base inicial (alunos)', tipo: 'int', dica: TOOLTIPS.base },
  { key: 'capacidade', label: 'Capacidade máxima', tipo: 'int' },
  { key: 'metaAlunos', label: 'Meta de alunos', tipo: 'int' },
];

export function PremissasCard({
  premissas,
  onChange,
  onSalvar,
  onAplicarMedia,
  salvando,
}: {
  premissas: Premissas;
  onChange: (p: Premissas) => void;
  onSalvar: () => void;
  onAplicarMedia: (meses: 1 | 3 | 6) => void;
  salvando: boolean;
}) {
  const valorExibido = (c: Campo) => {
    const v = num(premissas[c.key]);
    if (c.tipo === 'pct') return Number((v * 100).toFixed(1));
    if (c.tipo === 'int') return Math.round(v);
    return Number(v.toFixed(2));
  };

  const setCampo = (c: Campo, raw: string) => {
    const v = num(raw);
    onChange({ ...premissas, [c.key]: c.tipo === 'pct' ? v / 100 : v });
  };

  return (
    <SectionCard
      title="Premissas da projeção"
      subtitle="Preenchidas com os indicadores reais mais recentes. Altere para simular cenários."
      actions={
        <>
          <span className="text-[11px] text-muted-foreground">Média dos últimos:</span>
          {([1, 3, 6] as const).map((m) => (
            <Button key={m} size="sm" variant="outline" onClick={() => onAplicarMedia(m)}>
              {m} {m === 1 ? 'mês' : 'meses'}
            </Button>
          ))}
          <Button size="sm" disabled={salvando} onClick={onSalvar}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar premissas
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {CAMPOS.map((c) => (
          <div key={c.key} className="space-y-1">
            <Label className="text-[11px] flex items-center gap-1.5">
              {c.label}
              {c.dica && <InfoDica texto={c.dica} />}
            </Label>
            <Input
              type="number"
              step={c.tipo === 'int' ? '1' : '0.01'}
              value={valorExibido(c)}
              onChange={(e) => setCampo(c, e.target.value)}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
