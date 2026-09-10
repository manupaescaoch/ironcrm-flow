import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle2, Loader2, ChevronLeft, Check } from 'lucide-react';
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

const BLUE = '#0a6cff';

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

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a})`, b && ` ${b}`, c && `-${c}`].filter(Boolean).join(''),
    );
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
}

/* ---------- primitivos visuais ---------- */

function StepFrame({
  progress,
  onBack,
  eyebrow,
  title,
  hint,
  children,
  footer,
}: {
  progress?: { current: number; total: number };
  onBack?: () => void;
  eyebrow?: string;
  title: string;
  hint?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#08090c] text-white">
      <header className="sticky top-0 z-20 bg-[#08090c]/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-sm text-white/50 transition-colors hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </button>
          ) : (
            <span className="text-sm font-semibold tracking-[0.22em] text-white/70">
              EVO CLUB
            </span>
          )}
          {progress && (
            <span className="text-xs font-medium tabular-nums text-white/40">
              {progress.current} de {progress.total}
            </span>
          )}
        </div>
        {progress && (
          <div className="h-[2px] w-full bg-white/10">
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
                backgroundColor: BLUE,
              }}
            />
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-lg px-6 pb-40 pt-10">
        {eyebrow && (
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: BLUE }}
          >
            {eyebrow}
          </p>
        )}
        <h1 className="text-[27px] font-semibold leading-[1.2] tracking-tight text-white">
          {title}
        </h1>
        {hint && <p className="mt-3 text-[15px] leading-relaxed text-white/45">{hint}</p>}
        {children && <div className="mt-8">{children}</div>}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-[#08090c]/95 backdrop-blur">
        <div className="mx-auto w-full max-w-lg space-y-2 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      </footer>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  loading,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="h-14 w-full rounded-2xl border-0 text-base font-semibold text-white shadow-lg transition-opacity disabled:opacity-30"
      style={{ backgroundColor: BLUE }}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

function Option({
  active,
  onClick,
  children,
  multi,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left text-[15px] font-medium transition-all',
        active
          ? 'border-transparent bg-white/[0.08] text-white'
          : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20',
      )}
      style={active ? { borderColor: BLUE } : undefined}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center border',
          multi ? 'rounded-md' : 'rounded-full',
          active ? 'border-transparent' : 'border-white/25',
        )}
        style={active ? { backgroundColor: BLUE } : undefined}
      >
        {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}

function StarsRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex justify-between gap-2">
      {[1, 2, 3, 4, 5].map((s) => {
        const active = s <= value;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-label={`${s} estrela${s > 1 ? 's' : ''}`}
            className="flex h-16 flex-1 items-center justify-center rounded-2xl border transition-all active:scale-95"
            style={{
              borderColor: active ? BLUE : 'rgba(255,255,255,0.10)',
              backgroundColor: active ? 'rgba(10,108,255,0.10)' : 'rgba(255,255,255,0.02)',
            }}
          >
            <Star
              className={cn('h-7 w-7', active ? 'fill-current' : 'text-white/25')}
              style={active ? { color: BLUE } : undefined}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ---------- página ---------- */

type Phase = 'ident' | 'confirm' | 'quiz' | 'done';

export default function NpsPublico() {
  const [phase, setPhase] = useState<Phase>('ident');
  const [step, setStep] = useState(0);

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

  const animKey = `${phase}-${step}`;
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [animKey]);

  const toggle = (arr: string[], setter: (v: string[]) => void, val: string) =>
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const identOk =
    nome.trim().length >= 2 && unidade !== '' && whatsapp.replace(/\D/g, '').length >= 10;

  const steps = useMemo(
    () => [
      {
        title: 'De 0 a 10, o quanto você recomendaria a EVO Club para um amigo ou familiar?',
        eyebrow: 'Recomendação',
        valid: nota !== null,
        render: () => (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2.5">
              {Array.from({ length: 11 }).map((_, i) => {
                const active = nota === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNota(i)}
                    className={cn(
                      'flex h-16 items-center justify-center rounded-2xl border text-lg font-semibold transition-all active:scale-95',
                      active ? 'text-white' : 'text-white/70',
                    )}
                    style={{
                      borderColor: active ? BLUE : 'rgba(255,255,255,0.10)',
                      backgroundColor: active ? BLUE : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-white/35">
              <span>Nada provável</span>
              <span>Muito provável</span>
            </div>
          </div>
        ),
      },
      {
        title: 'Como você avalia a estrutura da academia?',
        eyebrow: 'Estrutura',
        valid: eEstrutura > 0,
        render: () => <StarsRow value={eEstrutura} onChange={setEEstrutura} />,
      },
      {
        title: 'E a equipe e o atendimento?',
        eyebrow: 'Equipe',
        valid: eEquipe > 0,
        render: () => <StarsRow value={eEquipe} onChange={setEEquipe} />,
      },
      {
        title: 'E a qualidade do treino?',
        eyebrow: 'Treino',
        valid: eTreino > 0,
        render: () => <StarsRow value={eTreino} onChange={setETreino} />,
      },
      {
        title: 'O que mais contribuiu para essa nota?',
        eyebrow: 'Pontos fortes',
        hint: 'Selecione quantos quiser.',
        valid: true,
        render: () => (
          <div className="space-y-3">
            {PONTOS_POSITIVOS.map((p) => (
              <Option
                key={p}
                multi
                active={positivos.includes(p)}
                onClick={() => toggle(positivos, setPositivos, p)}
              >
                {p}
              </Option>
            ))}
          </div>
        ),
      },
      {
        title: 'O que poderia melhorar?',
        eyebrow: 'Melhorias',
        hint: 'Selecione quantos quiser.',
        valid: true,
        render: () => (
          <div className="space-y-3">
            {PONTOS_MELHORIA.map((p) => (
              <Option
                key={p}
                multi
                active={melhorias.includes(p)}
                onClick={() => toggle(melhorias, setMelhorias, p)}
              >
                {p}
              </Option>
            ))}
          </div>
        ),
      },
      {
        title: 'Há quanto tempo você treina com a gente?',
        eyebrow: 'Tempo de casa',
        valid: tempo !== '',
        render: () => (
          <div className="space-y-3">
            {TEMPOS.map((t) => (
              <Option key={t} active={tempo === t} onClick={() => setTempo(t)}>
                {t}
              </Option>
            ))}
          </div>
        ),
      },
      {
        title: 'Quer deixar um comentário?',
        eyebrow: 'Comentário',
        hint: 'Opcional. Sua resposta é confidencial.',
        valid: true,
        render: () => (
          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={1000}
            rows={8}
            placeholder="Conte pra gente o que está funcionando bem ou o que podemos melhorar…"
            className="min-h-[190px] resize-none rounded-2xl border-white/10 bg-white/[0.03] p-5 text-base text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-offset-0"
          />
        ),
      },
    ],
    [nota, eEstrutura, eEquipe, eTreino, positivos, melhorias, tempo, comentario],
  );

  async function handleSubmit() {
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
    const { error } = await supabase.rpc('submit_nps_resposta', {
      p_nome: parsed.data.nome,
      p_whatsapp: parsed.data.whatsapp.replace(/\D/g, ''),
      p_unidade_nome: parsed.data.unidade_nome,
      p_nota_nps: parsed.data.nota_nps,
      p_estrelas_estrutura: parsed.data.estrelas_estrutura,
      p_estrelas_equipe: parsed.data.estrelas_equipe,
      p_estrelas_treino: parsed.data.estrelas_treino,
      p_pontos_positivos: positivos,
      p_pontos_melhoria: melhorias,
      p_tempo_aluno: parsed.data.tempo_aluno,
      p_comentario: parsed.data.comentario ?? null,
    });
    setSaving(false);
    if (error) {
      console.error('[nps submit]', error);
      toast.error(
        error.message
          ? `Erro ao enviar avaliação: ${error.message}`
          : 'Erro ao enviar avaliação. Tente novamente.',
      );
      return;
    }
    setPhase('done');
  }

  /* ----- telas ----- */

  if (phase === 'done') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#08090c] px-8 text-center text-white">
        <div className="max-w-sm space-y-5" key={animKey}>
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(10,108,255,0.14)' }}
          >
            <CheckCircle2 className="h-8 w-8" style={{ color: BLUE }} />
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            Obrigado pelo seu feedback.
          </h1>
          <p className="text-[15px] leading-relaxed text-white/45">
            Sua opinião ajuda a EVO a melhorar sua experiência todos os dias.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'ident') {
    return (
      <StepFrame
        title="Vamos começar"
        hint="Leva menos de 1 minuto e faz diferença de verdade."
        footer={
          <PrimaryButton disabled={!identOk} onClick={() => setPhase('confirm')}>
            Seguir
          </PrimaryButton>
        }
      >
        <div key={animKey} className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-white/50">Nome</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              maxLength={120}
              placeholder="SEU NOME COMPLETO"
              className="h-14 rounded-2xl border-white/10 bg-white/[0.03] px-5 text-base text-white placeholder:text-white/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-white/50">Unidade</label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger className="h-14 rounded-2xl border-white/10 bg-white/[0.03] px-5 text-base text-white">
                <SelectValue placeholder="Selecione sua unidade" />
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

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-white/50">WhatsApp</label>
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
              inputMode="tel"
              placeholder="(81) 99999-9999"
              className="h-14 rounded-2xl border-white/10 bg-white/[0.03] px-5 text-base text-white placeholder:text-white/20"
            />
          </div>
        </div>
      </StepFrame>
    );
  }

  if (phase === 'confirm') {
    return (
      <StepFrame
        title="Esse é o seu WhatsApp?"
        onBack={() => setPhase('ident')}
        footer={
          <>
            <PrimaryButton
              onClick={() => {
                setPhase('quiz');
                setStep(0);
              }}
            >
              Sim, continuar
            </PrimaryButton>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPhase('ident')}
              className="h-12 w-full rounded-2xl text-white/50 hover:bg-white/5 hover:text-white"
            >
              Corrigir número
            </Button>
          </>
        }
      >
        <div
          key={animKey}
          className="animate-in fade-in zoom-in-95 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center duration-300"
        >
          <p className="text-[32px] font-semibold tracking-tight tabular-nums">{whatsapp}</p>
          <p className="mt-3 text-sm text-white/40">Enviaremos sua resposta neste número.</p>
        </div>
      </StepFrame>
    );
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <StepFrame
      progress={{ current: step + 1, total: steps.length }}
      onBack={() => (step === 0 ? setPhase('confirm') : setStep(step - 1))}
      eyebrow={current.eyebrow}
      title={current.title}
      hint={(current as { hint?: string }).hint}
      footer={
        <PrimaryButton
          disabled={!current.valid}
          loading={saving}
          onClick={() => (isLast ? handleSubmit() : setStep(step + 1))}
        >
          {isLast ? 'Enviar avaliação' : 'Seguir'}
        </PrimaryButton>
      }
    >
      <div
        key={animKey}
        ref={topRef}
        className="animate-in fade-in slide-in-from-bottom-3 duration-300"
      >
        {current.render()}
      </div>
    </StepFrame>
  );
}
