import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CATEGORIAS, FORMAS_PAGAMENTO, PRIORIDADES } from './constants';
import type { ContaFormPayload } from '@/hooks/useContasPagar';

export interface ContaFormState {
  descricao: string;
  fornecedor: string;
  categoria: string;
  prioridade: string;
  centro_custo: string;
  competencia: string;
  observacoes: string;
  valor: string;
  data_vencimento: string;
  forma_pagamento: string;
  numero_fatura: string;
  codigo_barras: string;
  linha_digitavel: string;
  chave_pix: string;
  codigo_pix: string;
}

export const emptyContaForm: ContaFormState = {
  descricao: '',
  fornecedor: '',
  categoria: '',
  prioridade: 'normal',
  centro_custo: '',
  competencia: '',
  observacoes: '',
  valor: '',
  data_vencimento: '',
  forma_pagamento: '',
  numero_fatura: '',
  codigo_barras: '',
  linha_digitavel: '',
  chave_pix: '',
  codigo_pix: '',
};

export function parseValor(valor: string): number {
  const clean = valor.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(clean);
  return Number.isFinite(num) ? num : NaN;
}

export function validateContaForm(form: ContaFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.descricao.trim()) errors.descricao = 'Informe a descrição';
  if (!form.fornecedor.trim()) errors.fornecedor = 'Informe o fornecedor ou favorecido';
  if (!form.categoria) errors.categoria = 'Selecione a categoria';
  if (!form.prioridade) errors.prioridade = 'Selecione a prioridade';
  const valor = parseValor(form.valor);
  if (!form.valor.trim() || Number.isNaN(valor) || valor <= 0) errors.valor = 'Informe um valor válido';
  if (!form.data_vencimento) errors.data_vencimento = 'Informe a data de vencimento';
  if (!form.forma_pagamento) errors.forma_pagamento = 'Selecione a forma de pagamento';
  return errors;
}

export function contaFormToPayload(form: ContaFormState, documentoUrl: string | null): ContaFormPayload {
  const nn = (v: string) => (v.trim() ? v.trim() : null);
  return {
    descricao: form.descricao.trim().toUpperCase(),
    fornecedor: form.fornecedor.trim().toUpperCase(),
    categoria: form.categoria,
    prioridade: form.prioridade,
    centro_custo: nn(form.centro_custo)?.toUpperCase() ?? null,
    competencia: nn(form.competencia),
    observacoes: nn(form.observacoes),
    valor: parseValor(form.valor),
    data_vencimento: form.data_vencimento,
    forma_pagamento: form.forma_pagamento,
    numero_fatura: nn(form.numero_fatura),
    codigo_barras: nn(form.codigo_barras),
    linha_digitavel: nn(form.linha_digitavel),
    chave_pix: nn(form.chave_pix),
    // Código Pix é salvo integralmente, sem alterar espaços ou sequência
    codigo_pix: form.codigo_pix.trim() ? form.codigo_pix : null,
    documento_url: documentoUrl,
  };
}

interface Props {
  form: ContaFormState;
  setForm: (updater: (prev: ContaFormState) => ContaFormState) => void;
  errors: Record<string, string>;
  unidadeNome: string;
  unidadeBloqueada?: boolean;
  documentoSlot?: React.ReactNode;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

export function ContaFormFields({ form, setForm, errors, unidadeNome, documentoSlot }: Props) {
  const set = (key: keyof ContaFormState) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const errClass = (key: string) => (errors[key] ? 'border-destructive focus-visible:ring-destructive' : '');

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Informações gerais</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Descrição *</Label>
            <Input
              value={form.descricao}
              onChange={(e) => set('descricao')(e.target.value.toUpperCase())}
              className={cn('mt-1', errClass('descricao'))}
              placeholder="CONTA TIM"
            />
            <FieldError msg={errors.descricao} />
          </div>
          <div>
            <Label>Fornecedor ou favorecido *</Label>
            <Input
              value={form.fornecedor}
              onChange={(e) => set('fornecedor')(e.target.value.toUpperCase())}
              className={cn('mt-1', errClass('fornecedor'))}
              placeholder="TIM BRASIL S.A."
            />
            <FieldError msg={errors.fornecedor} />
          </div>
          <div>
            <Label>Categoria *</Label>
            <Select value={form.categoria} onValueChange={set('categoria')}>
              <SelectTrigger className={cn('mt-1', errClass('categoria'))}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError msg={errors.categoria} />
          </div>
          <div>
            <Label>Prioridade *</Label>
            <Select value={form.prioridade} onValueChange={set('prioridade')}>
              <SelectTrigger className={cn('mt-1', errClass('prioridade'))}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError msg={errors.prioridade} />
          </div>
          <div>
            <Label>Unidade</Label>
            <Input value={unidadeNome} disabled readOnly className="mt-1 bg-muted" />
          </div>
          <div>
            <Label>Centro de custo</Label>
            <Input
              value={form.centro_custo}
              onChange={(e) => set('centro_custo')(e.target.value.toUpperCase())}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Competência</Label>
            <Input
              value={form.competencia}
              onChange={(e) => set('competencia')(e.target.value)}
              placeholder="08/2026"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => set('observacoes')(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Dados financeiros</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Valor *</Label>
            <Input
              value={form.valor}
              onChange={(e) => set('valor')(e.target.value)}
              placeholder="149,99"
              inputMode="decimal"
              className={cn('mt-1', errClass('valor'))}
            />
            <FieldError msg={errors.valor} />
          </div>
          <div>
            <Label>Data de vencimento *</Label>
            <Input
              type="date"
              value={form.data_vencimento}
              onChange={(e) => set('data_vencimento')(e.target.value)}
              className={cn('mt-1', errClass('data_vencimento'))}
            />
            <FieldError msg={errors.data_vencimento} />
          </div>
          <div>
            <Label>Forma de pagamento *</Label>
            <Select value={form.forma_pagamento} onValueChange={set('forma_pagamento')}>
              <SelectTrigger className={cn('mt-1', errClass('forma_pagamento'))}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError msg={errors.forma_pagamento} />
          </div>
          <div>
            <Label>Número da fatura</Label>
            <Input value={form.numero_fatura} onChange={(e) => set('numero_fatura')(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Código de barras</Label>
            <Input value={form.codigo_barras} onChange={(e) => set('codigo_barras')(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Linha digitável</Label>
            <Input
              value={form.linha_digitavel}
              onChange={(e) => set('linha_digitavel')(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Chave Pix</Label>
            <Input value={form.chave_pix} onChange={(e) => set('chave_pix')(e.target.value)} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label>Código Pix copia e cola</Label>
            <Textarea
              value={form.codigo_pix}
              onChange={(e) => setForm((prev) => ({ ...prev, codigo_pix: e.target.value }))}
              className="mt-1 font-mono text-xs"
              rows={3}
            />
          </div>
          {documentoSlot && <div className="sm:col-span-2">{documentoSlot}</div>}
        </div>
      </section>
    </div>
  );
}
