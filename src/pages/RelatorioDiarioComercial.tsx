import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Loader2, RefreshCw, CheckCircle2, CalendarIcon } from 'lucide-react';
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

type Stage = 'intro' | 'wizard' | 'review' | 'done';

interface Respostas {
  nome: string; // Responsável pelo fechamento
  unidade: '' | 'ZONA NORTE' | 'ZONA SUL';
  data: Date | null;
  // 1. Indicadores do dia (todos numéricos)
  totalAtivos: string;
  leads: string;
  experimentais: string;
  novasMatriculas: string;
  renovacoes: string;
  cancelamentos: string;
  naoRenovados: string;
  evasao: string;
  inadimplentes: string;
  // 2. Ocorrências e feedbacks
  ocorrencia: boolean | null;
  ocorrenciaDescricao: string;
  feedbackNegativo: boolean | null;
  feedbackDescricao: string;
  // 3. Observações finais
  observacoesLideranca: string;
}

const initial: Respostas = {
  nome: '',
  unidade: '',
  data: new Date(),
  totalAtivos: '',
  leads: '',
  experimentais: '',
  novasMatriculas: '',
  renovacoes: '',
  cancelamentos: '',
  naoRenovados: '',
  evasao: '',
  inadimplentes: '',
  ocorrencia: null,
  ocorrenciaDescricao: '',
  feedbackNegativo: null,
  feedbackDescricao: '',
  observacoesLideranca: '',
};

export default function RelatorioDiarioComercial() {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('intro');
  const [step, setStep] = useState(0);
  const [r, setR] = useState<Respostas>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Respostas>(k: K, v: Respostas[K]) =>
    setR((prev) => ({ ...prev, [k]: v }));

  type Step = {
    key: string;
    categoria: string;
    pergunta: string;
    apoio?: string;
    canContinue: boolean;
    render: () => JSX.Element;
  };

  const numInput = (val: string, k: keyof Respostas) => (
    <Input
      inputMode="numeric"
      value={val}
      onChange={(e) => set(k, e.target.value.replace(/\D/g, '') as Respostas[typeof k])}
      placeholder="0"
      className="h-14 rounded-2xl text-base"
    />
  );

  const steps = useMemo<Step[]>(() => {
    const list: Step[] = [];
    const sn = (val: boolean | null, set_: (b: boolean) => void) => (
      <>
        <OptionCard emoji="✅" label="Sim" selected={val === true} onClick={() => set_(true)} />
        <OptionCard emoji="🚫" label="Não" selected={val === false} onClick={() => set_(false)} />
      </>
    );

    // Identificação
    list.push({
      key: 'unidade', categoria: 'Identificação', pergunta: 'Qual a unidade?',
      canContinue: !!r.unidade,
      render: () => (<>
        <OptionCard emoji="🌳" label="Zona Norte" selected={r.unidade === 'ZONA NORTE'} onClick={() => set('unidade', 'ZONA NORTE')} />
        <OptionCard emoji="🌊" label="Zona Sul" selected={r.unidade === 'ZONA SUL'} onClick={() => set('unidade', 'ZONA SUL')} />
      </>),
    });
    list.push({
      key: 'nome', categoria: 'Identificação', pergunta: 'Responsável pelo fechamento',
      canContinue: r.nome.trim().length >= 2,
      render: () => (<Input value={r.nome} onChange={(e) => set('nome', e.target.value.toUpperCase())}
        placeholder="EX: ANA SILVA" className="h-14 rounded-2xl text-base" />),
    });
    list.push({
      key: 'data', categoria: 'Identificação', pergunta: 'Data do relatório',
      canContinue: !!r.data,
      render: () => (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn(
              'h-14 w-full justify-start rounded-2xl text-left text-base font-normal',
              !r.data && 'text-muted-foreground'
            )}>
              <CalendarIcon className="mr-2 h-5 w-5" />
              {r.data ? format(r.data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Selecione a data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={r.data ?? undefined} onSelect={(d) => set('data', d ?? null)} initialFocus />
          </PopoverContent>
        </Popover>
      ),
    });

    // 1. Indicadores do dia
    list.push({ key: 'totalAtivos', categoria: 'Indicadores do dia', pergunta: 'Total de alunos ativos',
      canContinue: r.totalAtivos !== '', render: () => numInput(r.totalAtivos, 'totalAtivos') });
    list.push({ key: 'leads', categoria: 'Indicadores do dia', pergunta: 'Leads recebidos',
      canContinue: r.leads !== '', render: () => numInput(r.leads, 'leads') });
    list.push({ key: 'experimentais', categoria: 'Indicadores do dia', pergunta: 'Experimentais realizadas',
      canContinue: r.experimentais !== '', render: () => numInput(r.experimentais, 'experimentais') });
    list.push({ key: 'novasMatriculas', categoria: 'Indicadores do dia', pergunta: 'Novas matrículas',
      canContinue: r.novasMatriculas !== '', render: () => numInput(r.novasMatriculas, 'novasMatriculas') });
    list.push({ key: 'renovacoes', categoria: 'Indicadores do dia', pergunta: 'Renovações realizadas',
      canContinue: r.renovacoes !== '', render: () => numInput(r.renovacoes, 'renovacoes') });
    list.push({ key: 'cancelamentos', categoria: 'Indicadores do dia', pergunta: 'Cancelamentos',
      canContinue: r.cancelamentos !== '', render: () => numInput(r.cancelamentos, 'cancelamentos') });
    list.push({ key: 'naoRenovados', categoria: 'Indicadores do dia', pergunta: 'Não renovados',
      canContinue: r.naoRenovados !== '', render: () => numInput(r.naoRenovados, 'naoRenovados') });
    list.push({ key: 'evasao', categoria: 'Indicadores do dia', pergunta: 'Evasão',
      canContinue: r.evasao !== '', render: () => numInput(r.evasao, 'evasao') });
    list.push({ key: 'inadimplentes', categoria: 'Indicadores do dia', pergunta: 'Inadimplentes',
      canContinue: r.inadimplentes !== '', render: () => numInput(r.inadimplentes, 'inadimplentes') });

    // 2. Ocorrências e feedbacks
    list.push({
      key: 'ocorrencia', categoria: 'Ocorrências e feedbacks',
      pergunta: 'Houve alguma ocorrência fora do comum com algum aluno?',
      canContinue: r.ocorrencia !== null,
      render: () => sn(r.ocorrencia, (b) => set('ocorrencia', b)),
    });
    if (r.ocorrencia === true) {
      list.push({
        key: 'ocorrenciaDescricao', categoria: 'Ocorrências e feedbacks',
        pergunta: 'Descreva o ocorrido de forma objetiva',
        canContinue: r.ocorrenciaDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.ocorrenciaDescricao}
          onChange={(e) => set('ocorrenciaDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA O OCORRIDO..." className="min-h-32 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'feedbackNegativo', categoria: 'Ocorrências e feedbacks',
      pergunta: 'Houve algum feedback negativo de aluno?',
      canContinue: r.feedbackNegativo !== null,
      render: () => sn(r.feedbackNegativo, (b) => set('feedbackNegativo', b)),
    });
    if (r.feedbackNegativo === true) {
      list.push({
        key: 'feedbackDescricao', categoria: 'Ocorrências e feedbacks',
        pergunta: 'Descreva o feedback e informe se alguma ação já foi tomada',
        canContinue: r.feedbackDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.feedbackDescricao}
          onChange={(e) => set('feedbackDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA E AÇÕES TOMADAS..." className="min-h-32 rounded-2xl text-base" />),
      });
    }

    // 3. Observações finais
    list.push({
      key: 'observacoesLideranca', categoria: 'Observações finais',
      pergunta: 'Alguma informação importante para a liderança acompanhar?',
      apoio: 'Opcional — pode deixar em branco',
      canContinue: true,
      render: () => (<Textarea value={r.observacoesLideranca}
        onChange={(e) => set('observacoesLideranca', e.target.value.toUpperCase())}
        placeholder="ESCREVA AQUI (OPCIONAL)..." className="min-h-32 rounded-2xl text-base" />),
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
          <p className="font-display-condensed text-xs uppercase tracking-[0.4em] opacity-80">Iron Club</p>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight">
            Encerramento<br />Comercial
          </h1>
          <p className="text-sm uppercase tracking-[0.2em] opacity-90">Recepção — Iron Club</p>
          <p className="mx-auto max-w-xs text-base opacity-90">
            Preencha ao final do seu dia. Leva menos de 3 minutos.
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
    push('Unidade', r.unidade);
    push('Responsável pelo fechamento', r.nome);
    push('Data', r.data ? format(r.data, 'dd/MM/yyyy') : '');
    push('Total de alunos ativos', r.totalAtivos);
    push('Leads recebidos', r.leads);
    push('Experimentais realizadas', r.experimentais);
    push('Novas matrículas', r.novasMatriculas);
    push('Renovações realizadas', r.renovacoes);
    push('Cancelamentos', r.cancelamentos);
    push('Não renovados', r.naoRenovados);
    push('Evasão', r.evasao);
    push('Inadimplentes', r.inadimplentes);
    push('Ocorrência fora do comum?',
      r.ocorrencia === true ? `Sim — ${r.ocorrenciaDescricao}` : (r.ocorrencia === false ? 'Não' : ''));
    push('Feedback negativo?',
      r.feedbackNegativo === true ? `Sim — ${r.feedbackDescricao}` : (r.feedbackNegativo === false ? 'Não' : ''));
    push('Para a liderança', r.observacoesLideranca);

    const handleSubmit = async () => {
      if (saving) return;
      setSaving(true);
      try {
        const respostaId = crypto.randomUUID();
        const { error } = await supabase
          .from('relatorio_diario_comercial_respostas')
          .insert({
            id: respostaId,
            nome: r.nome,
            unidade: r.unidade,
            data: r.data ? format(r.data, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            total_alunos_ativos: r.totalAtivos !== '' ? Number(r.totalAtivos) : null,
            leads_recebidos: r.leads !== '' ? Number(r.leads) : null,
            experimentais_realizadas: r.experimentais !== '' ? Number(r.experimentais) : null,
            novos_alunos: r.novasMatriculas !== '' ? Number(r.novasMatriculas) : null,
            renovacoes: r.renovacoes !== '' ? Number(r.renovacoes) : null,
            cancelamentos: r.cancelamentos !== '' ? Number(r.cancelamentos) : null,
            nao_renovados_qtd: r.naoRenovados !== '' ? Number(r.naoRenovados) : null,
            evasao: r.evasao !== '' ? Number(r.evasao) : null,
            inadimplentes_qtd: r.inadimplentes !== '' ? Number(r.inadimplentes) : null,
            ocorrencia: r.ocorrencia,
            ocorrencia_descricao: r.ocorrenciaDescricao || null,
            feedback_negativo: r.feedbackNegativo,
            feedback_negativo_descricao: r.feedbackDescricao || null,
            observacoes: r.observacoesLideranca || null,
          });

        if (error) {
          toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
          setSaving(false);
          return;
        }

        await submitFormularioPublico({
          tipo_formulario: 'relatorio_comercial',
          unidade: r.unidade,
          unidade_id: r.unidade === 'ZONA NORTE' ? 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6' : 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a',
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
            <span className="font-display-condensed text-lg font-extrabold uppercase tracking-wider">Iron Club</span>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Resumo</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-5 pb-44 pt-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-anamnese-category">Confira antes de enviar</p>
          <h2 className="mt-2 text-[26px] font-bold leading-[1.15] text-anamnese-card-foreground">Resumo do encerramento</h2>
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
              {saving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando...</> : <>Enviar relatório <ArrowRight className="ml-2 h-5 w-5" /></>}
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
          <h1 className="font-display text-4xl font-extrabold uppercase leading-tight">Relatório enviado</h1>
          <p className="text-base opacity-90">Bom descanso!</p>
          <Button size="lg" onClick={() => { setR(initial); setStep(0); setStage('intro'); }}
            className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-anamnese-royal shadow-lg hover:bg-white/90">
            <RefreshCw className="mr-2 h-5 w-5" /> Novo relatório
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
