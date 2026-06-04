import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
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
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';

type Stage = 'intro' | 'wizard' | 'review' | 'done';

const ATIVIDADES = [
  'Retorno de mensagens no WhatsApp',
  'Disparos no Instagram',
  'Atualização da planilha de leads',
  'Verificação de cadastros expirados ou próximos do vencimento',
  'Ligações para leads',
  'Atendimento de experimentais',
  'Renovações e rematrículas',
  'Outros',
];

interface Respostas {
  nome: string;
  unidade: string;
  unidadeId: string;
  data: Date | null;
  totalAtivos: string;
  leads: string;
  experimentais: string;
  novos: string;
  renovacoes: string;
  cancelamentos: string;
  inadimplentes: string;
  naoRenovados: string;
  atividades: string[];
  pendencias: string;
  planoAmanha: string;
  precisaSuporte: boolean | null;
  suporteDescricao: string;
  observacoes: string;
}

const initial: Respostas = {
  nome: '',
  unidade: '',
  unidadeId: '',
  data: new Date(),
  totalAtivos: '',
  leads: '',
  experimentais: '',
  novos: '',
  renovacoes: '',
  cancelamentos: '',
  inadimplentes: '',
  naoRenovados: '',
  atividades: [],
  pendencias: '',
  planoAmanha: '',
  precisaSuporte: null,
  suporteDescricao: '',
  observacoes: '',
};

export default function RelatorioDiarioComercial() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { unidadesPermitidas, loading: unitsLoading } = useUnidade();
  const [stage, setStage] = useState<Stage>('intro');
  const [step, setStep] = useState(0);
  const [r, setR] = useState<Respostas>(initial);
  const [saving, setSaving] = useState(false);

  // Prefill user name if available
  useEffect(() => {
    if (user?.email && !r.nome) {
      set('nome', user.email.split('@')[0].toUpperCase());
    }
  }, [user]);

  const set = <K extends keyof Respostas>(k: K, v: Respostas[K]) =>
    setR((prev) => ({ ...prev, [k]: v }));

  const toggleAtividade = (a: string) => {
    setR((prev) => ({
      ...prev,
      atividades: prev.atividades.includes(a)
        ? prev.atividades.filter((x) => x !== a)
        : [...prev.atividades, a],
    }));
  };

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
      key: 'nome', categoria: 'Identificação', pergunta: 'Qual o seu nome?',
      canContinue: r.nome.trim().length >= 2,
      render: () => (<Input value={r.nome} onChange={(e) => set('nome', e.target.value.toUpperCase())}
        placeholder="EX: ANA SILVA" className="h-14 rounded-2xl text-base" />),
    });
    list.push({
      key: 'unidade', categoria: 'Identificação', pergunta: 'Qual unidade?',
      canContinue: !!r.unidadeId,
      render: () => (
        <div className="grid grid-cols-1 gap-3">
          {unidadesPermitidas.filter(u => u.id !== '00000000-0000-0000-0000-000000000000').map((u) => {
            const label = u.nome.toUpperCase().includes('MADALENA') || u.nome.toUpperCase().includes('NORTE') ? 'ZONA NORTE' : 
                         u.nome.toUpperCase().includes('VIAGEM') || u.nome.toUpperCase().includes('SUL') ? 'ZONA SUL' : u.nome;
            const emoji = label === 'ZONA NORTE' ? '🌳' : label === 'ZONA SUL' ? '🌊' : '📍';
            
            return (
              <OptionCard 
                key={u.id}
                emoji={emoji} 
                label={label} 
                selected={r.unidadeId === u.id} 
                onClick={() => {
                  set('unidadeId', u.id);
                  set('unidade', label);
                }} 
              />
            );
          })}
          {unidadesPermitidas.length === 0 && !unitsLoading && (
            <p className="text-center text-sm text-anamnese-muted-foreground">
              Nenhuma unidade vinculada ao seu usuário.
            </p>
          )}
          {unitsLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
        </div>
      ),
    });

    // Métricas do dia
    list.push({ key: 'totalAtivos', categoria: 'Métricas do dia', pergunta: 'Total de alunos ativos',
      canContinue: r.totalAtivos !== '', render: () => numInput(r.totalAtivos, 'totalAtivos') });
    list.push({ key: 'leads', categoria: 'Métricas do dia', pergunta: 'Leads recebidos',
      canContinue: r.leads !== '', render: () => numInput(r.leads, 'leads') });
    list.push({ key: 'experimentais', categoria: 'Métricas do dia', pergunta: 'Aulas experimentais realizadas',
      canContinue: r.experimentais !== '', render: () => numInput(r.experimentais, 'experimentais') });
    list.push({ key: 'novos', categoria: 'Métricas do dia', pergunta: 'Novos alunos fechados',
      canContinue: r.novos !== '', render: () => numInput(r.novos, 'novos') });
    list.push({ key: 'renovacoes', categoria: 'Métricas do dia', pergunta: 'Renovações feitas',
      canContinue: r.renovacoes !== '', render: () => numInput(r.renovacoes, 'renovacoes') });
    list.push({ key: 'cancelamentos', categoria: 'Métricas do dia', pergunta: 'Cancelamentos',
      canContinue: r.cancelamentos !== '', render: () => numInput(r.cancelamentos, 'cancelamentos') });
    list.push({
      key: 'inadimplentes', categoria: 'Métricas do dia',
      pergunta: 'Alunos inadimplentes — nome e motivo resumido',
      apoio: 'Opcional — pode deixar em branco',
      canContinue: true,
      render: () => (<Textarea value={r.inadimplentes}
        onChange={(e) => set('inadimplentes', e.target.value.toUpperCase())}
        placeholder="EX: FULANO — ATRASO 30 DIAS" className="min-h-28 rounded-2xl text-base" />),
    });
    list.push({
      key: 'naoRenovados', categoria: 'Métricas do dia',
      pergunta: 'Alunos mensais que não renovaram — nome e motivo',
      apoio: 'Opcional — pode deixar em branco',
      canContinue: true,
      render: () => (<Textarea value={r.naoRenovados}
        onChange={(e) => set('naoRenovados', e.target.value.toUpperCase())}
        placeholder="EX: FULANO — MUDOU DE CIDADE" className="min-h-28 rounded-2xl text-base" />),
    });

    // Atividades realizadas — chips
    list.push({
      key: 'atividades', categoria: 'Atividades realizadas',
      pergunta: 'Quais atividades foram realizadas hoje?',
      apoio: 'Selecione todas que se aplicam',
      canContinue: r.atividades.length > 0,
      render: () => (
        <div className="flex flex-wrap gap-2">
          {ATIVIDADES.map((a) => {
            const selected = r.atividades.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAtividade(a)}
                className={cn(
                  'rounded-full border-2 px-4 py-2 text-sm font-medium transition-all',
                  selected
                    ? 'border-anamnese-border-selected bg-anamnese-royal text-anamnese-royal-foreground shadow-md'
                    : 'border-anamnese-border bg-anamnese-card text-anamnese-card-foreground'
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
      ),
    });

    // Pendências e planejamento
    list.push({
      key: 'pendencias', categoria: 'Pendências e planejamento',
      pergunta: 'O que não conseguiu fazer hoje e por quê?',
      apoio: 'Opcional — pode deixar em branco',
      canContinue: true,
      render: () => (<Textarea value={r.pendencias}
        onChange={(e) => set('pendencias', e.target.value.toUpperCase())}
        placeholder="ESCREVA AQUI..." className="min-h-32 rounded-2xl text-base" />),
    });
    list.push({
      key: 'planoAmanha', categoria: 'Pendências e planejamento',
      pergunta: 'O que vai fazer amanhã?',
      canContinue: r.planoAmanha.trim().length >= 3,
      render: () => (<Textarea value={r.planoAmanha}
        onChange={(e) => set('planoAmanha', e.target.value.toUpperCase())}
        placeholder="ESCREVA AQUI..." className="min-h-32 rounded-2xl text-base" />),
    });

    // Suporte e melhorias
    list.push({
      key: 'precisaSuporte', categoria: 'Suporte e melhorias',
      pergunta: 'Precisa de alguém ou algo para facilitar seu trabalho?',
      canContinue: r.precisaSuporte !== null,
      render: () => sn(r.precisaSuporte, (b) => set('precisaSuporte', b)),
    });
    if (r.precisaSuporte === true) {
      list.push({
        key: 'suporteDescricao', categoria: 'Suporte e melhorias',
        pergunta: 'Descreva o que precisa',
        canContinue: r.suporteDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.suporteDescricao}
          onChange={(e) => set('suporteDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA..." className="min-h-28 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'observacoes', categoria: 'Suporte e melhorias',
      pergunta: 'Sugestões ou observações gerais',
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
          <p className="font-display-condensed text-xs uppercase tracking-[0.4em] opacity-80">Iron Club</p>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight">
            Relatório<br />Diário
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
    push('Nome', r.nome);
    push('Unidade', r.unidade);
    push('Data', r.data ? format(r.data, 'dd/MM/yyyy') : '');
    push('Total de alunos ativos', r.totalAtivos);
    push('Leads recebidos', r.leads);
    push('Experimentais realizadas', r.experimentais);
    push('Novos alunos fechados', r.novos);
    push('Renovações feitas', r.renovacoes);
    push('Cancelamentos', r.cancelamentos);
    push('Inadimplentes', r.inadimplentes);
    push('Mensais que não renovaram', r.naoRenovados);
    push('Atividades realizadas', r.atividades.join(', '));
    push('Não conseguiu fazer', r.pendencias);
    push('Plano para amanhã', r.planoAmanha);
    push('Precisa de suporte?', r.precisaSuporte === true ? `Sim — ${r.suporteDescricao}` : (r.precisaSuporte === false ? 'Não' : ''));
    push('Observações', r.observacoes);

    const handleSubmit = async () => {
      setSaving(true);
      try {
        const respostaId = crypto.randomUUID();
        const { error } = await supabase
          .from('relatorio_diario_comercial_respostas')
          .insert({
            id: respostaId,
            nome: r.nome,
            unidade: r.unidade,
            unidade_id: r.unidadeId,
            submitted_by: user?.id || null,
            data: r.data ? format(r.data, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            total_alunos_ativos: r.totalAtivos !== '' ? Number(r.totalAtivos) : null,
            leads_recebidos: r.leads !== '' ? Number(r.leads) : null,
            experimentais_realizadas: r.experimentais !== '' ? Number(r.experimentais) : null,
            novos_alunos: r.novos !== '' ? Number(r.novos) : null,
            renovacoes: r.renovacoes !== '' ? Number(r.renovacoes) : null,
            cancelamentos: r.cancelamentos !== '' ? Number(r.cancelamentos) : null,
            inadimplentes: r.inadimplentes || null,
            nao_renovados: r.naoRenovados || null,
            atividades_realizadas: r.atividades.length > 0 ? r.atividades : null,
            pendencias: r.pendencias || null,
            plano_amanha: r.planoAmanha || null,
            precisa_suporte: r.precisaSuporte,
            suporte_descricao: r.suporteDescricao || null,
            observacoes: r.observacoes || null,
          });

        if (error) {
          if (error.code === '42501') {
            toast({ 
              title: 'Acesso negado', 
              description: 'Você não tem permissão para enviar relatórios para esta unidade.', 
              variant: 'destructive' 
            });
          } else {
            toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
          }
          return;
        }

        await submitFormularioPublico({
          tipo_formulario: 'relatorio_comercial',
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
      } finally {
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
