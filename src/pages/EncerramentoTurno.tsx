import { useMemo, useState } from 'react';
import { ArrowRight, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StepShell } from '@/components/anamnese/StepShell';
import { OptionCard } from '@/components/anamnese/OptionCard';
import { cn } from '@/lib/utils';
import { submitFormularioPublico } from '@/lib/notifyFormularioGrupo';

type Stage = 'intro' | 'wizard' | 'review' | 'done';

interface Respostas {
  nome: string;
  unidade: '' | 'ZONA NORTE' | 'ZONA SUL';
  turno: '' | 'MANHÃ' | 'TARDE' | 'NOITE';
  experimentais: string;
  teveOcorrencia: boolean | null;
  ocorrenciaDescricao: string;
  manteveProtocolo: boolean | null;
  protocoloObs: string;
  recebeuFeedback: boolean | null;
  feedbackDescricao: string;
  climaEquipe: number | null;
  climaInfluencia: string;
  equipamentoProblema: boolean | null;
  equipamentoDescricao: string;
  fariaDiferente: string;
  precisouSuporte: boolean | null;
  suporteDescricao: string;
  observacaoGestao: string;
}

const initial: Respostas = {
  nome: '',
  unidade: '',
  turno: '',
  experimentais: '',
  teveOcorrencia: null,
  ocorrenciaDescricao: '',
  manteveProtocolo: null,
  protocoloObs: '',
  recebeuFeedback: null,
  feedbackDescricao: '',
  climaEquipe: null,
  climaInfluencia: '',
  equipamentoProblema: null,
  equipamentoDescricao: '',
  fariaDiferente: '',
  precisouSuporte: null,
  suporteDescricao: '',
  observacaoGestao: '',
};

export default function EncerramentoTurno() {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('intro');
  const [step, setStep] = useState(0);
  const [r, setR] = useState<Respostas>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Respostas>(k: K, v: Respostas[K]) =>
    setR((prev) => ({ ...prev, [k]: v }));

  // Build the active steps list dynamically (conditionals)
  type Step = {
    key: string;
    categoria: string;
    pergunta: string;
    apoio?: string;
    canContinue: boolean;
    render: () => JSX.Element;
  };

  const steps = useMemo<Step[]>(() => {
    const list: Step[] = [];

    list.push({
      key: 'nome',
      categoria: 'Identificação',
      pergunta: 'Qual o seu nome?',
      canContinue: r.nome.trim().length >= 2,
      render: () => (
        <Input
          value={r.nome}
          onChange={(e) => set('nome', e.target.value.toUpperCase())}
          placeholder="EX: JOÃO PEREIRA"
          className="h-14 rounded-2xl text-base"
        />
      ),
    });

    list.push({
      key: 'unidade',
      categoria: 'Identificação',
      pergunta: 'Qual unidade?',
      canContinue: !!r.unidade,
      render: () => (
        <>
          <OptionCard emoji="🌳" label="Zona Norte" selected={r.unidade === 'ZONA NORTE'} onClick={() => set('unidade', 'ZONA NORTE')} />
          <OptionCard emoji="🌊" label="Zona Sul" selected={r.unidade === 'ZONA SUL'} onClick={() => set('unidade', 'ZONA SUL')} />
        </>
      ),
    });

    list.push({
      key: 'turno',
      categoria: 'Identificação',
      pergunta: 'Qual turno você cobriu?',
      canContinue: !!r.turno,
      render: () => (
        <>
          <OptionCard emoji="🌅" label="Manhã" selected={r.turno === 'MANHÃ'} onClick={() => set('turno', 'MANHÃ')} />
          <OptionCard emoji="☀️" label="Tarde" selected={r.turno === 'TARDE'} onClick={() => set('turno', 'TARDE')} />
          <OptionCard emoji="🌙" label="Noite" selected={r.turno === 'NOITE'} onClick={() => set('turno', 'NOITE')} />
        </>
      ),
    });

    list.push({
      key: 'experimentais',
      categoria: 'Operação',
      pergunta: 'Quantas experimentais foram realizadas no turno?',
      canContinue: r.experimentais !== '' && Number(r.experimentais) >= 0,
      render: () => (
        <Input
          inputMode="numeric"
          value={r.experimentais}
          onChange={(e) => set('experimentais', e.target.value.replace(/\D/g, ''))}
          placeholder="0"
          className="h-14 rounded-2xl text-base"
        />
      ),
    });

    list.push({
      key: 'ocorrencia',
      categoria: 'Operação',
      pergunta: 'Teve alguma ocorrência fora do padrão hoje?',
      canContinue: r.teveOcorrencia !== null,
      render: () => (
        <>
          <OptionCard emoji="✅" label="Não" selected={r.teveOcorrencia === false} onClick={() => set('teveOcorrencia', false)} />
          <OptionCard emoji="⚠️" label="Sim" selected={r.teveOcorrencia === true} onClick={() => set('teveOcorrencia', true)} />
        </>
      ),
    });

    if (r.teveOcorrencia === true) {
      list.push({
        key: 'ocorrenciaDescricao',
        categoria: 'Operação',
        pergunta: 'Descreva objetivamente o que aconteceu.',
        canContinue: r.ocorrenciaDescricao.trim().length >= 3,
        render: () => (
          <Textarea
            value={r.ocorrenciaDescricao}
            onChange={(e) => set('ocorrenciaDescricao', e.target.value.toUpperCase())}
            placeholder="DESCREVA AQUI..."
            className="min-h-32 rounded-2xl text-base"
          />
        ),
      });
    }

    list.push({
      key: 'padrao',
      categoria: 'Equipe',
      pergunta: 'A equipe manteve o padrão de atendimento EVO durante o turno?',
      canContinue: r.manteveProtocolo !== null,
      render: () => (
        <>
          <OptionCard emoji="💪" label="Sim" selected={r.manteveProtocolo === true} onClick={() => set('manteveProtocolo', true)} />
          <OptionCard emoji="🚧" label="Não" selected={r.manteveProtocolo === false} onClick={() => set('manteveProtocolo', false)} />
        </>
      ),
    });

    if (r.manteveProtocolo === false) {
      list.push({
        key: 'protocoloObs',
        categoria: 'Equipe',
        pergunta: 'Quem e o que foi observado?',
        canContinue: r.protocoloObs.trim().length >= 3,
        render: () => (
          <Textarea
            value={r.protocoloObs}
            onChange={(e) => set('protocoloObs', e.target.value.toUpperCase())}
            placeholder="EX: FULANO NÃO RECEBEU O ALUNO NA PORTA..."
            className="min-h-32 rounded-2xl text-base"
          />
        ),
      });
    }

    list.push({
      key: 'feedback',
      categoria: 'Alunos',
      pergunta: 'Recebeu algum feedback de aluno hoje?',
      canContinue: r.recebeuFeedback !== null,
      render: () => (
        <>
          <OptionCard emoji="🙊" label="Não" selected={r.recebeuFeedback === false} onClick={() => set('recebeuFeedback', false)} />
          <OptionCard emoji="💬" label="Sim" selected={r.recebeuFeedback === true} onClick={() => set('recebeuFeedback', true)} />
        </>
      ),
    });

    if (r.recebeuFeedback === true) {
      list.push({
        key: 'feedbackDescricao',
        categoria: 'Alunos',
        pergunta: 'Descreva o feedback recebido.',
        canContinue: r.feedbackDescricao.trim().length >= 3,
        render: () => (
          <Textarea
            value={r.feedbackDescricao}
            onChange={(e) => set('feedbackDescricao', e.target.value.toUpperCase())}
            placeholder="O QUE FOI DITO E POR QUEM..."
            className="min-h-32 rounded-2xl text-base"
          />
        ),
      });
    }

    list.push({
      key: 'clima',
      categoria: 'Equipe',
      pergunta: 'Como você avalia o clima da equipe no turno?',
      apoio: '0 = péssimo · 5 = excelente',
      canContinue: r.climaEquipe !== null,
      render: () => (
        <div className="grid grid-cols-6 gap-2">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set('climaEquipe', n)}
              className={cn(
                'flex h-16 items-center justify-center rounded-2xl border-2 text-2xl font-bold transition-all',
                r.climaEquipe === n
                  ? 'border-anamnese-border-selected bg-anamnese-royal text-anamnese-royal-foreground shadow-md ring-4 ring-anamnese-border-selected/15'
                  : 'border-anamnese-border bg-anamnese-card text-anamnese-card-foreground',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      ),
    });

    list.push({
      key: 'climaInfluencia',
      categoria: 'Equipe',
      pergunta: 'O que influenciou essa nota?',
      canContinue: r.climaInfluencia.trim().length >= 3,
      render: () => (
        <Textarea
          value={r.climaInfluencia}
          onChange={(e) => set('climaInfluencia', e.target.value.toUpperCase())}
          placeholder="DESCREVA O CLIMA..."
          className="min-h-28 rounded-2xl text-base"
        />
      ),
    });

    list.push({
      key: 'equipamento',
      categoria: 'Estrutura',
      pergunta: 'Algum equipamento apresentou problema durante o turno?',
      canContinue: r.equipamentoProblema !== null,
      render: () => (
        <>
          <OptionCard emoji="🟢" label="Não" selected={r.equipamentoProblema === false} onClick={() => set('equipamentoProblema', false)} />
          <OptionCard emoji="🛠️" label="Sim" selected={r.equipamentoProblema === true} onClick={() => set('equipamentoProblema', true)} />
        </>
      ),
    });

    if (r.equipamentoProblema === true) {
      list.push({
        key: 'equipamentoDescricao',
        categoria: 'Estrutura',
        pergunta: 'Qual equipamento e qual o problema?',
        canContinue: r.equipamentoDescricao.trim().length >= 3,
        render: () => (
          <Textarea
            value={r.equipamentoDescricao}
            onChange={(e) => set('equipamentoDescricao', e.target.value.toUpperCase())}
            placeholder="EX: ESTEIRA 03 — DESLIGOU SOZINHA"
            className="min-h-28 rounded-2xl text-base"
          />
        ),
      });
    }

    list.push({
      key: 'fariaDiferente',
      categoria: 'Reflexão',
      pergunta: 'O que você faria diferente no seu turno hoje?',
      canContinue: r.fariaDiferente.trim().length >= 3,
      render: () => (
        <Textarea
          value={r.fariaDiferente}
          onChange={(e) => set('fariaDiferente', e.target.value.toUpperCase())}
          placeholder="ESCREVA AQUI..."
          className="min-h-28 rounded-2xl text-base"
        />
      ),
    });

    list.push({
      key: 'suporte',
      categoria: 'Coordenação',
      pergunta: 'Precisou de suporte da coordenação em alguma situação?',
      canContinue: r.precisouSuporte !== null,
      render: () => (
        <>
          <OptionCard emoji="🙅" label="Não" selected={r.precisouSuporte === false} onClick={() => set('precisouSuporte', false)} />
          <OptionCard emoji="📞" label="Sim" selected={r.precisouSuporte === true} onClick={() => set('precisouSuporte', true)} />
        </>
      ),
    });

    if (r.precisouSuporte === true) {
      list.push({
        key: 'suporteDescricao',
        categoria: 'Coordenação',
        pergunta: 'Descreva a situação.',
        canContinue: r.suporteDescricao.trim().length >= 3,
        render: () => (
          <Textarea
            value={r.suporteDescricao}
            onChange={(e) => set('suporteDescricao', e.target.value.toUpperCase())}
            placeholder="DESCREVA O QUE ACONTECEU..."
            className="min-h-28 rounded-2xl text-base"
          />
        ),
      });
    }

    list.push({
      key: 'observacaoGestao',
      categoria: 'Mensagem',
      pergunta: 'Algo que a gestão precisa saber?',
      apoio: 'Opcional. Pode deixar em branco e clicar em continuar.',
      canContinue: true,
      render: () => (
        <Textarea
          value={r.observacaoGestao}
          onChange={(e) => set('observacaoGestao', e.target.value.toUpperCase())}
          placeholder="ESCREVA AQUI (OPCIONAL)..."
          className="min-h-28 rounded-2xl text-base"
        />
      ),
    });

    return list;
  }, [r]);

  const safeStep = Math.min(step, steps.length - 1);
  const current = steps[safeStep];
  const isLast = safeStep === steps.length - 1;

  // ========= INTRO =========
  if (stage === 'intro') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-anamnese-royal p-6 text-anamnese-royal-foreground">
        <div className="w-full max-w-md space-y-8 text-center">
          <p className="font-display-condensed text-xs uppercase tracking-[0.4em] opacity-80">
            EVO TRAINING CLUB
          </p>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight">
            Encerramento<br />de Turno
          </h1>
          <p className="text-sm uppercase tracking-[0.2em] opacity-90">
            Estagiário Líder
          </p>
          <p className="mx-auto max-w-xs text-base opacity-90">
            Preencha ao final do seu turno. Leva menos de 3 minutos.
          </p>
          <Button
            size="lg"
            onClick={() => { setR(initial); setStep(0); setStage('wizard'); }}
            className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-anamnese-royal shadow-lg hover:bg-white/90"
          >
            Começar
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  // ========= REVIEW =========
  if (stage === 'review') {
    const items: { label: string; value: string }[] = [
      { label: 'Nome', value: r.nome },
      { label: 'Unidade', value: r.unidade },
      { label: 'Turno', value: r.turno },
      { label: 'Experimentais', value: r.experimentais || '0' },
      { label: 'Teve ocorrência?', value: r.teveOcorrencia ? `Sim — ${r.ocorrenciaDescricao}` : 'Não' },
      { label: 'Manteve padrão?', value: r.manteveProtocolo ? 'Sim' : `Não — ${r.protocoloObs}` },
      { label: 'Feedback de aluno?', value: r.recebeuFeedback ? `Sim — ${r.feedbackDescricao}` : 'Não' },
      { label: 'Clima da equipe', value: `${r.climaEquipe}/5 — ${r.climaInfluencia}` },
      { label: 'Equipamento com problema?', value: r.equipamentoProblema ? `Sim — ${r.equipamentoDescricao}` : 'Não' },
      { label: 'Faria diferente', value: r.fariaDiferente },
      { label: 'Precisou de suporte?', value: r.precisouSuporte ? `Sim — ${r.suporteDescricao}` : 'Não' },
      { label: 'Para a gestão', value: r.observacaoGestao || '—' },
    ];

    const handleSubmit = async () => {
      if (saving) return; // Prevent double clicks
      setSaving(true);
      try {
        const respostaId = crypto.randomUUID();
        const { error } = await supabase
          .from('encerramento_turno_respostas')
          .insert({
            id: respostaId,
            nome: r.nome,
            unidade: r.unidade,
            turno: r.turno,
            experimentais_realizadas: Number(r.experimentais) || 0,
            teve_ocorrencia: !!r.teveOcorrencia,
            ocorrencia_descricao: r.ocorrenciaDescricao || null,
            manteve_padrao: !!r.manteveProtocolo,
            padrao_observacao: r.protocoloObs || null,
            recebeu_feedback: !!r.recebeuFeedback,
            feedback_descricao: r.feedbackDescricao || null,
            clima_equipe: r.climaEquipe ?? 0,
            clima_influencia: r.climaInfluencia || null,
            equipamento_problema: !!r.equipamentoProblema,
            equipamento_descricao: r.equipamentoDescricao || null,
            faria_diferente: r.fariaDiferente || null,
            precisou_suporte: !!r.precisouSuporte,
            suporte_descricao: r.suporteDescricao || null,
            observacao_gestao: r.observacaoGestao || null,
          });

        if (error) {
          toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
          setSaving(false);
          return;
        }

        await submitFormularioPublico({
          tipo_formulario: 'estagiario_lider',
          unidade: r.unidade,
          resposta_id: respostaId,
        });
        setStage('done');
      } catch (error) {
        toast({
          title: 'Erro ao enviar',
          description: error instanceof Error ? error.message : 'Tente novamente.',
          variant: 'destructive',
        });
        setSaving(false);
      }
    };

    return (
      <div className="flex min-h-[100dvh] flex-col bg-anamnese-bg">
        <header className="sticky top-0 z-20 bg-anamnese-royal text-anamnese-royal-foreground">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
            <span className="font-display-condensed text-lg font-extrabold uppercase tracking-wider">EVO TRAINING CLUB</span>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Resumo</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-md flex-1 px-5 pb-44 pt-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-anamnese-category">Confira antes de enviar</p>
          <h2 className="mt-2 text-[26px] font-bold leading-[1.15] text-anamnese-card-foreground">Resumo do turno</h2>

          <div className="mt-6 space-y-2">
            {items.map((it) => (
              <div key={it.label} className="rounded-2xl border border-anamnese-border bg-anamnese-card p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-anamnese-muted-foreground">{it.label}</div>
                <div className="mt-1 text-sm text-anamnese-card-foreground whitespace-pre-wrap">{it.value || '—'}</div>
              </div>
            ))}
          </div>
        </main>

        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-anamnese-border bg-anamnese-card/95 backdrop-blur safe-bottom">
          <div className="mx-auto flex max-w-md flex-col gap-1 px-5 pt-3 pb-3">
            <Button
              type="button"
              size="lg"
              disabled={saving}
              onClick={handleSubmit}
              className="h-14 w-full rounded-2xl bg-anamnese-royal text-base font-semibold text-anamnese-royal-foreground shadow-md hover:bg-anamnese-royal-dark"
            >
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Enviar
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setStage('wizard'); setStep(steps.length - 1); }}
              disabled={saving}
              className="h-10 text-anamnese-muted-foreground hover:bg-transparent hover:text-anamnese-card-foreground"
            >
              Voltar
            </Button>
          </div>
        </footer>
      </div>
    );
  }

  // ========= DONE =========
  if (stage === 'done') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-anamnese-royal p-8 text-center text-anamnese-royal-foreground">
        <CheckCircle2 className="h-16 w-16" strokeWidth={1.5} />
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
          Turno registrado<br />com sucesso!
        </h1>
        <p className="max-w-sm text-base opacity-90">Bom descanso! 🌙</p>
        <Button
          onClick={() => { setR(initial); setStep(0); setStage('intro'); }}
          size="lg"
          className="mt-4 h-14 rounded-2xl bg-white px-8 text-base font-semibold text-anamnese-royal hover:bg-white/90"
        >
          <RefreshCw className="mr-2 h-5 w-5" />
          Nova ficha
        </Button>
      </div>
    );
  }

  // ========= WIZARD =========
  return (
    <StepShell
      stepNumber={safeStep + 1}
      totalSteps={steps.length}
      categoria={current.categoria}
      pergunta={current.pergunta}
      apoio={current.apoio}
      canContinue={current.canContinue}
      onBack={safeStep === 0 ? () => setStage('intro') : () => setStep((s) => Math.max(0, s - 1))}
      onContinue={() => {
        if (isLast) setStage('review');
        else setStep((s) => s + 1);
      }}
      continueLabel={isLast ? 'Revisar' : 'Continuar'}
    >
      {current.render()}
    </StepShell>
  );
}
