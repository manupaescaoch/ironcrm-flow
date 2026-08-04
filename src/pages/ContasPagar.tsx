import { useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUnidade } from '@/contexts/UnidadeContext';
import { getTodayInBrasilia } from '@/lib/brasilia';
import { useContasPagar } from '@/hooks/useContasPagar';
import { ContasPagarKPIs } from '@/components/contas-pagar/ContasPagarKPIs';
import { PeriodoSelector, PeriodoModo } from '@/components/contas-pagar/PeriodoSelector';
import { ContasFiltros } from '@/components/contas-pagar/ContasFiltros';
import { ContasTable } from '@/components/contas-pagar/ContasTable';
import { ReagendarModal } from '@/components/contas-pagar/ReagendarModal';

import { NovaContaModal } from '@/components/contas-pagar/NovaContaModal';
import { BaixaModal } from '@/components/contas-pagar/BaixaModal';
import { ContaDetalhesDrawer } from '@/components/contas-pagar/ContaDetalhesDrawer';
import { ContaPagar } from '@/components/contas-pagar/constants';

function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function semanaRange(refISO: string): { from: string; to: string } {
  const [y, m, d] = refISO.split('-').map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  const day = base.getDay();
  const start = new Date(base);
  start.setDate(base.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: iso(start), to: iso(end) };
}

export default function ContasPagar() {
  const { toast } = useToast();
  const { unidades } = useUnidade();
  const hoje = getTodayInBrasilia();
  const [ay, am] = hoje.split('-');

  const [modo, setModo] = useState<PeriodoModo>('mes');
  const [mes, setMes] = useState(String(Number(am) - 1));
  const [ano, setAno] = useState(ay);
  const [semanaRef, setSemanaRef] = useState(hoje);
  const [customFrom, setCustomFrom] = useState(hoje);
  const [customTo, setCustomTo] = useState(hoje);

  const { from, to } = useMemo(() => {
    if (modo === 'mes') {
      const y = Number(ano);
      const mIdx = Number(mes);
      return { from: iso(new Date(y, mIdx, 1)), to: iso(new Date(y, mIdx + 1, 0)) };
    }
    if (modo === 'semana') return semanaRange(semanaRef);
    if (modo === 'esta_semana') return semanaRange(hoje);
    return { from: customFrom, to: customTo };
  }, [modo, mes, ano, semanaRef, customFrom, customTo, hoje]);

  const {
    contas,
    isLoading,
    kpis,
    canManage,
    unidadeId,
    unidadeNome,
    statusDe,
    criarConta,
    atualizarConta,
    darBaixa,
    reabrirConta,
    cancelarConta,
    excluirConta,
    buscarDuplicidade,
    reenviarWhatsapp,
  } = useContasPagar(from, to);

  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('todos');
  const [categoria, setCategoria] = useState('todas');
  const [prioridade, setPrioridade] = useState('todas');
  const [forma, setForma] = useState('todas');

  const [novaOpen, setNovaOpen] = useState(false);
  const [contaEdicao, setContaEdicao] = useState<ContaPagar | null>(null);
  const [baixaConta, setBaixaConta] = useState<ContaPagar | null>(null);
  const [detalhe, setDetalhe] = useState<ContaPagar | null>(null);
  const [reagendarConta, setReagendarConta] = useState<ContaPagar | null>(null);

  const [confirmacao, setConfirmacao] = useState<{
    tipo: 'reabrir' | 'cancelar' | 'excluir';
    conta: ContaPagar;
  } | null>(null);

  const contasFiltradas = useMemo(() => {
    const termo = busca.trim().toUpperCase();
    return contas.filter((c) => {
      if (status !== 'todos' && statusDe(c) !== status) return false;
      if (categoria !== 'todas' && c.categoria !== categoria) return false;
      if (prioridade !== 'todas' && c.prioridade !== prioridade) return false;
      if (forma !== 'todas' && c.forma_pagamento !== forma) return false;
      if (termo) {
        const alvo = `${c.descricao} ${c.fornecedor || ''} ${c.numero_fatura || ''} ${c.centro_custo || ''}`.toUpperCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [contas, busca, status, categoria, prioridade, forma, statusDe]);

  const contaAtual = detalhe ? contas.find((c) => c.id === detalhe.id) ?? detalhe : null;

  const executarConfirmacao = async () => {
    if (!confirmacao) return;
    const { tipo, conta } = confirmacao;
    try {
      if (tipo === 'reabrir') await reabrirConta.mutateAsync(conta.id);
      if (tipo === 'cancelar') await cancelarConta.mutateAsync(conta.id);
      if (tipo === 'excluir') await excluirConta.mutateAsync(conta.id);
      toast({
        title:
          tipo === 'reabrir'
            ? 'Conta reaberta.'
            : tipo === 'cancelar'
              ? 'Conta cancelada.'
              : 'Conta excluída.',
      });
      if (tipo === 'excluir') setDetalhe(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Não foi possível concluir a ação';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setConfirmacao(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Contas a Pagar</h1>
              <p className="text-sm text-muted-foreground">
                {unidadeNome ? `Unidade ${unidadeNome}` : 'Selecione uma unidade'}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setContaEdicao(null);
                  setNovaOpen(true);
                }}
                disabled={!unidadeId}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova conta
              </Button>
            </div>
          )}
        </div>

        <ContasPagarKPIs {...kpis} onSelectStatus={(s) => setStatus(s)} />

        <Card className="p-4 space-y-4">
          <PeriodoSelector
            modo={modo}
            setModo={setModo}
            mes={mes}
            setMes={setMes}
            ano={ano}
            setAno={setAno}
            semanaRef={semanaRef}
            setSemanaRef={setSemanaRef}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
            from={from}
            to={to}
          />
          <ContasFiltros
            busca={busca}
            setBusca={setBusca}
            status={status}
            setStatus={setStatus}
            categoria={categoria}
            setCategoria={setCategoria}
            prioridade={prioridade}
            setPrioridade={setPrioridade}
            forma={forma}
            setForma={setForma}
          />
        </Card>

        <ContasTable
          contas={contasFiltradas}
          isLoading={isLoading}
          statusDe={statusDe}
          canManage={canManage}
          onVer={(c) => setDetalhe(c)}
          onEditar={(c) => {
            setContaEdicao(c);
            setNovaOpen(true);
          }}
          onDarBaixa={(c) => setBaixaConta(c)}
          onReagendar={(c) => setReagendarConta(c)}
          onExcluir={(c) => setConfirmacao({ tipo: 'excluir', conta: c })}
        />
      </div>

      <ReagendarModal
        conta={reagendarConta}
        open={!!reagendarConta}
        onOpenChange={(open) => !open && setReagendarConta(null)}
        saving={atualizarConta.isPending}
        onConfirm={async (novaData) => {
          if (!reagendarConta) return;
          try {
            await atualizarConta.mutateAsync({
              id: reagendarConta.id,
              payload: { data_vencimento: novaData } as never,
            });
            toast({ title: 'Vencimento reagendado.' });
            setReagendarConta(null);
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Não foi possível reagendar';
            toast({ title: 'Erro', description: msg, variant: 'destructive' });
          }
        }}
      />



      <NovaContaModal
        open={novaOpen}
        onOpenChange={(open) => {
          setNovaOpen(open);
          if (!open) setContaEdicao(null);
        }}
        unidadeId={unidadeId}
        unidadeNome={unidadeNome}
        unidadesNomes={unidades.map((u) => u.nome)}
        canManage={canManage}
        contaEdicao={contaEdicao}
        onCriar={(payload) => criarConta.mutateAsync(payload)}
        onAtualizar={(id, payload) => atualizarConta.mutateAsync({ id, payload })}
        buscarDuplicidade={buscarDuplicidade}
        onVerConta={(c) => setDetalhe(c)}
      />


      <BaixaModal
        open={!!baixaConta}
        onOpenChange={(open) => !open && setBaixaConta(null)}
        conta={baixaConta}
        onConfirmar={(payload) => darBaixa.mutateAsync(payload)}
      />

      <ContaDetalhesDrawer
        conta={contaAtual}
        open={!!detalhe}
        onOpenChange={(open) => !open && setDetalhe(null)}
        status={contaAtual ? statusDe(contaAtual) : null}
        canManage={canManage}
        unidadeNome={unidadeNome}
        onDarBaixa={(c) => setBaixaConta(c)}
        onEditar={(c) => {
          setContaEdicao(c);
          setNovaOpen(true);
        }}
        onReabrir={(c) => setConfirmacao({ tipo: 'reabrir', conta: c })}
        onCancelar={(c) => setConfirmacao({ tipo: 'cancelar', conta: c })}
        onExcluir={(c) => setConfirmacao({ tipo: 'excluir', conta: c })}
        reenviando={reenviarWhatsapp.isPending}
        onReenviarWhatsapp={async (c, tipo) => {
          try {
            await reenviarWhatsapp.mutateAsync({ contaId: c.id, tipo });
            toast({ title: 'Mensagem enviada ao grupo financeiro.' });
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Não foi possível reenviar';
            toast({ title: 'Falha no envio', description: msg, variant: 'destructive' });
          }
        }}
      />

      <AlertDialog open={!!confirmacao} onOpenChange={(open) => !open && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao?.tipo === 'reabrir' && 'Reabrir esta conta?'}
              {confirmacao?.tipo === 'cancelar' && 'Cancelar esta conta?'}
              {confirmacao?.tipo === 'excluir' && 'Excluir esta conta?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.tipo === 'reabrir' &&
                'A conta voltará para o status pendente e os dados da baixa serão removidos.'}
              {confirmacao?.tipo === 'cancelar' && 'A conta será marcada como cancelada e sairá dos totais do período.'}
              {confirmacao?.tipo === 'excluir' &&
                'A conta será removida da listagem. O histórico permanece registrado para auditoria.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={executarConfirmacao}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
