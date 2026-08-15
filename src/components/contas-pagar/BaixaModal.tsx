import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getTodayInBrasilia } from '@/lib/brasilia';
import { ContaPagar, FORMAS_PAGAMENTO, formatCurrency } from './constants';
import { parseValor } from './ContaFormFields';
import { uploadContaArquivo } from './uploadHelpers';
import type { BaixaPayload } from '@/hooks/useContasPagar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
  onConfirmar: (payload: BaixaPayload) => Promise<void>;
}

export function BaixaModal({ open, onOpenChange, conta, onConfirmar }: Props) {
  const { toast } = useToast();
  const [valorPago, setValorPago] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [forma, setForma] = useState('');
  const [juros, setJuros] = useState('');
  const [multa, setMulta] = useState('');
  const [desconto, setDesconto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !conta) return;
    setValorPago(String(conta.valor).replace('.', ','));
    setDataPagamento(getTodayInBrasilia());
    setForma(conta.forma_pagamento);
    setJuros('');
    setMulta('');
    setDesconto('');
    setObservacoes('');
    setFile(null);
    setErrors({});
    setSaving(false);
  }, [open, conta]);

  const confirmar = async () => {
    if (!conta || saving) return;
    const next: Record<string, string> = {};
    const valor = parseValor(valorPago);
    if (!valorPago.trim() || Number.isNaN(valor) || valor <= 0) next.valorPago = 'Informe o valor pago';
    if (!dataPagamento) next.dataPagamento = 'Informe a data do pagamento';
    if (!forma) next.forma = 'Informe a forma de pagamento';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      let comprovante = conta.comprovante_url;
      if (file) comprovante = await uploadContaArquivo(file, conta.unidade_id, 'comprovantes');

      await onConfirmar({
        id: conta.id,
        valor_pago: valor,
        data_pagamento: dataPagamento,
        forma_pagamento_baixa: forma,
        juros: Number.isNaN(parseValor(juros)) ? 0 : parseValor(juros || '0'),
        multa: Number.isNaN(parseValor(multa)) ? 0 : parseValor(multa || '0'),
        desconto: Number.isNaN(parseValor(desconto)) ? 0 : parseValor(desconto || '0'),
        comprovante_url: comprovante,
        baixa_observacoes: observacoes.trim() || null,
      });
      toast({ title: 'Baixa registrada com sucesso.' });
      onOpenChange(false);
    } catch (error) {
      const { descricao } = descreverErroConta(error, 'atualizar');
      toast({ title: 'Não foi possível dar baixa', description: descricao, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Dar baixa na conta</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
            <p className="font-medium">{conta.descricao}</p>
            <p className="text-muted-foreground text-xs">{conta.fornecedor}</p>
            <p className="text-xs">Valor original: {formatCurrency(Number(conta.valor))}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Valor pago *</Label>
              <Input
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
                inputMode="decimal"
                className={cn('mt-1', errors.valorPago && 'border-destructive')}
              />
              {errors.valorPago && <p className="text-xs text-destructive mt-1">{errors.valorPago}</p>}
            </div>
            <div>
              <Label>Data do pagamento *</Label>
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className={cn('mt-1', errors.dataPagamento && 'border-destructive')}
              />
              {errors.dataPagamento && <p className="text-xs text-destructive mt-1">{errors.dataPagamento}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label>Forma de pagamento *</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger className={cn('mt-1', errors.forma && 'border-destructive')}>
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
              {errors.forma && <p className="text-xs text-destructive mt-1">{errors.forma}</p>}
            </div>
            <div>
              <Label>Juros</Label>
              <Input value={juros} onChange={(e) => setJuros(e.target.value)} inputMode="decimal" className="mt-1" />
            </div>
            <div>
              <Label>Multa</Label>
              <Input value={multa} onChange={(e) => setMulta(e.target.value)} inputMode="decimal" className="mt-1" />
            </div>
            <div>
              <Label>Desconto</Label>
              <Input
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                inputMode="decimal"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Comprovante</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="mt-1" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar baixa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
