import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useToast } from '@/hooks/use-toast';
import { getContaArquivoUrl } from './uploadHelpers';
import { formatCurrency, formatDateTimeBR } from './constants';

const STATUS_LABEL: Record<string, string> = {
  recebido: 'Recebido',
  processando: 'Processando',
  aguardando_unidade: 'Aguardando unidade',
  aguardando_vencimento: 'Nota aguardando boleto',
  criado: 'Lançamento criado',
  vinculado: 'Vinculado a lançamento',
  duplicado: 'Duplicidade',
  conferencia_manual: 'Divergência — conferir',
  erro: 'Erro de leitura',
  ignorado: 'Ignorado',
};

async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('contas-pagar-telegram-processar', { body });
  if (error) {
    const det = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(det?.error ?? error.message);
  }
  return data;
}

export function TelegramDocsPanel() {
  const { isAdmin } = useAuth();
  const { unidades } = useUnidade();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['contas-pagar-telegram-docs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contas_pagar_telegram_docs' as any)
        .select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 30000,
  });
  const { data: cfg } = useQuery({ queryKey: ['contas-pagar-telegram-cfg'], queryFn: () => chamar({ action: 'status' }) });
  const { data: aguardandoConferencia = 0 } = useQuery({
    queryKey: ['contas-pagar-aguardando-conferencia'],
    queryFn: async () => {
      const { count } = await (supabase.from('contas_pagar') as any).select('id', { count: 'exact', head: true })
        .in('conferencia_status' as any, ['pendente_conferencia', 'conferida']).is('deleted_at', null);
      return count ?? 0;
    },
  });
  const { data: cnpjs = [] } = useQuery({
    queryKey: ['unidades-cnpj'],
    queryFn: async () => {
      const { data } = await supabase.from('unidades').select('id, nome, cnpj' as any).eq('ativo', true).order('nome');
      return (data ?? []) as any[];
    },
  });

  const conta = (s: string[]) => docs.filter((d) => s.includes(d.status)).length;
  const kpis = [
    ['Recebidos', docs.length],
    ['Processados', conta(['criado', 'vinculado', 'duplicado', 'conferencia_manual'])],
    ['Lançamentos criados', conta(['criado'])],
    ['Vinculados', conta(['vinculado'])],
    ['Duplicidades', conta(['duplicado'])],
    ['Aguardando unidade', conta(['aguardando_unidade'])],
    ['Erros de leitura', conta(['erro'])],
    ['Aguardando conferência', aguardandoConferencia],
  ] as const;

  const acao = async (id: string, body: Record<string, unknown>) => {
    setOcupado(id);
    try {
      const r = await chamar(body);
      toast({ title: STATUS_LABEL[r?.status] ?? 'Feito', description: r?.erro });
    } catch (e) {
      toast({ title: 'Não foi possível concluir', description: (e as Error).message, variant: 'destructive' });
    }
    setOcupado(null);
    qc.invalidateQueries({ queryKey: ['contas-pagar-telegram-docs'] });
    qc.invalidateQueries({ queryKey: ['contas-pagar'] });
  };

  const salvarCnpj = async (id: string, valor: string) => {
    const cnpj = valor.replace(/\D/g, '') || null;
    if (cnpj && cnpj.length !== 14) {
      toast({ title: 'CNPJ precisa ter 14 números', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('unidades').update({ cnpj } as any).eq('id', id);
    toast(error ? { title: 'Não foi possível salvar o CNPJ', variant: 'destructive' } : { title: 'CNPJ salvo' });
    qc.invalidateQueries({ queryKey: ['unidades-cnpj'] });
  };

  const alternar = async (ativo: boolean) => {
    try {
      await chamar({ action: 'ativar', ativo });
      qc.invalidateQueries({ queryKey: ['contas-pagar-telegram-cfg'] });
      toast({ title: ativo ? 'Leitura do grupo ligada' : 'Leitura do grupo desligada' });
    } catch (e) {
      toast({ title: 'Não foi possível alterar', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Leitura automática do grupo "Contas a Pagar" no Telegram</h3>
          <p className="text-sm text-muted-foreground">
            Documentos enviados ao grupo viram lançamentos pendentes de conferência. Nada é pago ou aprovado automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">{cfg?.ativo ? 'Ligada' : 'Desligada'}</span>
          <Switch checked={!!cfg?.ativo} disabled={!isAdmin} onCheckedChange={alternar} />
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(([label, n]) => (
          <Card key={label} className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{n}</p>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">CNPJ das unidades (pagador)</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {cnpjs.map((u) => (
              <label key={u.id} className="text-sm space-y-1">
                <span className="text-muted-foreground">{u.nome}</span>
                <Input defaultValue={u.cnpj ?? ''} placeholder="00.000.000/0000-00" inputMode="numeric"
                  onBlur={(e) => e.target.value.replace(/\D/g, '') !== (u.cnpj ?? '') && salvarCnpj(u.id, e.target.value)} />
              </label>
            ))}
          </div>
        </Card>
      )}

      <Card className="divide-y">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && docs.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum documento recebido pelo Telegram ainda.</p>}
        {docs.map((d) => (
          <div key={d.id} className="p-3 flex flex-col md:flex-row md:items-center gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{d.dados?.fornecedor ?? d.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {d.remetente} · {formatDateTimeBR(d.recebido_em)}
                {d.dados?.valor != null ? ` · ${formatCurrency(Number(d.dados.valor))}` : ''}
                {d.unidade_id ? ` · ${unidades.find((u) => u.id === d.unidade_id)?.nome ?? ''}` : ''}
              </p>
              {d.erro && <p className="text-xs text-destructive">{d.erro}</p>}
            </div>
            <Badge variant="outline">{STATUS_LABEL[d.status] ?? d.status}</Badge>
            {d.storage_path && (
              <Button size="sm" variant="outline" onClick={async () => {
                const url = await getContaArquivoUrl(d.storage_path);
                if (url) window.open(url, '_blank', 'noopener');
              }}>
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver
              </Button>
            )}
            {d.status === 'aguardando_unidade' && (
              <Select onValueChange={(v) => acao(d.id, { action: 'definir_unidade', doc_id: d.id, unidade_id: v })}>
                <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {d.status === 'erro' && (
              <Button size="sm" variant="outline" disabled={ocupado === d.id}
                onClick={() => acao(d.id, { action: 'reprocessar', doc_id: d.id })}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reprocessar
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
