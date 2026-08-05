import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface FormularioOrigem {
  tabela: string;
  id: string;
}

const TABELA_LABEL: Record<string, string> = {
  encerramento_horario_respostas: 'Encerramento de Horário',
  encerramento_coordenador_respostas: 'Encerramento do Coordenador',
  encerramento_turno_respostas: 'Encerramento de Turno',
};

const OCULTAR = new Set(['id', 'user_id', 'created_by', 'updated_at']);

const rotulo = (k: string) =>
  k
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

const valorTexto = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export function FormularioOrigemDialog({
  origem,
  onClose,
}: {
  origem: FormularioOrigem | null;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['formulario-origem', origem?.tabela, origem?.id],
    enabled: !!origem && origem.tabela !== 'formulario_previsto',
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(origem!.tabela)
        .select('*')
        .eq('id', origem!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
  });

  return (
    <Dialog open={!!origem} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4" />
            {origem ? TABELA_LABEL[origem.tabela] ?? 'Formulário de origem' : 'Formulário de origem'}
          </DialogTitle>
        </DialogHeader>

        {origem?.tabela === 'formulario_previsto' ? (
          <p className="text-sm text-muted-foreground">
            Este item indica um formulário previsto que não foi preenchido — não há registro de origem para consultar.
          </p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando formulário…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Não foi possível abrir o formulário: {(error as Error).message}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Registro não encontrado ou sem permissão de leitura.</p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="divide-y rounded-md border">
              {Object.entries(data)
                .filter(([k, v]) => !OCULTAR.has(k) && v !== null && v !== '')
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[40%_60%] gap-2 p-2 text-xs">
                    <span className="text-muted-foreground">{rotulo(k)}</span>
                    <span className="whitespace-pre-wrap break-words">{valorTexto(v)}</span>
                  </div>
                ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
