import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StepShell } from '@/components/anamnese/StepShell';
import { OptionCard } from '@/components/anamnese/OptionCard';
import { submitFormularioPublico } from '@/lib/notifyFormularioGrupo';
import { useFormDraft, submitWithRetry, clearDraft } from '@/lib/formDraft';

type Stage = 'intro' | 'wizard' | 'review' | 'done';

type Fechamento = '' | 'TODAS' | 'PARCIAL' | 'NENHUMA' | 'NAO_HOUVE';
type Motivo = '' | 'PRECO' | 'VAI_PENSAR' | 'NAO_GOSTOU' | 'HORARIO' | 'OUTRO';

interface Respostas {
  nome: string;
  unidade: '' | 'ZONA NORTE' | 'ZONA SUL';
  // Indicadores
  totalAtivos: string;
  leads: string;
  experimentaisAgendadas: string;
  experimentaisRealizadas: string;
  fechamento: Fechamento;
  qtdNaoFecharam: string;
  motivoNaoFechamento: Motivo;
  motivoNaoFechamentoOutro: string;
  novasMatriculasTexto: string;
  renovacoesTexto: string;
  cancelamentosTexto: string;
  naoRenovadosTexto: string;
  inadimplentesTexto: string;
  // Ocorrências e feedbacks
  ocorrencia: boolean | null;
  ocorrenciaDescricao: string;
  feedbackNegativo: boolean | null;
  feedbackDescricao: string;
  acaoTomada: boolean | null;
  acaoTomadaDescricao: string;
  // Observações
  observacoesLideranca: string;
}

const initial: Respostas = {
  nome: '',
  unidade: '',
  totalAtivos: '',
  leads: '',
  experimentaisAgendadas: '',
  experimentaisRealizadas: '',
  fechamento: '',
  qtdNaoFecharam: '',
  motivoNaoFechamento: '',
  motivoNaoFechamentoOutro: '',
  novasMatriculasTexto: '',
  renovacoesTexto: '',
  cancelamentosTexto: '',
  naoRenovadosTexto: '',
  inadimplentesTexto: '',
  ocorrencia: null,
  ocorrenciaDescricao: '',
  feedbackNegativo: null,
  feedbackDescricao: '',
  acaoTomada: null,
  acaoTomadaDescricao: '',
  observacoesLideranca: '',
};

const fechamentoLabels: Record<Exclude<Fechamento, ''>, string> = {
  TODAS: 'Sim, todas',
  PARCIAL: 'Sim, parcial',
  NENHUMA: 'Nenhuma',
  NAO_HOUVE: 'Não houve experimental hoje',
};

const motivoLabels: Record<Exclude<Motivo, ''>, string> = {
  PRECO: 'Preço',
  VAI_PENSAR: 'Vai pensar',
  NAO_GOSTOU: 'Não gostou da proposta',
  HORARIO: 'Questão de horário',
  OUTRO: 'Outro',
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

  const textArea = (val: string, k: keyof Respostas, placeholder: string) => (
    <Textarea
      value={val}
      onChange={(e) => set(k, e.target.value.toUpperCase() as Respostas[typeof k])}
      placeholder={placeholder}
      className="min-h-32 rounded-2xl text-base"
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

    // BLOCO 1 — Identificação
    list.push({
      key: 'unidade', categoria: 'Identificação', pergunta: 'Qual a unidade?',
      canContinue: !!r.unidade,
      render: () => (<>
        <OptionCard emoji="🌳" label="Zona Norte" selected={r.unidade === 'ZONA NORTE'} onClick={() => set('unidade', 'ZONA NORTE')} />
        <OptionCard emoji="🌊" label="Zona Sul" selected={r.unidade === 'ZONA SUL'} onClick={() => set('unidade', 'ZONA SUL')} />
      </>),
    });
    list.push({
      key: 'nome', categoria: 'Identificação', pergunta: 'Nome do responsável pelo relatório',
      canContinue: r.nome.trim().length >= 2,
      render: () => (<Input value={r.nome} onChange={(e) => set('nome', e.target.value.toUpperCase())}
        placeholder="EX: ANA SILVA" className="h-14 rounded-2xl text-base" />),
    });

    // BLOCO 2 — Indicadores do dia
    list.push({ key: 'totalAtivos', categoria: 'Indicadores do dia', pergunta: 'Total de alunos ativos',
      canContinue: r.totalAtivos !== '', render: () => numInput(r.totalAtivos, 'totalAtivos') });
    list.push({ key: 'leads', categoria: 'Indicadores do dia', pergunta: 'Leads recebidos',
      canContinue: r.leads !== '', render: () => numInput(r.leads, 'leads') });
    list.push({ key: 'experimentaisAgendadas', categoria: 'Indicadores do dia', pergunta: 'Experimentais agendadas',
      canContinue: r.experimentaisAgendadas !== '', render: () => numInput(r.experimentaisAgendadas, 'experimentaisAgendadas') });
    list.push({ key: 'experimentaisRealizadas', categoria: 'Indicadores do dia', pergunta: 'Experimentais realizadas',
      canContinue: r.experimentaisRealizadas !== '', render: () => numInput(r.experimentaisRealizadas, 'experimentaisRealizadas') });

    list.push({
      key: 'fechamento', categoria: 'Indicadores do dia',
      pergunta: 'Houve fechamento nas experimentais de hoje?',
      canContinue: r.fechamento !== '',
      render: () => (<>
        {(Object.keys(fechamentoLabels) as Array<Exclude<Fechamento, ''>>).map((k) => (
          <OptionCard key={k} emoji="" label={fechamentoLabels[k]}
            selected={r.fechamento === k} onClick={() => set('fechamento', k)} />
        ))}
      </>),
    });

    if (r.fechamento === 'PARCIAL' || r.fechamento === 'NENHUMA') {
      list.push({ key: 'qtdNaoFecharam', categoria: 'Indicadores do dia', pergunta: 'Quantos não fecharam?',
        canContinue: r.qtdNaoFecharam !== '', render: () => numInput(r.qtdNaoFecharam, 'qtdNaoFecharam') });

      list.push({
        key: 'motivoNaoFechamento', categoria: 'Indicadores do dia',
        pergunta: 'Qual o principal motivo do não fechamento?',
        canContinue: r.motivoNaoFechamento !== '',
        render: () => (<>
          {(Object.keys(motivoLabels) as Array<Exclude<Motivo, ''>>).map((k) => (
            <OptionCard key={k} emoji="" label={motivoLabels[k]}
              selected={r.motivoNaoFechamento === k} onClick={() => set('motivoNaoFechamento', k)} />
          ))}
        </>),
      });

      if (r.motivoNaoFechamento === 'OUTRO') {
        list.push({
          key: 'motivoNaoFechamentoOutro', categoria: 'Indicadores do dia',
          pergunta: 'Descreva o motivo',
          canContinue: r.motivoNaoFechamentoOutro.trim().length >= 3,
          render: () => textArea(r.motivoNaoFechamentoOutro, 'motivoNaoFechamentoOutro', 'DESCREVA O MOTIVO...'),
        });
      }
    }

    list.push({
      key: 'novasMatriculasTexto', categoria: 'Indicadores do dia',
      pergunta: 'Houve novas matrículas hoje? Se sim, quantas e quais os nomes?',
      apoio: 'Se não houve, escreva "NÃO".',
      canContinue: r.novasMatriculasTexto.trim().length >= 1,
      render: () => textArea(r.novasMatriculasTexto, 'novasMatriculasTexto', 'EX: 2 — JOÃO SILVA, MARIA SOUZA'),
    });
    list.push({
      key: 'renovacoesTexto', categoria: 'Indicadores do dia',
      pergunta: 'Houve renovações hoje? Se sim, quantas e quais os nomes?',
      apoio: 'Se não houve, escreva "NÃO".',
      canContinue: r.renovacoesTexto.trim().length >= 1,
      render: () => textArea(r.renovacoesTexto, 'renovacoesTexto', 'EX: 1 — PEDRO COSTA'),
    });
    list.push({
      key: 'cancelamentosTexto', categoria: 'Indicadores do dia',
      pergunta: 'Houve cancelamentos solicitados hoje? Se sim, quantos e quais os motivos?',
      apoio: 'Se não houve, escreva "NÃO".',
      canContinue: r.cancelamentosTexto.trim().length >= 1,
      render: () => textArea(r.cancelamentosTexto, 'cancelamentosTexto', 'EX: 1 — MUDANÇA DE CIDADE'),
    });
    list.push({
      key: 'naoRenovadosTexto', categoria: 'Indicadores do dia',
      pergunta: 'Houve não renovações hoje? Se sim, quantos e qual o perfil dos alunos?',
      apoio: 'Se não houve, escreva "NÃO".',
      canContinue: r.naoRenovadosTexto.trim().length >= 1,
      render: () => textArea(r.naoRenovadosTexto, 'naoRenovadosTexto', 'EX: 2 — ALUNOS DE PLANO MENSAL'),
    });
    list.push({
      key: 'inadimplentesTexto', categoria: 'Indicadores do dia',
      pergunta: 'Há inadimplentes ativos no momento? Se sim, quantos e algum caso crítico para destacar?',
      apoio: 'Se não houver, escreva "NÃO".',
      canContinue: r.inadimplentesTexto.trim().length >= 1,
      render: () => textArea(r.inadimplentesTexto, 'inadimplentesTexto', 'EX: 3 — CASO CRÍTICO: ...'),
    });

    // BLOCO 3 — Ocorrências e feedbacks
    list.push({
      key: 'ocorrencia', categoria: 'Ocorrências e feedbacks',
      pergunta: 'Houve ocorrência fora do comum com algum aluno?',
      canContinue: r.ocorrencia !== null,
      render: () => sn(r.ocorrencia, (b) => set('ocorrencia', b)),
    });
    if (r.ocorrencia === true) {
      list.push({
        key: 'ocorrenciaDescricao', categoria: 'Ocorrências e feedbacks',
        pergunta: 'Descreva o ocorrido de forma objetiva',
        canContinue: r.ocorrenciaDescricao.trim().length >= 3,
        render: () => textArea(r.ocorrenciaDescricao, 'ocorrenciaDescricao', 'DESCREVA O OCORRIDO...'),
      });
    }

    list.push({
      key: 'feedbackNegativo', categoria: 'Ocorrências e feedbacks',
      pergunta: 'Houve feedback negativo de aluno?',
      canContinue: r.feedbackNegativo !== null,
      render: () => sn(r.feedbackNegativo, (b) => set('feedbackNegativo', b)),
    });
    if (r.feedbackNegativo === true) {
      list.push({
        key: 'feedbackDescricao', categoria: 'Ocorrências e feedbacks',
        pergunta: 'Qual foi o feedback?',
        canContinue: r.feedbackDescricao.trim().length >= 3,
        render: () => textArea(r.feedbackDescricao, 'feedbackDescricao', 'DESCREVA O FEEDBACK...'),
      });
      list.push({
        key: 'acaoTomada', categoria: 'Ocorrências e feedbacks',
        pergunta: 'Alguma ação já foi tomada?',
        canContinue: r.acaoTomada !== null,
        render: () => sn(r.acaoTomada, (b) => set('acaoTomada', b)),
      });
      if (r.acaoTomada === true) {
        list.push({
          key: 'acaoTomadaDescricao', categoria: 'Ocorrências e feedbacks',
          pergunta: 'Qual ação foi tomada?',
          canContinue: r.acaoTomadaDescricao.trim().length >= 3,
          render: () => textArea(r.acaoTomadaDescricao, 'acaoTomadaDescricao', 'DESCREVA A AÇÃO TOMADA...'),
        });
      }
    }

    // BLOCO 4 — Observações finais
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
          <p className="font-display-condensed text-xs uppercase tracking-[0.4em] opacity-80">EVO TRAINING CLUB</p>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight">
            Relatório Diário<br />Comercial
          </h1>
          <p className="text-sm uppercase tracking-[0.2em] opacity-90">Recepção — EVO TRAINING CLUB</p>
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
    push('Responsável pelo relatório', r.nome);
    push('Total de alunos ativos', r.totalAtivos);
    push('Leads recebidos', r.leads);
    push('Experimentais agendadas', r.experimentaisAgendadas);
    push('Experimentais realizadas', r.experimentaisRealizadas);
    push('Fechamento nas experimentais',
      r.fechamento ? fechamentoLabels[r.fechamento as Exclude<Fechamento, ''>] : '');
    push('Quantos não fecharam', r.qtdNaoFecharam);
    push('Motivo do não fechamento',
      r.motivoNaoFechamento ? motivoLabels[r.motivoNaoFechamento as Exclude<Motivo, ''>] : '');
    push('Descrição do motivo', r.motivoNaoFechamentoOutro);
    push('Novas matrículas hoje', r.novasMatriculasTexto);
    push('Renovações hoje', r.renovacoesTexto);
    push('Cancelamentos solicitados hoje', r.cancelamentosTexto);
    push('Não renovações hoje', r.naoRenovadosTexto);
    push('Inadimplentes ativos', r.inadimplentesTexto);
    push('Ocorrência fora do comum?',
      r.ocorrencia === true ? `Sim — ${r.ocorrenciaDescricao}` : (r.ocorrencia === false ? 'Não' : ''));
    if (r.feedbackNegativo === true) {
      push('Feedback negativo', `Sim — ${r.feedbackDescricao}`);
      push('Ação tomada?',
        r.acaoTomada === true ? `Sim — ${r.acaoTomadaDescricao}` : (r.acaoTomada === false ? 'Não' : ''));
    } else if (r.feedbackNegativo === false) {
      push('Feedback negativo', 'Não');
    }
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
            data: format(new Date(), 'yyyy-MM-dd'),
            total_alunos_ativos: r.totalAtivos !== '' ? Number(r.totalAtivos) : null,
            leads_recebidos: r.leads !== '' ? Number(r.leads) : null,
            experimentais_agendadas: r.experimentaisAgendadas !== '' ? Number(r.experimentaisAgendadas) : null,
            experimentais_realizadas: r.experimentaisRealizadas !== '' ? Number(r.experimentaisRealizadas) : null,
            fechamento_experimentais: r.fechamento || null,
            qtd_nao_fecharam: r.qtdNaoFecharam !== '' ? Number(r.qtdNaoFecharam) : null,
            motivo_nao_fechamento: r.motivoNaoFechamento || null,
            motivo_nao_fechamento_outro: r.motivoNaoFechamentoOutro || null,
            novas_matriculas_texto: r.novasMatriculasTexto || null,
            renovacoes_texto: r.renovacoesTexto || null,
            cancelamentos_texto: r.cancelamentosTexto || null,
            nao_renovados_texto: r.naoRenovadosTexto || null,
            inadimplentes_texto: r.inadimplentesTexto || null,
            ocorrencia: r.ocorrencia,
            ocorrencia_descricao: r.ocorrenciaDescricao || null,
            feedback_negativo: r.feedbackNegativo,
            feedback_negativo_descricao: r.feedbackDescricao || null,
            feedback_acao_tomada: r.acaoTomada,
            feedback_acao_descricao: r.acaoTomadaDescricao || null,
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
            <span className="font-display-condensed text-lg font-extrabold uppercase tracking-wider">EVO TRAINING CLUB</span>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Resumo</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-5 pb-44 pt-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-anamnese-category">Confira antes de enviar</p>
          <h2 className="mt-2 text-[26px] font-bold leading-[1.15] text-anamnese-card-foreground">Resumo do relatório</h2>
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
