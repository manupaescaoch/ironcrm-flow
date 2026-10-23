import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ShieldCheck, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ContaPagar, formatDateTimeBR } from './constants';

const LABEL: Record<string, string> = {
  pendente_conferencia: 'Pendente de conferência',
  conferida: 'Conferida — aguardando aprovação',
  aprovada: 'Aprovada',
};

/** Origem Telegram + conferência (financeiro) e aprovação (administração). Nunca dá baixa. */
export function ConferenciaConta({ conta, canManage }: { conta: ContaPagar; canManage: boolean }) {
  const { isAdmin, userName } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const c = conta as any;
  if (!c.conferencia_status && c.origem !== 'telegram') return null;

  const atualizar = async (patch: Record<string, unknown>, campo: string, texto: string) => {
    setSalvando(true);
    const { error } = await supabase.from('contas_pagar').update(patch as any).eq('id', conta.id);
    if (!error) {
      await supabase.from('contas_pagar_historico').insert({ conta_id: conta.id, acao: 'edicao', campo, valor_novo: texto, user_nome: (userName ?? '').toUpperCase() } as any);
      qc.invalidateQueries({ queryKey: ['contas-pagar'] });
      qc.invalidateQueries({ queryKey: ['contas-pagar-historico'] });
      toast({ title: texto });
    } else {
      toast({ title: 'Não foi possível salvar', description: error.message, variant: 'destructive' });
    }
    setSalvando(false);
  };
  const agora = new Date().toISOString();
  const nome = (userName ?? '').toUpperCase();

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Conferência</h4>
        {c.conferencia_status && <Badge variant="outline">{LABEL[c.conferencia_status]}</Badge>}
      </div>
      {c.origem === 'telegram' && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Send className="w-3.5 h-3.5" /> Recebida pelo Telegram de {c.telegram_remetente ?? '—'}
          {c.recebido_em ? ` em ${formatDateTimeBR(c.recebido_em)}` : ''}
        </p>
      )}
      {c.fornecedor_validar && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Fornecedor não cadastrado: validar antes de aprovar.
        </p>
      )}
      {c.conferido_em && <p className="text-xs text-muted-foreground">Conferida por {c.conferido_por_nome} em {formatDateTimeBR(c.conferido_em)}</p>}
      {c.aprovado_em && <p className="text-xs text-muted-foreground">Aprovada por {c.aprovado_por_nome} em {formatDateTimeBR(c.aprovado_em)}</p>}
      <div className="flex flex-wrap gap-2">
        {canManage && c.conferencia_status === 'pendente_conferencia' && (
          <Button size="sm" disabled={salvando} onClick={() => atualizar(
            { conferencia_status: 'conferida', conferido_por_nome: nome, conferido_em: agora, fornecedor_validar: false },
            'conferencia', 'Conta conferida')}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar como conferida
          </Button>
        )}
        {isAdmin && c.conferencia_status === 'conferida' && (
          <Button size="sm" disabled={salvando} onClick={() => atualizar(
            { conferencia_status: 'aprovada', aprovado_por_nome: nome, aprovado_em: agora },
            'aprovacao', 'Conta aprovada')}>
            <ShieldCheck className="w-4 h-4 mr-1" /> Aprovar
          </Button>
        )}
      </div>
    </div>
  );
}
