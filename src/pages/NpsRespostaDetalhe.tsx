import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, Star, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

type Resposta = {
  id: string;
  nome: string;
  whatsapp: string;
  unidade_id: string | null;
  unidade_nome: string;
  nota_nps: number;
  estrelas_estrutura: number;
  estrelas_equipe: number;
  estrelas_treino: number;
  pontos_positivos: string[];
  pontos_melhoria: string[];
  tempo_aluno: string;
  comentario: string | null;
  categoria: 'detrator' | 'passivo' | 'promotor';
  created_at: string;
  status: 'novo' | 'em_contato' | 'concluido';
  acao_corretiva: string | null;
  prazo: string | null;
};

const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'em_contato', label: 'Em contato' },
  { value: 'concluido', label: 'Concluído' },
] as const;

function statusBadge(s: string) {
  if (s === 'concluido') return 'bg-success text-success-foreground';
  if (s === 'em_contato') return 'bg-warning text-warning-foreground';
  return 'bg-muted text-muted-foreground';
}

function categoriaBadge(cat: string) {
  if (cat === 'promotor') return 'bg-success text-success-foreground';
  if (cat === 'passivo') return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn('w-4 h-4', s <= value ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}

export default function NpsRespostaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const { data: resposta, isLoading } = useQuery({
    queryKey: ['nps-resposta', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('nps_respostas').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as Resposta | null;
    },
  });

  const [status, setStatus] = useState<string>('novo');
  const [acaoCorretiva, setAcaoCorretiva] = useState('');
  const [prazo, setPrazo] = useState('');

  useEffect(() => {
    if (resposta) {
      setStatus(resposta.status ?? 'novo');
      setAcaoCorretiva(resposta.acao_corretiva ?? '');
      setPrazo(resposta.prazo ?? '');
    }
  }, [resposta]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('nps_respostas')
        .update({ status, acao_corretiva: acaoCorretiva || null, prazo: prazo || null })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nps-resposta', id] });
      queryClient.invalidateQueries({ queryKey: ['nps-respostas'] });
      toast.success('Acompanhamento salvo.');
    },
    onError: (e: any) => toast.error('Erro ao salvar: ' + (e?.message ?? 'tente novamente')),
  });

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={() => navigate('/nps/respostas')}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !resposta ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Avaliação não encontrada.</div>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold">{resposta.nome}</h1>
              <Badge className={cn('font-bold text-base px-3', categoriaBadge(resposta.categoria))}>
                {resposta.nota_nps}
              </Badge>
              <Badge variant="outline" className="capitalize">{resposta.categoria}</Badge>
              <Badge className={cn('capitalize', statusBadge(resposta.status))}>
                {STATUS_OPTIONS.find((o) => o.value === resposta.status)?.label ?? resposta.status}
              </Badge>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Acompanhamento do caso</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</div>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Prazo</div>
                    <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ação corretiva</div>
                  <Textarea
                    value={acaoCorretiva}
                    onChange={(e) => setAcaoCorretiva(e.target.value)}
                    placeholder="Descreva a ação corretiva realizada ou planejada para este caso..."
                    rows={4}
                  />
                </div>
                <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gap-2">
                  {salvar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar acompanhamento
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 grid grid-cols-2 gap-3">
                <Info label="Unidade" value={resposta.unidade_nome} />
                <Info label="WhatsApp" value={resposta.whatsapp} />
                <Info label="Tempo de aluno" value={resposta.tempo_aluno} />
                <Info label="Data" value={format(new Date(resposta.created_at), "dd/MM/yyyy 'às' HH:mm")} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Avaliação por área</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {([
                  ['Estrutura', resposta.estrelas_estrutura],
                  ['Equipe', resposta.estrelas_equipe],
                  ['Treino', resposta.estrelas_treino],
                ] as [string, number][]).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
                    <Stars value={value} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Pontos positivos</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 flex flex-wrap gap-1.5">
                {resposta.pontos_positivos?.length
                  ? resposta.pontos_positivos.map((p) => (
                      <Badge key={p} variant="outline" className="border-success/40 text-success">{p}</Badge>
                    ))
                  : <span className="text-muted-foreground text-xs">—</span>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Pontos de melhoria</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 flex flex-wrap gap-1.5">
                {resposta.pontos_melhoria?.length
                  ? resposta.pontos_melhoria.map((p) => (
                      <Badge key={p} variant="outline" className="border-warning/40 text-warning">{p}</Badge>
                    ))
                  : <span className="text-muted-foreground text-xs">—</span>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Comentário</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">
                  {resposta.comentario || '—'}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
