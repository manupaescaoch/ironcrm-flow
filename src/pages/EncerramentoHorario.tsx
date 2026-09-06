import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, Loader2, RefreshCw, CheckCircle2, CalendarIcon, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StepShell } from '@/components/anamnese/StepShell';
import { OptionCard } from '@/components/anamnese/OptionCard';
import { cn } from '@/lib/utils';
import { submitFormularioPublico } from '@/lib/notifyFormularioGrupo';
import { useFormDraft, submitWithRetry, clearDraft } from '@/lib/formDraft';
import { UNIDADES_FORMULARIO, type UnidadeFormularioValue, getUnidadeIdByValue } from '@/lib/formularioUnidades';

type Stage = 'intro' | 'wizard' | 'review' | 'done';

interface Respostas {
  nome: string;
  data: Date | null;
  unidade: '' | UnidadeFormularioValue;
  turno: '' | 'MANHÃ' | 'TARDE' | 'NOITE';
  teveOcorrencia: boolean | null;
  ocorrenciaDescricao: string;
  treinadorFaltou: boolean | null;
  treinadorFaltouQuem: string;
  atendimentosPorTreinador: string;
  atendimentos: { treinador: string; quantidade: string }[];
  experimentais: string;
  feedbackAluno: boolean | null;
  feedbackAlunoDescricao: string;
  destaquePositivo: boolean | null;
  destaqueDescricao: string;
  feedbackCorretivo: boolean | null;
  feedbackCorretivoDescricao: string;
  salaOrganizada: boolean | null;
  pendenciaOrganizacao: string;
  notaGeral: number | null;
  observacoes: string;
}

const initial: Respostas = {
  nome: '',
  data: new Date(),
  unidade: '',
  turno: '',
  teveOcorrencia: null,
  ocorrenciaDescricao: '',
  treinadorFaltou: null,
  treinadorFaltouQuem: '',
  atendimentosPorTreinador: '',
  atendimentos: [{ treinador: '', quantidade: '' }],
  experimentais: '',
  feedbackAluno: null,
  feedbackAlunoDescricao: '',
  destaquePositivo: null,
  destaqueDescricao: '',
  feedbackCorretivo: null,
  feedbackCorretivoDescricao: '',
  salaOrganizada: null,
  pendenciaOrganizacao: '',
  notaGeral: null,
  observacoes: '',
};

function ScaleButtons({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            'flex h-16 items-center justify-center rounded-2xl border-2 text-2xl font-bold transition-all',
            value === n
              ? 'border-anamnese-border-selected bg-anamnese-royal text-anamnese-royal-foreground shadow-md ring-4 ring-anamnese-border-selected/15'
              : 'border-anamnese-border bg-anamnese-card text-anamnese-card-foreground',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function EncerramentoHorario() {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('intro');
  const [step, setStep] = useState(0);
  const [r, setR] = useState<Respostas>(initial);
  const [saving, setSaving] = useState(false);

  useFormDraft<Respostas>({
    key: 'encerramento-horario',
    data: r,
    step,
    stage,
    enabled: stage !== 'done',
    onRestore: (draft) => {
      setR({ ...draft.data, data: draft.data.data ? new Date(draft.data.data as unknown as string) : null });
      setStep(draft.step);
      setStage(draft.stage as Stage);
      toast({ title: 'Rascunho recuperado', description: 'Continuamos de onde você parou.' });
    },
  });

  const set = <K extends keyof Respostas>(k: K, v: Respostas[K]) =>
    setR((prev) => ({ ...prev, [k]: v }));

  const atendimentosValidos = r.atendimentos.filter(
    (a) => a.treinador.trim().length >= 2 && a.quantidade !== '' && Number(a.quantidade) >= 0,
  );
  const temNomeDuplicado = (() => {
    const nomes = atendimentosValidos.map((a) => a.treinador.trim().toUpperCase());
    return new Set(nomes).size !== nomes.length;
  })();
  const atendimentosTexto = atendimentosValidos
    .map((a) => `${a.treinador.trim()} ${a.quantidade}`)
    .join(' / ');

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
    const sn = (val: boolean | null, set_: (b: boolean) => void) => (
      <>
        <OptionCard emoji="✅" label="Sim" selected={val === true} onClick={() => set_(true)} />
        <OptionCard emoji="🚫" label="Não" selected={val === false} onClick={() => set_(false)} />
      </>
    );

    list.push({
      key: 'nome', categoria: 'Identificação', pergunta: 'Qual o seu nome?',
      canContinue: r.nome.trim().length >= 2,
      render: () => (<Input value={r.nome} onChange={(e) => set('nome', e.target.value.toUpperCase())}
        placeholder="EX: PEDRO LIMA" className="h-14 rounded-2xl text-base" />),
    });


    list.push({
      key: 'unidade', categoria: 'Identificação', pergunta: 'Qual unidade?',
      canContinue: !!r.unidade,
      render: () => (<>
        {UNIDADES_FORMULARIO.map((u) => (
          <OptionCard
            key={u.value}
            emoji={u.value === 'MADALENA' ? '🌳' : u.value === 'BOA VIAGEM' ? '🌊' : '🏖️'}
            label={u.label}
            selected={r.unidade === u.value}
            onClick={() => set('unidade', u.value)}
          />
        ))}
      </>),
    });

    list.push({
      key: 'turno', categoria: 'Identificação', pergunta: 'Qual turno você cobriu?',
      canContinue: !!r.turno,
      render: () => (<>
        <OptionCard emoji="🌅" label="Manhã" selected={r.turno === 'MANHÃ'} onClick={() => set('turno', 'MANHÃ')} />
        <OptionCard emoji="☀️" label="Tarde" selected={r.turno === 'TARDE'} onClick={() => set('turno', 'TARDE')} />
        <OptionCard emoji="🌙" label="Noite" selected={r.turno === 'NOITE'} onClick={() => set('turno', 'NOITE')} />
      </>),
    });

    // Operação
    list.push({
      key: 'ocorrencia', categoria: 'Operação', pergunta: 'Alguma ocorrência fora do comum?',
      canContinue: r.teveOcorrencia !== null,
      render: () => sn(r.teveOcorrencia, (b) => set('teveOcorrencia', b)),
    });
    if (r.teveOcorrencia === true) {
      list.push({
        key: 'ocorrenciaDescricao', categoria: 'Operação', pergunta: 'Qual ocorrência?',
        canContinue: r.ocorrenciaDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.ocorrenciaDescricao}
          onChange={(e) => set('ocorrenciaDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA A OCORRÊNCIA..." className="min-h-32 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'treinadorFaltou', categoria: 'Operação', pergunta: 'Algum treinador faltou?',
      canContinue: r.treinadorFaltou !== null,
      render: () => sn(r.treinadorFaltou, (b) => set('treinadorFaltou', b)),
    });
    if (r.treinadorFaltou === true) {
      list.push({
        key: 'treinadorFaltouQuem', categoria: 'Operação', pergunta: 'Qual treinador faltou?',
        canContinue: r.treinadorFaltouQuem.trim().length >= 2,
        render: () => (<Textarea value={r.treinadorFaltouQuem}
          onChange={(e) => set('treinadorFaltouQuem', e.target.value.toUpperCase())}
          placeholder="EX: FULANO E CICLANO" className="min-h-24 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'atendimentos', categoria: 'Operação', pergunta: 'Quantidade de atendimentos por treinador no turno',
      apoio: 'Adicione um treinador por linha com o nº de atendimentos',
      canContinue: atendimentosValidos.length > 0 && !temNomeDuplicado,
      render: () => (
        <div className="space-y-2">
          {r.atendimentos.map((a, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={a.treinador}
                onChange={(e) => {
                  const next = [...r.atendimentos];
                  next[i] = { ...next[i], treinador: e.target.value.toUpperCase() };
                  set('atendimentos', next);
                }}
                placeholder="TREINADOR"
                className="h-12 rounded-2xl text-base flex-1"
              />
              <Input
                inputMode="numeric"
                value={a.quantidade}
                onChange={(e) => {
                  const next = [...r.atendimentos];
                  next[i] = { ...next[i], quantidade: e.target.value.replace(/\D/g, '') };
                  set('atendimentos', next);
                }}
                placeholder="0"
                className="h-12 w-20 rounded-2xl text-base text-center"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-12 w-12 shrink-0"
                disabled={r.atendimentos.length === 1}
                onClick={() => set('atendimentos', r.atendimentos.filter((_, idx) => idx !== i))}
                aria-label="Remover treinador"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-2xl"
            onClick={() => set('atendimentos', [...r.atendimentos, { treinador: '', quantidade: '' }])}
          >
            <Plus className="w-4 h-4 mr-2" /> Adicionar treinador
          </Button>
          {temNomeDuplicado && (
            <p className="text-xs text-destructive">Existe treinador repetido na lista.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Total do turno: {atendimentosValidos.reduce((s, a) => s + Number(a.quantidade), 0)} atendimento(s)
          </p>
        </div>
      ),
    });
    list.push({
      key: 'experimentais', categoria: 'Operação', pergunta: 'Quantas experimentais foram realizadas no turno?',
      canContinue: r.experimentais !== '' && Number(r.experimentais) >= 0,
      render: () => (<Input inputMode="numeric" value={r.experimentais}
        onChange={(e) => set('experimentais', e.target.value.replace(/\D/g, ''))}
        placeholder="0" className="h-14 rounded-2xl text-base" />),
    });

    // Alunos e equipe
    list.push({
      key: 'feedbackAluno', categoria: 'Alunos e equipe', pergunta: 'Teve feedback de aluno (positivo ou negativo)?',
      canContinue: r.feedbackAluno !== null,
      render: () => sn(r.feedbackAluno, (b) => set('feedbackAluno', b)),
    });
    if (r.feedbackAluno === true) {
      list.push({
        key: 'feedbackAlunoDescricao', categoria: 'Alunos e equipe', pergunta: 'Qual feedback?',
        canContinue: r.feedbackAlunoDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.feedbackAlunoDescricao}
          onChange={(e) => set('feedbackAlunoDescricao', e.target.value.toUpperCase())}
          placeholder="O QUE FOI DITO E POR QUEM..." className="min-h-28 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'destaquePositivo', categoria: 'Alunos e equipe', pergunta: 'Algum treinador se destacou positivamente?',
      canContinue: r.destaquePositivo !== null,
      render: () => sn(r.destaquePositivo, (b) => set('destaquePositivo', b)),
    });
    if (r.destaquePositivo === true) {
      list.push({
        key: 'destaqueDescricao', categoria: 'Alunos e equipe', pergunta: 'Quem e o quê?',
        canContinue: r.destaqueDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.destaqueDescricao}
          onChange={(e) => set('destaqueDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA O DESTAQUE..." className="min-h-28 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'feedbackCorretivo', categoria: 'Alunos e equipe', pergunta: 'Algum treinador precisou de feedback corretivo?',
      canContinue: r.feedbackCorretivo !== null,
      render: () => sn(r.feedbackCorretivo, (b) => set('feedbackCorretivo', b)),
    });
    if (r.feedbackCorretivo === true) {
      list.push({
        key: 'feedbackCorretivoDescricao', categoria: 'Alunos e equipe', pergunta: 'Quem e o quê?',
        canContinue: r.feedbackCorretivoDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.feedbackCorretivoDescricao}
          onChange={(e) => set('feedbackCorretivoDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA O FEEDBACK..." className="min-h-28 rounded-2xl text-base" />),
      });
    }

    // Encerramento
    list.push({
      key: 'salaOrganizada', categoria: 'Encerramento', pergunta: 'A sala ficou organizada para o próximo turno?',
      canContinue: r.salaOrganizada !== null,
      render: () => sn(r.salaOrganizada, (b) => set('salaOrganizada', b)),
    });
    if (r.salaOrganizada === false) {
      list.push({
        key: 'pendenciaOrganizacao', categoria: 'Encerramento', pergunta: 'O que ficou pendente?',
        canContinue: r.pendenciaOrganizacao.trim().length >= 3,
        render: () => (<Textarea value={r.pendenciaOrganizacao}
          onChange={(e) => set('pendenciaOrganizacao', e.target.value.toUpperCase())}
          placeholder="DESCREVA AS PENDÊNCIAS..." className="min-h-28 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'notaGeral', categoria: 'Encerramento', pergunta: 'Nota geral do turno', apoio: '0 = péssimo · 5 = excelente',
      canContinue: r.notaGeral !== null,
      render: () => <ScaleButtons value={r.notaGeral} onChange={(n) => set('notaGeral', n)} />,
    });
    list.push({
      key: 'observacoes', categoria: 'Encerramento', pergunta: 'Observações livres',
      apoio: 'Opcional — pode deixar em branco e clicar em continuar',
      canContinue: true,
      render: () => (<Textarea value={r.observacoes}
        onChange={(e) => set('observacoes', e.target.value.toUpperCase())}
        placeholder="ESCREVA AQUI (OPCIONAL)..." className="min-h-28 rounded-2xl text-base" />),
    });

    return list;
  }, [r]);

  const safeStep = Math.min(step, steps.length - 1);
  const current = steps[safeStep];
  const isLast = safeStep === steps.length - 1;

  // ===== INTRO
  if (stage === 'intro') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-anamnese-royal p-6 text-anamnese-royal-foreground">
        <div className="w-full max-w-md space-y-8 text-center">
          <p className="font-display-condensed text-xs uppercase tracking-[0.4em] opacity-80">EVO TRAINING CLUB</p>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight">
            Formulário<br />de Encerramento
          </h1>
          <p className="text-sm uppercase tracking-[0.2em] opacity-90">Coordenador de Horário</p>
          <p className="mx-auto max-w-xs text-base opacity-90">
            Preencha ao final do seu turno. Leva menos de 3 minutos.
          </p>
          <Button size="lg" onClick={() => { setR(initial); setStep(0); setStage('wizard'); }}
            className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-anamnese-royal shadow-lg hover:bg-white/90">
            Começar <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  // ===== REVIEW
  if (stage === 'review') {
    const items: { label: string; value: string }[] = [];
    const push = (label: string, value: string) => { if (value && value.trim() !== '' && value !== '—') items.push({ label, value }); };
    push('Nome', r.nome);
    push('Data', r.data ? format(r.data, 'dd/MM/yyyy') : '');
    push('Unidade', r.unidade);
    push('Turno', r.turno);
    push('Ocorrência?', r.teveOcorrencia === true ? `Sim — ${r.ocorrenciaDescricao}` : (r.teveOcorrencia === false ? 'Não' : ''));
    push('Treinador faltou?', r.treinadorFaltou === true ? `Sim — ${r.treinadorFaltouQuem}` : (r.treinadorFaltou === false ? 'Não' : ''));
    push('Atendimentos por treinador', atendimentosTexto);
    push('Experimentais', r.experimentais);
    push('Feedback de aluno?', r.feedbackAluno === true ? `Sim — ${r.feedbackAlunoDescricao}` : (r.feedbackAluno === false ? 'Não' : ''));
    push('Destaque positivo?', r.destaquePositivo === true ? `Sim — ${r.destaqueDescricao}` : (r.destaquePositivo === false ? 'Não' : ''));
    push('Feedback corretivo?', r.feedbackCorretivo === true ? `Sim — ${r.feedbackCorretivoDescricao}` : (r.feedbackCorretivo === false ? 'Não' : ''));
    push('Sala organizada?', r.salaOrganizada === true ? 'Sim' : (r.salaOrganizada === false ? `Não — ${r.pendenciaOrganizacao}` : ''));
    push('Nota geral', r.notaGeral !== null ? `${r.notaGeral}/5` : '');
    push('Observações', r.observacoes);

    const handleSubmit = async () => {
      if (saving) return; // Prevent double clicks
      setSaving(true);
      try {
        const respostaId = crypto.randomUUID();
        const { error } = await submitWithRetry(() => supabase
          .from('encerramento_horario_respostas')
          .insert({
            id: respostaId,
            nome: r.nome,
            data: r.data ? format(r.data, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            unidade: r.unidade,
            turno: r.turno,
            teve_ocorrencia: r.teveOcorrencia,
            ocorrencia_descricao: r.ocorrenciaDescricao || null,
            treinador_faltou: r.treinadorFaltou,
            treinador_faltou_quem: r.treinadorFaltouQuem || null,
            atendimentos_por_treinador: atendimentosTexto || null,
            atendimentos_json: atendimentosValidos.map((a) => ({
              treinador: a.treinador.trim().toUpperCase(),
              quantidade: Number(a.quantidade),
            })),
            experimentais_realizadas: Number(r.experimentais) || 0,
            teve_feedback_aluno: r.feedbackAluno,
            feedback_aluno_descricao: r.feedbackAlunoDescricao || null,
            destaque_positivo: r.destaquePositivo,
            destaque_descricao: r.destaqueDescricao || null,
            feedback_corretivo: r.feedbackCorretivo,
            feedback_corretivo_descricao: r.feedbackCorretivoDescricao || null,
            sala_organizada: r.salaOrganizada,
            pendencia_organizacao: r.pendenciaOrganizacao || null,
            nota_geral: r.notaGeral,
            observacoes: r.observacoes || null,
          }));

        if (error) {
          toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
          setSaving(false);
          return;
        }

        await submitFormularioPublico({
          tipo_formulario: 'coordenador_horario',
          unidade: r.unidade,
          resposta_id: respostaId,
        });
        clearDraft('encerramento-horario');
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
            {items.map((it, i) => (
              <div key={i} className="rounded-2xl border border-anamnese-border bg-anamnese-card p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-anamnese-muted-foreground">{it.label}</div>
                <div className="mt-1 text-sm text-anamnese-card-foreground whitespace-pre-wrap">{it.value}</div>
              </div>
            ))}
          </div>
        </main>
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-anamnese-border bg-anamnese-card/95 backdrop-blur safe-bottom">
          <div className="mx-auto flex max-w-md flex-col gap-2 px-5 pt-3 pb-3">
            <Button type="button" size="lg" disabled={saving} onClick={handleSubmit}
              className="h-14 w-full rounded-2xl bg-anamnese-royal text-base font-semibold text-anamnese-royal-foreground hover:bg-anamnese-royal/90">
              {saving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando...</> : <>Enviar ficha <ArrowRight className="ml-2 h-5 w-5" /></>}
            </Button>
            <Button variant="ghost" onClick={() => { setStage('wizard'); setStep(steps.length - 1); }}>Voltar e revisar</Button>
          </div>
        </footer>
      </div>
    );
  }

  // ===== DONE
  if (stage === 'done') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-anamnese-royal p-6 text-anamnese-royal-foreground">
        <div className="w-full max-w-md space-y-6 text-center">
          <CheckCircle2 className="mx-auto h-20 w-20" />
          <h1 className="font-display text-4xl font-extrabold uppercase leading-tight">Turno registrado</h1>
          <p className="text-base opacity-90">Bom trabalho!</p>
          <Button size="lg" onClick={() => { setR(initial); setStep(0); setStage('intro'); }}
            className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-anamnese-royal shadow-lg hover:bg-white/90">
            <RefreshCw className="mr-2 h-5 w-5" /> Nova ficha
          </Button>
        </div>
      </div>
    );
  }

  // ===== WIZARD
  return (
    <StepShell
      categoria={current.categoria}
      pergunta={current.pergunta}
      apoio={current.apoio}
      stepNumber={safeStep + 1}
      totalSteps={steps.length}
      canContinue={current.canContinue}
      onBack={() => { if (safeStep === 0) setStage('intro'); else setStep((s) => s - 1); }}
      onContinue={() => { if (isLast) setStage('review'); else setStep((s) => s + 1); }}
      continueLabel={isLast ? 'Revisar' : 'Continuar'}
    >
      {current.render()}
    </StepShell>
  );
}
