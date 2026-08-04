import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
          <p className="text-xs text-muted-foreground">Escolha o tipo e cole o dado abaixo.</p>
        </div>
        <DadosPagamentoSelector form={form} setForm={setForm} />
      </section>
    </div>
  );
}

const TIPOS_PAGAMENTO: { key: PagamentoKey; label: string; placeholder?: string; mono?: boolean }[] = [
  { key: 'codigo_pix', label: 'Código Pix (copia e cola)', placeholder: '00020126940014br.gov.bcb.pix...', mono: true },
  { key: 'chave_pix', label: 'Chave Pix', placeholder: 'CNPJ, e-mail, telefone ou chave aleatória' },
  { key: 'linha_digitavel', label: 'Linha digitável', placeholder: '00000.00000 00000.000000 ...', mono: true },
  { key: 'codigo_barras', label: 'Código de barras', placeholder: '00000000000000000000000000000000000000000000', mono: true },
  { key: 'link_pagamento', label: 'Link de pagamento', placeholder: 'https://' },
];

type PagamentoKey = 'codigo_pix' | 'chave_pix' | 'linha_digitavel' | 'codigo_barras' | 'link_pagamento';

function DadosPagamentoSelector({
  form,
  setForm,
}: {
  form: ContaFormState;
  setForm: (updater: (prev: ContaFormState) => ContaFormState) => void;
}) {
  const preenchido = TIPOS_PAGAMENTO.find((t) => (form[t.key] || '').trim())?.key;
  const [tipo, setTipo] = useState<PagamentoKey>(preenchido ?? 'codigo_pix');

  useEffect(() => {
    if (preenchido && preenchido !== tipo) setTipo(preenchido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preenchido]);

  const atual = TIPOS_PAGAMENTO.find((t) => t.key === tipo)!;

  const trocarTipo = (novo: PagamentoKey) => {
    setTipo(novo);
    setForm((prev) => {
      const next = { ...prev };
      TIPOS_PAGAMENTO.forEach((t) => {
        if (t.key !== novo) next[t.key] = '';
      });
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Tipo de dado</Label>
        <Select value={tipo} onValueChange={(v) => trocarTipo(v as PagamentoKey)}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_PAGAMENTO.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{atual.label}</Label>
        <Textarea
          value={form[atual.key]}
          onChange={(e) => setForm((prev) => ({ ...prev, [atual.key]: e.target.value }))}
          rows={3}
          placeholder={atual.placeholder}
          className={cn('mt-1', atual.mono && 'font-mono text-xs')}
        />
      </div>
    </div>
  );
}
