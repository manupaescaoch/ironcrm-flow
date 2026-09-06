import { useState } from 'react';
import { Clock, User, Paperclip, ChevronRight, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { toDateKey } from '@/hooks/useOpsExecucao';
import { OpsStatusBadge } from '@/components/ops/OpsStatusBadge';
import { AtividadeExecucaoPanel } from '@/components/ops/AtividadeExecucaoPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { OpsTarefaDoDia } from '@/hooks/useOpsMeuDia';
import { cn } from '@/lib/utils';

export const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  critica: 'Crítica',
};

export const PRIORIDADE_DOT: Record<string, string> = {
  baixa: 'bg-emerald-500',
  normal: 'bg-primary',
  alta: 'bg-amber-500',
  critica: 'bg-destructive',
};

export function OpsTarefaRow({ tarefa, onClick }: { tarefa: OpsTarefaDoDia; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/40"
    >
      <div className="w-14 shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {tarefa.horario ? tarefa.horario.slice(0, 5) : '--:--'}
        </p>
        <span
          className={cn('mt-1 block h-1.5 w-1.5 rounded-full', PRIORIDADE_DOT[tarefa.prioridade || 'normal'])}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tarefa.titulo}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {tarefa.responsavel_nome && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {tarefa.responsavel_nome}
            </span>
          )}
          {tarefa.setor && <span>{tarefa.setor}</span>}
          {tarefa.prazo && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> até {tarefa.prazo.slice(0, 5)}
            </span>
          )}
          {tarefa.exige_evidencia && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> evidência
            </span>
          )}
          {tarefa.prioridade === 'critica' && <span className="font-medium text-destructive">Crítica</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <OpsStatusBadge status={tarefa.status} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

function RotinaExecucaoPanel({
  rotinaId,
  unidadeId,
  data,
  concluida,
}: {
  rotinaId: string;
  unidadeId: string;
  data: Date;
  concluida: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [feito, setFeito] = useState(concluida);
  const dataKey = toDateKey(data);

  const marcar = async (valor: boolean) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const nome =
        (userData.user?.user_metadata as any)?.full_name ||
        (userData.user?.user_metadata as any)?.name ||
        userData.user?.email ||
        'Usuário';
      const { data: existing } = await supabase
        .from('rotina_execucoes')
        .select('id')
        .eq('rotina_id', rotinaId)
        .eq('data_execucao', dataKey)
        .is('atividade_id', null)
        .maybeSingle();

      const patch = {
        concluida: valor,
        concluida_por: valor ? nome : null,
        concluida_em: valor ? new Date().toISOString() : null,
      };

      const { error } = existing
        ? await supabase.from('rotina_execucoes').update(patch as any).eq('id', (existing as any).id)
        : await supabase.from('rotina_execucoes').insert({
            rotina_id: rotinaId,
            data_execucao: dataKey,
            unidade_id: unidadeId,
            ...patch,
          } as any);
      if (error) throw error;
      setFeito(valor);
      toast({ title: valor ? 'Rotina concluída' : 'Conclusão desfeita' });
    } catch (e: any) {
      toast({ title: 'Não foi possível salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Rotina da unidade</p>
      <Button
        type="button"
        variant={feito ? 'outline' : 'default'}
        className="w-full"
        disabled={saving}
        onClick={() => marcar(!feito)}
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
        {feito ? 'Desfazer conclusão' : 'Marcar como concluída'}
      </Button>
    </div>
  );
}

export function OpsTarefaSheet({
  tarefa,
  data,
  onClose,
}: {
  tarefa: OpsTarefaDoDia | null;
  data: Date;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!tarefa} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="ops-theme max-h-[92vh] overflow-y-auto rounded-t-3xl">
        {tarefa && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="pr-8 text-base">{tarefa.titulo}</SheetTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {tarefa.horario && <span>{tarefa.horario.slice(0, 5)}</span>}
                {tarefa.responsavel_nome && <span>{tarefa.responsavel_nome}</span>}
                {tarefa.setor && <span>{tarefa.setor}</span>}
                <span>Prioridade: {PRIORIDADE_LABEL[tarefa.prioridade || 'normal']}</span>
              </div>
            </SheetHeader>

            {tarefa.descricao && (
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{tarefa.descricao}</p>
            )}

            <div className="mt-4">
              {tarefa.tipo === 'rotina' ? (
                <RotinaExecucaoPanel
                  rotinaId={tarefa.id}
                  unidadeId={tarefa.unidade_id}
                  data={data}
                  concluida={tarefa.status === 'concluida'}
                />
              ) : (
              <AtividadeExecucaoPanel
                atividadeId={tarefa.id}
                unidadeId={tarefa.unidade_id}
                data={data}
                horario={tarefa.horario}
                prazo={tarefa.prazo}
                exigeEvidencia={tarefa.exige_evidencia}
                exigeConfirmacao={tarefa.exige_confirmacao}
                instrucao={tarefa.instrucao}
              />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
