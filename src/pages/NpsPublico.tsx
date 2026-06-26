import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, CheckCircle2, Loader2, ChevronDown, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ironLogo from '@/assets/iron-logo-banner.png.asset.json';

const IRON_BLUE = '#0a6cff';
const IRON_BLUE_DARK = '#0857cc';

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

const TEMPOS = [
  'Menos de 1 mês',
  '1 a 3 meses',
  '3 a 6 meses',
  '6 meses a 1 ano',
  'Mais de 1 ano',
];

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

function Stars({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div className="flex gap-1.5 sm:gap-2">
        {[1, 2, 3, 4, 5].map((s) => {
          const active = s <= (hover || value);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              className="p-1 rounded-md transition-transform hover:scale-110 active:scale-95"
              aria-label={`${s} estrela${s > 1 ? 's' : ''}`}
            >
              <Star
                className={cn(
                  'w-9 h-9 sm:w-10 sm:h-10 transition-colors',
                  active ? 'fill-current' : 'text-slate-300',
                )}
                style={active ? { color: IRON_BLUE } : undefined}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a})`, b && ` ${b}`, c && `-${c}`].filter(Boolean).join(''),
    );
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] p-6 sm:p-8">
      <header className="mb-5">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function ChipOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all',
        'hover:border-slate-300 hover:bg-slate-50',
        active
          ? 'border-[1.5px] text-slate-900 shadow-sm'
          : 'border-slate-200 text-slate-700 bg-white',
      )}
      style={
        active
          ? { borderColor: IRON_BLUE, backgroundColor: 'rgba(10,108,255,0.07)' }
          : undefined
      }
    >
      <span className="flex items-center gap-2.5">
        <span
          className={cn(
            'inline-flex w-4 h-4 rounded-full border items-center justify-center shrink-0',
            active ? 'border-transparent' : 'border-slate-300',
          )}
          style={active ? { backgroundColor: IRON_BLUE } : undefined}
        >
          {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
        {children}
      </span>
    </button>
  );
}

export default function NpsPublico() {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [unidade, setUnidade] = useState('');
  const [nota, setNota] = useState<number | null>(null);
  const [hoverNota, setHoverNota] = useState<number | null>(null);
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center space-y-4">
          <div
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(10,108,255,0.1)' }}
          >
            <CheckCircle2 className="w-9 h-9" style={{ color: IRON_BLUE }} />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Avaliação enviada
          </h1>
          <p className="text-slate-600">
            Obrigado por ajudar a Iron a evoluir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="w-full bg-black flex items-center justify-center py-6 px-4">
        <img src={ironLogo.url} alt="Iron Lifting Club" className="h-12 sm:h-16 w-auto object-contain" />
      </div>
      <div className="py-10 sm:py-14 px-4">
      <div className="max-w-[780px] mx-auto">
        {/* Header */}
        <header className="text-center mb-8 sm:mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase mb-5"
            style={{
              color: IRON_BLUE,
              backgroundColor: 'rgba(10,108,255,0.1)',
            }}
          >
            Iron Lifting Club
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Pesquisa de Experiência Iron
          </h1>
          <p className="text-slate-600 mt-3 text-base sm:text-lg max-w-xl mx-auto">
            Sua opinião ajuda a Iron a evoluir todos os dias.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Leva menos de 1 minuto e faz diferença de verdade.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Dados */}
          <SectionCard title="Seus dados">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-sm font-medium text-slate-700">
                  Nome completo
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value.toUpperCase())}
                  maxLength={120}
                  required
                  className="h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-offset-0"
                  style={{ ['--tw-ring-color' as any]: IRON_BLUE }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wpp" className="text-sm font-medium text-slate-700">
                  WhatsApp
                </Label>
                <Input
                  id="wpp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                  placeholder="(81) 99999-9999"
                  required
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Unidade</Label>
                <Select value={unidade} onValueChange={setUnidade}>
                  <SelectTrigger className="h-12 rounded-xl border-slate-200 [&>svg]:hidden pr-3">
                    <SelectValue placeholder="Selecione sua unidade" />
                    <ChevronDown className="w-4 h-4 text-slate-400 ml-2" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* NPS */}
          <SectionCard
            title="O quanto você recomendaria a Iron?"
            description="De 0 (nada provável) a 10 (muito provável)."
          >
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
              {Array.from({ length: 11 }).map((_, i) => {
                const active = nota === i;
                const isHover = hoverNota === i && !active;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNota(i)}
                    onMouseEnter={() => setHoverNota(i)}
                    onMouseLeave={() => setHoverNota(null)}
                    className={cn(
                      'aspect-square rounded-xl font-semibold text-base sm:text-lg transition-all border',
                      active
                        ? 'text-white border-transparent shadow-md scale-[1.04]'
                        : 'border-slate-200 text-slate-700 bg-white hover:border-slate-300',
                    )}
                    style={
                      active
                        ? { backgroundColor: IRON_BLUE }
                        : isHover
                        ? { backgroundColor: 'rgba(10,108,255,0.06)' }
                        : undefined
                    }
                  >
                    {i}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-500 mt-3 px-1">
              <span>Nada provável</span>
              <span>Muito provável</span>
            </div>
          </SectionCard>

          {/* Estrelas */}
          <SectionCard title="Avalie estes pontos">
            <div className="space-y-6">
              <Stars value={eEstrutura} onChange={setEEstrutura} label="Estrutura da Academia" />
              <Stars value={eEquipe} onChange={setEEquipe} label="Equipe / atendimento" />
              <Stars value={eTreino} onChange={setETreino} label="Qualidade do treino" />
            </div>
          </SectionCard>

          {/* Positivos */}
          <SectionCard title="O que você mais gosta?" description="Selecione quantos quiser.">
            <div className="grid sm:grid-cols-2 gap-2.5">
              {PONTOS_POSITIVOS.map((p) => (
                <ChipOption
                  key={p}
                  active={positivos.includes(p)}
                  onClick={() => toggle(positivos, setPositivos, p)}
                >
                  {p}
                </ChipOption>
              ))}
            </div>
          </SectionCard>

          {/* Melhorias */}
          <SectionCard title="O que poderia melhorar?" description="Selecione quantos quiser.">
            <div className="grid sm:grid-cols-2 gap-2.5">
              {PONTOS_MELHORIA.map((p) => (
                <ChipOption
                  key={p}
                  active={melhorias.includes(p)}
                  onClick={() => toggle(melhorias, setMelhorias, p)}
                >
                  {p}
                </ChipOption>
              ))}
            </div>
          </SectionCard>

          {/* Tempo */}
          <SectionCard title="Há quanto tempo você treina conosco?">
            <div className="grid sm:grid-cols-2 gap-2.5">
              {TEMPOS.map((t) => (
                <ChipOption
                  key={t}
                  active={tempo === t}
                  onClick={() => setTempo(t)}
                >
                  {t}
                </ChipOption>
              ))}
            </div>
          </SectionCard>

          {/* Comentário */}
          <SectionCard title="Comentário" description="Opcional.">
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Conte pra gente o que está funcionando bem ou o que podemos melhorar…"
              className="rounded-xl border-slate-200 resize-none text-base"
            />
          </SectionCard>

          {/* Submit */}
          <div className="pt-2 space-y-4">
            <p className="flex items-center justify-center gap-2 text-xs text-slate-500 text-center">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Sua resposta é confidencial e será usada para melhorar sua experiência dentro da Iron.
            </p>
            <Button
              type="submit"
              disabled={saving}
              className="w-full text-white font-semibold rounded-xl text-base shadow-md transition-colors border-0"
              style={{
                backgroundColor: IRON_BLUE,
                minHeight: 52,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = IRON_BLUE_DARK)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = IRON_BLUE)
              }
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                </>
              ) : (
                'Enviar avaliação'
              )}
            </Button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
