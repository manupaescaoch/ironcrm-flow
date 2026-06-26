import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Star, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';

const UNIDADES = ['MADALENA', 'BOA VIAGEM', 'SETÚBAL'];

const PONTOS_POSITIVOS = [
  'Facilidade de agendamento',
  'Qualidade dos equipamentos',
  'Atenção dos treinadores',
  'Ambiente / clima',
  'Resultado / evolução',
  'Limpeza',
];

const PONTOS_MELHORIA = [
  'Mais horários disponíveis',
  'Mais equipamentos',
  'Atendimento da recepção',
  'Aplicativo / sistema',
  'Vestiário',
  'Planos / preços',
];

const TEMPOS = ['Menos de 1 mês', '1 a 3 meses', '3 a 6 meses', '6 meses a 1 ano', 'Mais de 1 ano'];

const schema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome').max(120),
  whatsapp: z.string().trim().min(10, 'Informe um WhatsApp válido').max(20),
  unidade_nome: z.string().min(1, 'Selecione a unidade'),
  nota_nps: z.number().int().min(0).max(10),
  estrelas_estrutura: z.number().int().min(1).max(5),
  estrelas_equipe: z.number().int().min(1).max(5),
  estrelas_treino: z.number().int().min(1).max(5),
  tempo_aluno: z.string().min(1, 'Selecione o tempo'),
  comentario: z.string().max(1000).optional(),
});

function notaColor(n: number) {
  if (n <= 6) return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
  if (n <= 8) return 'bg-warning text-warning-foreground hover:bg-warning/90';
  return 'bg-success text-success-foreground hover:bg-success/90';
}

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'w-8 h-8',
                s <= value ? 'fill-warning text-warning' : 'text-muted-foreground/40',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a})`, b && ` ${b}`, c && `-${c}`].filter(Boolean).join(''));
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
}

export default function NpsPublico() {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [unidade, setUnidade] = useState('');
  const [nota, setNota] = useState<number | null>(null);
  const [eEstrutura, setEEstrutura] = useState(0);
  const [eEquipe, setEEquipe] = useState(0);
  const [eTreino, setETreino] = useState(0);
  const [positivos, setPositivos] = useState<string[]>([]);
  const [melhorias, setMelhorias] = useState<string[]>([]);
  const [tempo, setTempo] = useState('');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (arr: string[], setter: (v: string[]) => void, val: string) =>
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      nome,
      whatsapp,
      unidade_nome: unidade,
      nota_nps: nota ?? -1,
      estrelas_estrutura: eEstrutura,
      estrelas_equipe: eEquipe,
      estrelas_treino: eTreino,
      tempo_aluno: tempo,
      comentario: comentario || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Verifique os campos');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('nps_respostas').insert({
      nome: parsed.data.nome.toUpperCase(),
      whatsapp: parsed.data.whatsapp.replace(/\D/g, ''),
      unidade_nome: parsed.data.unidade_nome,
      nota_nps: parsed.data.nota_nps,
      estrelas_estrutura: parsed.data.estrelas_estrutura,
      estrelas_equipe: parsed.data.estrelas_equipe,
      estrelas_treino: parsed.data.estrelas_treino,
      pontos_positivos: positivos,
      pontos_melhoria: melhorias,
      tempo_aluno: parsed.data.tempo_aluno,
      comentario: parsed.data.comentario ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error('Erro ao enviar avaliação. Tente novamente.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="pt-10 pb-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
            <h1 className="text-2xl font-bold">Obrigado pela sua avaliação!</h1>
            <p className="text-muted-foreground">
              Sua opinião é muito importante para continuarmos evoluindo a Iron Lifting Club.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">Pesquisa de Experiência Iron</h1>
          <p className="text-muted-foreground mt-1">Iron Lifting Club — sua opinião conta muito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Seus dados</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome completo *</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} maxLength={120} required />
              </div>
              <div>
                <Label htmlFor="wpp">WhatsApp *</Label>
                <Input id="wpp" value={whatsapp} onChange={(e) => setWhatsapp(maskPhone(e.target.value))} placeholder="(81) 99999-9999" required />
              </div>
              <div>
                <Label>Unidade *</Label>
                <Select value={unidade} onValueChange={setUnidade}>
                  <SelectTrigger><SelectValue placeholder="Selecione sua unidade" /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Em uma escala de 0 a 10, o quanto você recomendaria a Iron Lifting Club? *</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
                {Array.from({ length: 11 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNota(i)}
                    className={cn(
                      'aspect-square rounded-lg font-bold text-lg transition-all border-2',
                      nota === i
                        ? `${notaColor(i)} border-foreground scale-105`
                        : 'border-border bg-card hover:bg-muted',
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Nada provável</span>
                <span>Muito provável</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Avalie estes pontos *</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <Stars value={eEstrutura} onChange={setEEstrutura} label="Estrutura da Academia" />
              <Stars value={eEquipe} onChange={setEEquipe} label="Equipe / atendimento" />
              <Stars value={eTreino} onChange={setETreino} label="Qualidade do treino" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">O que você mais gosta?</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              {PONTOS_POSITIVOS.map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={positivos.includes(p)} onCheckedChange={() => toggle(positivos, setPositivos, p)} />
                  <span className="text-sm">{p}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">O que poderia melhorar?</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              {PONTOS_MELHORIA.map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={melhorias.includes(p)} onCheckedChange={() => toggle(melhorias, setMelhorias, p)} />
                  <span className="text-sm">{p}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Há quanto tempo você treina conosco? *</CardTitle></CardHeader>
            <CardContent>
              <RadioGroup value={tempo} onValueChange={setTempo} className="space-y-2">
                {TEMPOS.map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value={t} />
                    <span className="text-sm">{t}</span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Comentário (opcional)</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={1000} rows={4} placeholder="Conte como tem sido sua experiência..." />
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="w-full h-12 text-base">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : 'Enviar avaliação'}
          </Button>
        </form>
      </div>
    </div>
  );
}
