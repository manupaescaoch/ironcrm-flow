import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { ContaPagar, formatCurrency, formatDateBR, labelFormaPagamento } from './constants';

interface Props {
  conta: ContaPagar;
  unidadeNome: string;
  onVerConta: () => void;
  onCadastrarOutra: () => void;
  onFechar: () => void;
}

export function SucessoConta({ conta, unidadeNome, onVerConta, onCadastrarOutra, onFechar }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-100">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold">Conta cadastrada com sucesso!</h3>
      </div>

      <div className="rounded-xl border p-4 space-y-1.5 text-sm bg-muted/30">
        <p>
          <span className="text-muted-foreground">Descrição: </span>
          <span className="font-medium">{conta.descricao}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Valor: </span>
          <span className="font-medium">{formatCurrency(Number(conta.valor))}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Vencimento: </span>
          <span className="font-medium">{formatDateBR(conta.data_vencimento)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Forma de pagamento: </span>
          <span className="font-medium">{labelFormaPagamento(conta.forma_pagamento)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Unidade: </span>
          <span className="font-medium">{unidadeNome}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Status: </span>
          <span className="font-medium">Pendente</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Button variant="outline" onClick={onCadastrarOutra}>
          Cadastrar outra conta
        </Button>
        <Button variant="outline" onClick={onFechar}>
          Fechar
        </Button>
        <Button onClick={onVerConta}>Ver conta cadastrada</Button>
      </div>
    </div>
  );
}
