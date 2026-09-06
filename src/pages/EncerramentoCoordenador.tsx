import { useMemo, useState } from 'react';
import { ArrowRight, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StepShell } from '@/components/anamnese/StepShell';
import { OptionCard } from '@/components/anamnese/OptionCard';
import { cn } from '@/lib/utils';
import { submitFormularioPublico } from '@/lib/notifyFormularioGrupo';
import { useFormDraft, submitWithRetry, clearDraft } from '@/lib/formDraft';
import { UNIDADES_FORMULARIO, type UnidadeFormularioValue, getUnidadeIdByValue } from '@/lib/formularioUnidades';

type Stage = 'intro' | 'wizard' | 'review' | 'done';

interface Respostas {
  // Identificação
  nome: string;
  unidade: '' | UnidadeFormularioValue;
  turno: '' | 'MANHÃ' | 'TARDE' | 'NOITE';
  ultimoTurnoDia: boolean | null;

  // Estrutura (0-5)
  limpeza: number | null;
  equipamentos: number | null;
  climatizacao: number | null;
  organizacao: number | null;
  infraestrutura: number | null;

  // Equipe
  todosCompareceram: boolean | null;
  faltasAtrasos: string;
  postura: number | null;
  proatividade: number | null;
  destaquePositivo: boolean | null;
  destaqueDescricao: string;
  feedbackCorretivo: boolean | null;
  feedbackDescricao: string;

  // Alunos
  reclamacao: boolean | null;
  reclamacaoDescricao: string;
  reclamacaoAcao: string;
  reclamacaoResolvida: boolean | null;
  reclamacaoPendencia: string;
  elogio: boolean | null;
  elogioDescricao: string;

  // Ocorrências
  ocorrencia: boolean | null;
  ocorrenciaTipo: string;
  ocorrenciaGravidade: '' | 'BAIXA' | 'MÉDIA' | 'ALTA';
  ocorrenciaDescricao: string;
  ocorrenciaAcao: string;
  ocorrenciaResolvida: boolean | null;
  ocorrenciaPendencia: string;

  // Avaliação
  padraoIron: boolean | null;
  foraPadraoDescricao: string;
  funcionouBem: string;
  notaGeral: number | null;

  // Fechamento (se ultimoTurnoDia)
  pontosAtencao: string;
  pendenciasAbertas: string;
}

const initial: Respostas = {
  nome: '',
  unidade: '',
  turno: '',
  ultimoTurnoDia: null,
  limpeza: null,
  equipamentos: null,
  climatizacao: null,
  organizacao: null,
  infraestrutura: null,
  todosCompareceram: null,
  faltasAtrasos: '',
  postura: null,
  proatividade: null,
  destaquePositivo: null,
  destaqueDescricao: '',
  feedbackCorretivo: null,
  feedbackDescricao: '',
  reclamacao: null,
  reclamacaoDescricao: '',
  reclamacaoAcao: '',
  reclamacaoResolvida: null,
  reclamacaoPendencia: '',
  elogio: null,
  elogioDescricao: '',
  ocorrencia: null,
  ocorrenciaTipo: '',
  ocorrenciaGravidade: '',
  ocorrenciaDescricao: '',
  ocorrenciaAcao: '',
  ocorrenciaResolvida: null,
  ocorrenciaPendencia: '',
  padraoIron: null,
  foraPadraoDescricao: '',
  funcionouBem: '',
  notaGeral: null,
  pontosAtencao: '',
  pendenciasAbertas: '',
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

export default function EncerramentoCoordenador() {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('intro');
  const [step, setStep] = useState(0);
  const [r, setR] = useState<Respostas>(initial);
  const [saving, setSaving] = useState(false);

  useFormDraft<Respostas>({
    key: 'encerramento-coordenador',
    data: r,
    step,
    stage,
    enabled: stage !== 'done',
    onRestore: (draft) => {
      setR(draft.data);
      setStep(draft.step);
      setStage(draft.stage as Stage);
      toast({ title: 'Rascunho recuperado', description: 'Continuamos de onde você parou.' });
    },
  });

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

  const steps = useMemo<Step[]>(() => {
    const list: Step[] = [];
    const sim_nao = (val: boolean | null, onYes: () => void, onNo: () => void) => (
      <>
        <OptionCard emoji="✅" label="Sim" selected={val === true} onClick={onYes} />
        <OptionCard emoji="🚫" label="Não" selected={val === false} onClick={onNo} />
      </>
    );

    // ===== Identificação
    list.push({
      key: 'nome', categoria: 'Identificação', pergunta: 'Nome do coordenador responsável',
      canContinue: r.nome.trim().length >= 2,
      render: () => (
        <Input value={r.nome} onChange={(e) => set('nome', e.target.value.toUpperCase())}
          placeholder="EX: ANA SILVA" className="h-14 rounded-2xl text-base" />
      ),
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
    list.push({
      key: 'ultimoTurno', categoria: 'Identificação', pergunta: 'Este foi o último turno do dia?',
      canContinue: r.ultimoTurnoDia !== null,
      render: () => sim_nao(r.ultimoTurnoDia, () => set('ultimoTurnoDia', true), () => set('ultimoTurnoDia', false)),
    });

    // ===== Estrutura
    const escalas: { key: keyof Respostas; pergunta: string; apoio?: string }[] = [
      { key: 'limpeza', pergunta: 'Limpeza geral', apoio: 'Salão, banheiros, vestiários · 0 = péssimo · 5 = excelente' },
      { key: 'equipamentos', pergunta: 'Equipamentos funcionando', apoio: '0 = vários problemas · 5 = todos ok' },
      { key: 'climatizacao', pergunta: 'Climatização', apoio: 'Ar-condicionado e ventilação' },
      { key: 'organizacao', pergunta: 'Organização do espaço', apoio: 'Pesos guardados, acessórios no lugar' },
      { key: 'infraestrutura', pergunta: 'Infraestrutura', apoio: 'Iluminação, som, TV, Wi-Fi' },
    ];
    escalas.forEach(({ key, pergunta, apoio }) => {
      list.push({
        key: String(key), categoria: 'Estrutura e ambiente', pergunta, apoio,
        canContinue: r[key] !== null,
        render: () => <ScaleButtons value={r[key] as number | null} onChange={(n) => set(key, n as never)} />,
      });
    });

    // ===== Equipe
    list.push({
      key: 'todosCompareceram', categoria: 'Equipe', pergunta: 'Todos os colaboradores escalados compareceram?',
      canContinue: r.todosCompareceram !== null,
      render: () => sim_nao(r.todosCompareceram, () => set('todosCompareceram', true), () => set('todosCompareceram', false)),
    });
    if (r.todosCompareceram === false) {
      list.push({
        key: 'faltasAtrasos', categoria: 'Equipe', pergunta: 'Quem faltou ou atrasou?',
        canContinue: r.faltasAtrasos.trim().length >= 2,
        render: () => (<Textarea value={r.faltasAtrasos} onChange={(e) => set('faltasAtrasos', e.target.value.toUpperCase())}
          placeholder="EX: FULANO ATRASOU 30MIN..." className="min-h-28 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'postura', categoria: 'Equipe', pergunta: 'Postura e atendimento da equipe', apoio: '0 = ruim · 5 = excelente',
      canContinue: r.postura !== null,
      render: () => <ScaleButtons value={r.postura} onChange={(n) => set('postura', n)} />,
    });
    list.push({
      key: 'proatividade', categoria: 'Equipe', pergunta: 'Proatividade da equipe', apoio: 'Abordagem a alunos, organização espontânea',
      canContinue: r.proatividade !== null,
      render: () => <ScaleButtons value={r.proatividade} onChange={(n) => set('proatividade', n)} />,
    });
    list.push({
      key: 'destaquePositivo', categoria: 'Equipe', pergunta: 'Algum colaborador se destacou positivamente?',
      canContinue: r.destaquePositivo !== null,
      render: () => sim_nao(r.destaquePositivo, () => set('destaquePositivo', true), () => set('destaquePositivo', false)),
    });
    if (r.destaquePositivo === true) {
      list.push({
        key: 'destaqueDescricao', categoria: 'Equipe', pergunta: 'Quem e o que foi observado?',
        canContinue: r.destaqueDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.destaqueDescricao} onChange={(e) => set('destaqueDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA AQUI..." className="min-h-28 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'feedbackCorretivo', categoria: 'Equipe', pergunta: 'Algum colaborador precisou de feedback corretivo?',
      canContinue: r.feedbackCorretivo !== null,
      render: () => sim_nao(r.feedbackCorretivo, () => set('feedbackCorretivo', true), () => set('feedbackCorretivo', false)),
    });
    if (r.feedbackCorretivo === true) {
      list.push({
        key: 'feedbackDescricao', categoria: 'Equipe', pergunta: 'Quem e o que foi abordado?',
        canContinue: r.feedbackDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.feedbackDescricao} onChange={(e) => set('feedbackDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA AQUI..." className="min-h-28 rounded-2xl text-base" />),
      });
    }

    // ===== Alunos
    list.push({
      key: 'reclamacao', categoria: 'Alunos', pergunta: 'Houve reclamação de aluno neste turno?',
      canContinue: r.reclamacao !== null,
      render: () => sim_nao(r.reclamacao, () => set('reclamacao', true), () => set('reclamacao', false)),
    });
    if (r.reclamacao === true) {
      list.push({
        key: 'reclamacaoDescricao', categoria: 'Alunos', pergunta: 'Descrição da reclamação',
        canContinue: r.reclamacaoDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.reclamacaoDescricao} onChange={(e) => set('reclamacaoDescricao', e.target.value.toUpperCase())}
          placeholder="O QUE O ALUNO RELATOU..." className="min-h-28 rounded-2xl text-base" />),
      });
      list.push({
        key: 'reclamacaoAcao', categoria: 'Alunos', pergunta: 'Ação tomada na hora',
        canContinue: r.reclamacaoAcao.trim().length >= 3,
        render: () => (<Textarea value={r.reclamacaoAcao} onChange={(e) => set('reclamacaoAcao', e.target.value.toUpperCase())}
          placeholder="O QUE FOI FEITO..." className="min-h-28 rounded-2xl text-base" />),
      });
      list.push({
        key: 'reclamacaoResolvida', categoria: 'Alunos', pergunta: 'A reclamação foi resolvida?',
        canContinue: r.reclamacaoResolvida !== null,
        render: () => sim_nao(r.reclamacaoResolvida, () => set('reclamacaoResolvida', true), () => set('reclamacaoResolvida', false)),
      });
      if (r.reclamacaoResolvida === false) {
        list.push({
          key: 'reclamacaoPendencia', categoria: 'Alunos', pergunta: 'Descreva o que ficou pendente',
          canContinue: r.reclamacaoPendencia.trim().length >= 3,
          render: () => (<Textarea value={r.reclamacaoPendencia} onChange={(e) => set('reclamacaoPendencia', e.target.value.toUpperCase())}
            placeholder="O QUE PRECISA SER RESOLVIDO..." className="min-h-28 rounded-2xl text-base" />),
        });
      }
    }
    list.push({
      key: 'elogio', categoria: 'Alunos', pergunta: 'Houve elogio ou feedback positivo de aluno?',
      canContinue: r.elogio !== null,
      render: () => sim_nao(r.elogio, () => set('elogio', true), () => set('elogio', false)),
    });
    if (r.elogio === true) {
      list.push({
        key: 'elogioDescricao', categoria: 'Alunos', pergunta: 'Descreva o elogio',
        canContinue: r.elogioDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.elogioDescricao} onChange={(e) => set('elogioDescricao', e.target.value.toUpperCase())}
          placeholder="O QUE FOI DITO E POR QUEM..." className="min-h-28 rounded-2xl text-base" />),
      });
    }

    // ===== Ocorrências
    list.push({
      key: 'ocorrencia', categoria: 'Ocorrências', pergunta: 'Houve alguma ocorrência fora da rotina?',
      canContinue: r.ocorrencia !== null,
      render: () => sim_nao(r.ocorrencia, () => set('ocorrencia', true), () => set('ocorrencia', false)),
    });
    if (r.ocorrencia === true) {
      list.push({
        key: 'ocorrenciaTipo', categoria: 'Ocorrências', pergunta: 'Tipo de ocorrência',
        canContinue: r.ocorrenciaTipo.trim().length >= 2,
        render: () => (<Input value={r.ocorrenciaTipo} onChange={(e) => set('ocorrenciaTipo', e.target.value.toUpperCase())}
          placeholder="EX: QUEDA DE ALUNO, BRIGA, FURTO..." className="h-14 rounded-2xl text-base" />),
      });
      list.push({
        key: 'ocorrenciaGravidade', categoria: 'Ocorrências', pergunta: 'Gravidade',
        canContinue: !!r.ocorrenciaGravidade,
        render: () => (<>
          <OptionCard emoji="🟢" label="Baixa" selected={r.ocorrenciaGravidade === 'BAIXA'} onClick={() => set('ocorrenciaGravidade', 'BAIXA')} />
          <OptionCard emoji="🟡" label="Média" selected={r.ocorrenciaGravidade === 'MÉDIA'} onClick={() => set('ocorrenciaGravidade', 'MÉDIA')} />
          <OptionCard emoji="🔴" label="Alta" selected={r.ocorrenciaGravidade === 'ALTA'} onClick={() => set('ocorrenciaGravidade', 'ALTA')} />
        </>),
      });
      list.push({
        key: 'ocorrenciaDescricao', categoria: 'Ocorrências', pergunta: 'Descrição objetiva',
        canContinue: r.ocorrenciaDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.ocorrenciaDescricao} onChange={(e) => set('ocorrenciaDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA O QUE ACONTECEU..." className="min-h-32 rounded-2xl text-base" />),
      });
      list.push({
        key: 'ocorrenciaAcao', categoria: 'Ocorrências', pergunta: 'Ação tomada',
        canContinue: r.ocorrenciaAcao.trim().length >= 3,
        render: () => (<Textarea value={r.ocorrenciaAcao} onChange={(e) => set('ocorrenciaAcao', e.target.value.toUpperCase())}
          placeholder="O QUE FOI FEITO..." className="min-h-28 rounded-2xl text-base" />),
      });
      list.push({
        key: 'ocorrenciaResolvida', categoria: 'Ocorrências', pergunta: 'A ocorrência foi resolvida?',
        canContinue: r.ocorrenciaResolvida !== null,
        render: () => sim_nao(r.ocorrenciaResolvida, () => set('ocorrenciaResolvida', true), () => set('ocorrenciaResolvida', false)),
      });
      if (r.ocorrenciaResolvida === false) {
        list.push({
          key: 'ocorrenciaPendencia', categoria: 'Ocorrências', pergunta: 'Descreva o que ficou pendente',
          canContinue: r.ocorrenciaPendencia.trim().length >= 3,
          render: () => (<Textarea value={r.ocorrenciaPendencia} onChange={(e) => set('ocorrenciaPendencia', e.target.value.toUpperCase())}
            placeholder="O QUE PRECISA SER RESOLVIDO..." className="min-h-28 rounded-2xl text-base" />),
        });
      }
    }

    // ===== Avaliação do turno
    list.push({
      key: 'padraoIron', categoria: 'Avaliação', pergunta: 'A operação transcorreu dentro do padrão EVO?',
      canContinue: r.padraoIron !== null,
      render: () => sim_nao(r.padraoIron, () => set('padraoIron', true), () => set('padraoIron', false)),
    });
    if (r.padraoIron === false) {
      list.push({
        key: 'foraPadraoDescricao', categoria: 'Avaliação', pergunta: 'O que saiu do padrão?',
        canContinue: r.foraPadraoDescricao.trim().length >= 3,
        render: () => (<Textarea value={r.foraPadraoDescricao} onChange={(e) => set('foraPadraoDescricao', e.target.value.toUpperCase())}
          placeholder="DESCREVA OBJETIVAMENTE..." className="min-h-28 rounded-2xl text-base" />),
      });
    }
    list.push({
      key: 'funcionouBem', categoria: 'Avaliação', pergunta: 'O que funcionou bem hoje?',
      canContinue: r.funcionouBem.trim().length >= 3,
      render: () => (<Textarea value={r.funcionouBem} onChange={(e) => set('funcionouBem', e.target.value.toUpperCase())}
        placeholder="DESTAQUES POSITIVOS DO TURNO..." className="min-h-28 rounded-2xl text-base" />),
    });
    list.push({
      key: 'notaGeral', categoria: 'Avaliação', pergunta: 'Nota geral do turno', apoio: '0 = péssimo · 5 = excelente',
      canContinue: r.notaGeral !== null,
      render: () => <ScaleButtons value={r.notaGeral} onChange={(n) => set('notaGeral', n)} />,
    });

    // ===== Fechamento (apenas se último turno)
    if (r.ultimoTurnoDia === true) {
      list.push({
        key: 'pontosAtencao', categoria: 'Fechamento do dia', pergunta: 'Pontos de atenção para amanhã',
        apoio: 'Opcional — pode deixar em branco',
        canContinue: true,
        render: () => (<Textarea value={r.pontosAtencao} onChange={(e) => set('pontosAtencao', e.target.value.toUpperCase())}
          placeholder="O QUE PRECISA SER OBSERVADO AMANHÃ..." className="min-h-28 rounded-2xl text-base" />),
      });
      list.push({
        key: 'pendenciasAbertas', categoria: 'Fechamento do dia', pergunta: 'Pendências abertas que precisam de resolução',
        apoio: 'Opcional — pode deixar em branco',
        canContinue: true,
        render: () => (<Textarea value={r.pendenciasAbertas} onChange={(e) => set('pendenciasAbertas', e.target.value.toUpperCase())}
          placeholder="LISTE AS PENDÊNCIAS..." className="min-h-28 rounded-2xl text-base" />),
      });
    }

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
          <p className="font-display-condensed text-xs uppercase tracking-[0.4em] opacity-80">EVO TRAINING CLUB</p>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight">
            Formulário<br />de Encerramento
          </h1>
          <p className="text-sm uppercase tracking-[0.2em] opacity-90">Gerente de Unidade</p>
          <p className="mx-auto max-w-xs text-base opacity-90">
            Preencha ao final do seu turno. Leva menos de 5 minutos.
          </p>
          <Button size="lg" onClick={() => { setR(initial); setStep(0); setStage('wizard'); }}
            className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-anamnese-royal shadow-lg hover:bg-white/90">
            Começar <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  // ========= REVIEW =========
  if (stage === 'review') {
    const items: { label: string; value: string }[] = [];
    const push = (label: string, value: string | null | undefined | number | boolean) => {
      if (value === null || value === undefined || value === '' || value === false) return;
      items.push({ label, value: typeof value === 'boolean' ? 'Sim' : String(value) });
    };
    push('Nome', r.nome);
    push('Unidade', r.unidade);
    push('Turno', r.turno);
    push('Último turno do dia', r.ultimoTurnoDia ? 'Sim' : 'Não');
    push('Limpeza', r.limpeza !== null ? `${r.limpeza}/5` : '');
    push('Equipamentos', r.equipamentos !== null ? `${r.equipamentos}/5` : '');
    push('Climatização', r.climatizacao !== null ? `${r.climatizacao}/5` : '');
    push('Organização', r.organizacao !== null ? `${r.organizacao}/5` : '');
    push('Infraestrutura', r.infraestrutura !== null ? `${r.infraestrutura}/5` : '');
    push('Todos compareceram?', r.todosCompareceram === false ? `Não — ${r.faltasAtrasos}` : (r.todosCompareceram ? 'Sim' : ''));
    push('Postura/atendimento', r.postura !== null ? `${r.postura}/5` : '');
    push('Proatividade', r.proatividade !== null ? `${r.proatividade}/5` : '');
    if (r.destaquePositivo) push('Destaque positivo', r.destaqueDescricao);
    if (r.feedbackCorretivo) push('Feedback corretivo', r.feedbackDescricao);
    if (r.reclamacao) {
      push('Reclamação', r.reclamacaoDescricao);
      push('Ação tomada', r.reclamacaoAcao);
      push('Resolvida?', r.reclamacaoResolvida ? 'Sim' : `Não — ${r.reclamacaoPendencia}`);
    }
    if (r.elogio) push('Elogio', r.elogioDescricao);
    if (r.ocorrencia) {
      push('Ocorrência', `${r.ocorrenciaTipo} (${r.ocorrenciaGravidade})`);
      push('Descrição', r.ocorrenciaDescricao);
      push('Ação tomada', r.ocorrenciaAcao);
      push('Ocorrência resolvida?', r.ocorrenciaResolvida ? 'Sim' : `Não — ${r.ocorrenciaPendencia}`);
    }
    push('Padrão EVO?', r.padraoIron ? 'Sim' : `Não — ${r.foraPadraoDescricao}`);
    push('Funcionou bem', r.funcionouBem);
    push('Nota geral', r.notaGeral !== null ? `${r.notaGeral}/5` : '');
    if (r.ultimoTurnoDia) {
      if (r.pontosAtencao) push('Pontos de atenção', r.pontosAtencao);
      if (r.pendenciasAbertas) push('Pendências abertas', r.pendenciasAbertas);
    }

    const handleSubmit = async () => {
      if (saving) return;
      setSaving(true);
      try {
        const respostaId = crypto.randomUUID();
        const { error } = await submitWithRetry(() => supabase
          .from('encerramento_coordenador_respostas')
          .insert({
            id: respostaId,
            nome: r.nome, unidade: r.unidade, turno: r.turno, ultimo_turno_dia: !!r.ultimoTurnoDia,
            limpeza_geral: r.limpeza, equipamentos_funcionando: r.equipamentos, climatizacao: r.climatizacao,
            organizacao_espaco: r.organizacao, infraestrutura: r.infraestrutura,
            todos_compareceram: r.todosCompareceram, faltas_atrasos: r.faltasAtrasos || null,
            postura_atendimento: r.postura, proatividade: r.proatividade,
            destaque_positivo: r.destaquePositivo, destaque_descricao: r.destaqueDescricao || null,
            feedback_corretivo: r.feedbackCorretivo, feedback_descricao: r.feedbackDescricao || null,
            reclamacao_aluno: r.reclamacao, reclamacao_descricao: r.reclamacaoDescricao || null,
            reclamacao_acao: r.reclamacaoAcao || null, reclamacao_resolvida: r.reclamacaoResolvida,
            reclamacao_pendencia: r.reclamacaoPendencia || null,
            elogio_aluno: r.elogio, elogio_descricao: r.elogioDescricao || null,
            teve_ocorrencia: r.ocorrencia, ocorrencia_tipo: r.ocorrenciaTipo || null,
            ocorrencia_gravidade: r.ocorrenciaGravidade || null,
            ocorrencia_descricao: r.ocorrenciaDescricao || null, ocorrencia_acao: r.ocorrenciaAcao || null,
            ocorrencia_resolvida: r.ocorrenciaResolvida, ocorrencia_pendencia: r.ocorrenciaPendencia || null,
            padrao_iron: r.padraoIron, fora_padrao_descricao: r.foraPadraoDescricao || null,
            funcionou_bem: r.funcionouBem || null, nota_geral: r.notaGeral,
            pontos_atencao: r.pontosAtencao || null, pendencias_abertas: r.pendenciasAbertas || null,
          }));

        if (error) {
          toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
          setSaving(false);
          return;
        }

        await submitFormularioPublico({
          tipo_formulario: 'coordenador_unidade',
          unidade: r.unidade,
          unidade_id: getUnidadeIdByValue(r.unidade),
          resposta_id: respostaId,
        });
        clearDraft('encerramento-coordenador');
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
                <div className="mt-1 text-sm text-anamnese-card-foreground whitespace-pre-wrap">{it.value || '—'}</div>
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

  // ========= DONE =========
  if (stage === 'done') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-anamnese-royal p-6 text-anamnese-royal-foreground">
        <div className="w-full max-w-md space-y-6 text-center">
          <CheckCircle2 className="mx-auto h-20 w-20" />
          <h1 className="font-display text-4xl font-extrabold uppercase leading-tight">Turno registrado</h1>
          <p className="text-base opacity-90">Bom descanso!</p>
          <Button size="lg" onClick={() => { setR(initial); setStep(0); setStage('intro'); }}
            className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-anamnese-royal shadow-lg hover:bg-white/90">
            <RefreshCw className="mr-2 h-5 w-5" /> Nova ficha
          </Button>
        </div>
      </div>
    );
  }

  // ========= WIZARD =========
  const total = steps.length;
  return (
    <StepShell
      categoria={current.categoria}
      pergunta={current.pergunta}
      apoio={current.apoio}
      stepNumber={safeStep + 1}
      totalSteps={total}
      canContinue={current.canContinue}
      onBack={() => { if (safeStep === 0) setStage('intro'); else setStep((s) => s - 1); }}
      onContinue={() => { if (isLast) setStage('review'); else setStep((s) => s + 1); }}
      continueLabel={isLast ? 'Revisar' : 'Continuar'}
    >
      {current.render()}
    </StepShell>
  );
}
