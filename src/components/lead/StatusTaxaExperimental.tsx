import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StatusTaxaExperimental } from '@/types/database';

export const STATUS_TAXA_OPTIONS: { value: StatusTaxaExperimental; label: string }[] = [
  { value: 'pago_antecipado', label: 'Pago antecipadamente' },
  { value: 'pendente', label: 'Pendente de pagamento' },
  { value: 'isento', label: 'Isento da taxa' },
];

export const STATUS_TAXA_LABELS: Record<StatusTaxaExperimental, string> = {
  pago_antecipado: 'Pago antecipadamente',
  pendente: 'Pendente de pagamento',
  isento: 'Isento da taxa',
};

const STATUS_TAXA_BADGE: Record<StatusTaxaExperimental, string> = {
  pago_antecipado: 'bg-green-100 text-green-700 border-green-200',
  pendente: 'bg-amber-100 text-amber-700 border-amber-200',
  isento: 'bg-slate-100 text-slate-700 border-slate-200',
};

const SENTINEL_NONE = '__none__';

interface StatusTaxaSelectProps {
  value: StatusTaxaExperimental | null | undefined;
  onChange: (value: StatusTaxaExperimental | null) => void;
  label?: string;
  disabled?: boolean;
}

export function StatusTaxaSelect({
  value,
  onChange,
  label = 'Status da taxa da experimental',
  disabled,
}: StatusTaxaSelectProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value ?? SENTINEL_NONE}
        onValueChange={(v) =>
          onChange(v === SENTINEL_NONE ? null : (v as StatusTaxaExperimental))
        }
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Não informado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SENTINEL_NONE}>Não informado</SelectItem>
          {STATUS_TAXA_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function StatusTaxaBadge({
  value,
  className,
}: {
  value: StatusTaxaExperimental | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  return (
    <Badge variant="outline" className={`${STATUS_TAXA_BADGE[value]} ${className ?? ''}`}>
      Taxa: {STATUS_TAXA_LABELS[value]}
    </Badge>
  );
}
