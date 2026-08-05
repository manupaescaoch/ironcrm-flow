import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageCircle, FileText } from 'lucide-react';
import { DIAS_LABEL_SHORT, TIPO_DISPLAY_LABEL, type TipoDisplay } from '@/lib/cronogramaTipos';
import { NOME_TOKEN, inserirToken } from '@/lib/mensagemPlaceholder';

// Título e tipo_atividade padrão por grupo de exibição
const DEFAULTS: Record<TipoDisplay, { titulo: string; tipo: string }> = {
  ENCERRAMENTO_COORD_UNIDADE:      { titulo: 'ENCERRAMENTO DE TURNO - UNIDADE',       tipo: 'ENCERRAMENTO DE TURNO' },
  RELATORIO_DIARIO_COMERCIAL:      { titulo: 'RELATORIO DIARIO COMERCIAL',            tipo: 'RELATORIO DIARIO' },
  ENCERRAMENTO_TURNO_COORD_HORARIO:{ titulo: 'ENVIO DA GRADE DE HORARIO PARA COORDENADOR', tipo: 'ENVIO DA GRADE DE HORARIO PARA COORDENADOR' },
  ENCERRAMENTO_ESTAGIARIO_LIDER:   { titulo: 'ENCERRAMENTO ESTAGIARIO LIDER',         tipo: 'ENCERRAMENTO ESTAGIARIO LIDER' },
  ENCERRAMENTO_GERENTE_UNIDADE:    { titulo: 'ENCERRAMENTO DE GERENTE DE UNIDADE',    tipo: 'ENCERRAMENTO GERENTE UNIDADE' },
  OUTROS:                          { titulo: '',                                       tipo: '' },
};

const DEFAULT_MENSAGEM: Partial<Record<TipoDisplay, string>> = {
  ENCERRAMENTO_GERENTE_UNIDADE:
    '{NOME}, finalizou o turno?\n\nPreenche agora o formulário de encerramento com tudo o que aconteceu. Esse registro é importante para manter as informações organizadas e a operação rodando bem. 👊\n\nhttps://ironclub-app.com/encerramento-coordenador',
};

interface Props {
  tipo: TipoDisplay | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NewAtividadeDialog({ tipo, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const [unidadeId, setUnidadeId] = useState('');
  const [respId, setRespId] = useState('');
  const [horario, setHorario] = useState('');
  const [dias, setDias] = useState<number[]>([]);
  const [modo, setModo] = useState<'mensagem' | 'formulario'>('mensagem');
  const [mensagem, setMensagem] = useState('');
  const [formularioId, setFormularioId] = useState('');
  const mensagemRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open && tipo) {
      setTitulo(DEFAULTS[tipo].titulo);
      setUnidadeId('');
      setRespId('');
      setHorario('');
      setDias([1, 2, 3, 4, 5]);
      setModo('mensagem');
      setMensagem(DEFAULT_MENSAGEM[tipo] || '');
      setFormularioId('');
    }
  }, [open, tipo]);

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades-list-basic'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('id, nome').order('nome');
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['cronograma-funcionarios-full', unidadeId],
    enabled: open && !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cronograma_funcionarios_full' as any, {
        p_unidade_id: unidadeId,
      });
      if (error) throw error;
      return ((data as any[]) || []).filter((f) => f.ativo) as {
        id: string;
        nome: string;
        telefone: string | null;
      }[];
    },
  });

  const { data: formularios = [] } = useQuery({
    queryKey: ['formularios-por-unidade', unidadeId],
    enabled: open && !!unidadeId && modo === 'formulario',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formularios')
        .select('id, titulo')
        .eq('unidade_id', unidadeId)
        .eq('ativo', true)
        .order('titulo');
      if (error) throw error;
      return data as { id: string; titulo: string }[];
    },
  });

  const toggleDia = (v: number) =>
    setDias((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v].sort((a, b) => a - b)));

  const create = useMutation({
    mutationFn: async () => {
      if (!tipo) throw new Error('Tipo inválido');
      if (!titulo.trim()) throw new Error('Informe o título');
      if (!unidadeId) throw new Error('Selecione a unidade');
      if (!respId) throw new Error('Selecione o responsável');
      if (!horario) throw new Error('Informe o horário');
      if (dias.length === 0) throw new Error('Selecione ao menos um dia');

      const base = {
        titulo: titulo.trim().toUpperCase(),
        unidade_id: unidadeId,
        responsavel_id: respId,
        horario: `${horario}:00`,
        ativo: true,
        tipo_atividade: DEFAULTS[tipo].tipo || null,
        mensagem: modo === 'mensagem' ? (mensagem.trim() || null) : null,
        formulario_id: modo === 'formulario' ? (formularioId || null) : null,
      };
      const rows = dias.map((d) => ({ ...base, dia_semana: d }));
      const { error } = await supabase.from('cronograma_atividades').insert(rows as any);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast({ title: `${n} automação(ões) criada(s)` });
      qc.invalidateQueries({ queryKey: ['admin-all-cronograma-atividades'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  if (!tipo) return null;
  const respSelecionado = funcionarios.find((f) => f.id === respId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova automação</DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">{TIPO_DISPLAY_LABEL[tipo]}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value.toUpperCase())} placeholder="TÍTULO DA ATIVIDADE" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Unidade</label>
            <Select value={unidadeId} onValueChange={(v) => { setUnidadeId(v); setRespId(''); setFormularioId(''); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Responsável</label>
            <Select value={respId} onValueChange={setRespId} disabled={!unidadeId}>
              <SelectTrigger><SelectValue placeholder={unidadeId ? 'Selecionar responsável' : 'Selecione a unidade antes'} /></SelectTrigger>
              <SelectContent>
                {funcionarios.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}{f.telefone ? ` — ${f.telefone}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {respSelecionado?.telefone && (
              <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-3 py-2">
                <MessageCircle className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold">{respSelecionado.nome}</span>
                <span className="text-muted-foreground">— WhatsApp: {respSelecionado.telefone}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Horário</label>
            <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Dias da semana</label>
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS_LABEL_SHORT.map((lbl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDia(idx)}
                  className={
                    'py-2 rounded-md border text-xs font-medium transition-colors ' +
                    (dias.includes(idx)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-input')
                  }
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDias([1, 2, 3, 4, 5])}>Seg–Sex</Button>
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDias([0, 6])}>Fim de semana</Button>
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDias([0, 1, 2, 3, 4, 5, 6])}>Todos</Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setDias([])}>Limpar</Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ação WhatsApp</label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={modo === 'formulario' ? 'default' : 'outline'} onClick={() => setModo('formulario')} className="justify-start">
                <FileText className="w-4 h-4 mr-2" /> Vincular Formulário
              </Button>
              <Button type="button" variant={modo === 'mensagem' ? 'default' : 'outline'} onClick={() => setModo('mensagem')} className="justify-start">
                <MessageCircle className="w-4 h-4 mr-2" /> Escrever Mensagem
              </Button>
            </div>
            {modo === 'formulario' ? (
              <Select value={formularioId} onValueChange={setFormularioId} disabled={!unidadeId}>
                <SelectTrigger><SelectValue placeholder="Selecionar formulário" /></SelectTrigger>
                <SelectContent>
                  {formularios.map((f) => <SelectItem key={f.id} value={f.id}>{f.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Textarea
                  ref={mensagemRef}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Mensagem enviada via WhatsApp..."
                  rows={4}
                  className="normal-case"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => inserirToken(mensagemRef.current, mensagem, NOME_TOKEN, setMensagem)}
                  >
                    Inserir [nome]
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    [nome] é trocado pelo primeiro nome do responsável no envio.
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Criar automação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
