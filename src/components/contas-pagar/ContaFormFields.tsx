import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ContaFormPayload } from '@/hooks/useContasPagar';

export interface ContaFormState {
  descricao: string;
  valor: string;
  data_vencimento: string;
  codigo_pix: string;
  chave_pix: string;
  linha_digitavel: string;
  codigo_barras: string;
  link_pagamento: string;
  // Campos preservados apenas para leitura/edição de contas antigas
  fornecedor: string;
  categoria: string;
  prioridade: string;
  centro_custo: string;
  competencia: string;
  observacoes: string;
  numero_fatura: string;
  banco: string;
  agencia: string;
  conta_bancaria: string;
  favorecido: string;
}

export const emptyContaForm: ContaFormState = {
  descricao: '',
  valor: '',
  data_vencimento: '',
  codigo_pix: '',
  chave_pix: '',
  linha_digitavel: '',
  codigo_barras: '',
  link_pagamento: '',
  fornecedor: '',
  categoria: '',
  prioridade: 'normal',
  centro_custo: '',
  competencia: '',
  observacoes: '',
  numero_fatura: '',
  banco: '',
  agencia: '',
  conta_bancaria: '',
  favorecido: '',
};

export function parseValor(valor: string): number {
  const clean = valor.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(clean);
  return Number.isFinite(num) ? num : NaN;
}

export function validateContaForm(form: ContaFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.descricao.trim()) errors.descricao = 'Informe a descrição';
  const valor = parseValor(form.valor);
  if (!form.valor.trim() || Number.isNaN(valor) || valor <= 0) errors.valor = 'Informe um valor válido';
  if (!form.data_vencimento) errors.data_vencimento = 'Informe a data de vencimento';
  return errors;
}

/** Define a forma de pagamento automaticamente pelo dado informado. */
export function derivarFormaPagamento(form: ContaFormState): string | null {
  if (form.codigo_pix.trim() || form.chave_pix.trim()) return 'pix';
  if (form.linha_digitavel.trim() || form.codigo_barras.trim()) return 'boleto';
  if (form.link_pagamento.trim()) return 'outro';
  return null;
}

export function contaFormToPayload(form: ContaFormState, documentoUrl: string | null): ContaFormPayload {
  const nn = (v: string) => (v.trim() ? v.trim() : null);
  return {
    descricao: form.descricao.trim().toUpperCase(),
    fornecedor: nn(form.fornecedor)?.toUpperCase() ?? null,
    categoria: nn(form.categoria),
    prioridade: form.prioridade || 'normal',
    centro_custo: nn(form.centro_custo)?.toUpperCase() ?? null,
    competencia: nn(form.competencia),
    observacoes: nn(form.observacoes),
    valor: parseValor(form.valor),
    data_vencimento: form.data_vencimento,
    forma_pagamento: derivarFormaPagamento(form),
    numero_fatura: nn(form.numero_fatura),
    codigo_barras: nn(form.codigo_barras),
    linha_digitavel: nn(form.linha_digitavel),
    chave_pix: nn(form.chave_pix),
    link_pagamento: nn(form.link_pagamento),
    // Código Pix é salvo integralmente, sem alterar espaços ou sequência
    codigo_pix: form.codigo_pix.trim() ? form.codigo_pix : null,
    banco: nn(form.banco)?.toUpperCase() ?? null,
    agencia: nn(form.agencia),
    conta_bancaria: nn(form.conta_bancaria),
    favorecido: nn(form.favorecido)?.toUpperCase() ?? null,
    documento_url: documentoUrl,
  };
}

interface Props {
  form: ContaFormState;
  setForm: (updater: (prev: ContaFormState) => ContaFormState) => void;
  errors: Record<string, string>;
  unidadeNome: string;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

export function ContaFormFields({ form, setForm, errors, unidadeNome }: Props) {
  const set = (key: keyof ContaFormState) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const errClass = (key: string) => (errors[key] ? 'border-destructive focus-visible:ring-destructive' : '');

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Descrição *</Label>
            <Input
              value={form.descricao}
              onChange={(e) => set('descricao')(e.target.value.toUpperCase())}
              className={cn('mt-1', errClass('descricao'))}
              placeholder="SICOOB PA - OLINDA/PE"
            />
            <FieldError msg={errors.descricao} />
          </div>
          <div>
            <Label>Vencimento *</Label>
            <Input
              type="date"
              value={form.data_vencimento}
              onChange={(e) => set('data_vencimento')(e.target.value)}
              className={cn('mt-1', errClass('data_vencimento'))}
            />
            <FieldError msg={errors.data_vencimento} />
          </div>
          <div>
            <Label>Valor *</Label>
            <Input
              value={form.valor}
              onChange={(e) => set('valor')(e.target.value)}
              placeholder="5.190,01"
              inputMode="decimal"
              className={cn('mt-1', errClass('valor'))}
            />
            <FieldError msg={errors.valor} />
          </div>
          <div className="sm:col-span-2">
            <Label>Unidade</Label>
            <Input value={unidadeNome} disabled readOnly className="mt-1 bg-muted" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Dados de pagamento</h4>
          <p className="text-xs text-muted-foreground">Preencha apenas o que tiver.</p>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Código Pix (copia e cola)</Label>
            <Textarea
              value={form.codigo_pix}
              onChange={(e) => setForm((prev) => ({ ...prev, codigo_pix: e.target.value }))}
              className="mt-1 font-mono text-xs"
              rows={3}
            />
          </div>
          <div>
            <Label>Chave Pix</Label>
            <Input value={form.chave_pix} onChange={(e) => set('chave_pix')(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Linha digitável</Label>
            <Input
              value={form.linha_digitavel}
              onChange={(e) => set('linha_digitavel')(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label>Código de barras</Label>
            <Input
              value={form.codigo_barras}
              onChange={(e) => set('codigo_barras')(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label>Link de pagamento</Label>
            <Input
              value={form.link_pagamento}
              onChange={(e) => set('link_pagamento')(e.target.value)}
              placeholder="https://"
              className="mt-1"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
