import { useMemo, useState } from 'react';
import { ArrowRight, Loader2, RefreshCw, CheckCircle2, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StepShell } from '@/components/anamnese/StepShell';
import { OptionCard } from '@/components/anamnese/OptionCard';
import { submitFormularioPublico } from '@/lib/notifyFormularioGrupo';
import { useFormDraft, submitWithRetry, clearDraft } from '@/lib/formDraft';
import { UNIDADES_FORMULARIO, type UnidadeFormularioValue, getUnidadeIdByValue, getUnidadeLabelByValue } from '@/lib/formularioUnidades';

const DRAFT_KEY = 'encerramento-tecnico';

type Stage = 'intro' | 'wizard' | 'review' | 'done';
type SimNao = boolean | null;

interface Desvio {
  profissional: string;
  desvio: string;
  correcao: string;
  situacao: 'RESOLVIDA' | 'PENDENTE' | '';
  responsavel: string;
  prazo: string;
}
interface Feedback {
  profissional: string;
  motivo: string;
  orientacao: string;
}
interface Destaque {
  profissional: string;
  comportamento: string;
}
interface EscalaOcorrencia {
  profissional: string;
  tipo: 'FALTA' | 'ATRASO' | 'SAÍDA ANTECIPADA' | '';
  cobertura: SimNao;
  cobertura_responsavel: string;
  impacto: string;
}
interface AtendimentoTreinador {
  treinador: string;
  quantidade: string;
}
interface OcorrenciaAluno {
  tipo: 'RECLAMAÇÃO' | 'DOR' | 'LESÃO' | 'CONFLITO' | 'OUTRO FEEDBACK' | '';
  aluno: string;
  descricao: string;
  profissional: string;
  medida: string;
  gerente_comunicado: SimNao;
}
interface Pendencia {
  pendencia: string;
  responsavel: string;
  prazo: string;
  acompanhamento: string;
}

interface Respostas {
  unidade: '' | UnidadeFormularioValue;
  coordenador: string;
  data: string;

  alinhamentoManha: SimNao;
  alinhamentoManhaMotivo: string;
  alinhamentoNoite: SimNao;
  alinhamentoNoiteMotivo: string;
  pontos: string[];
  pontosDetalhe: string;

  ronda: '' | 'INTEGRALMENTE' | 'PARCIALMENTE' | 'NÃO';
  rondaMotivo: string;
  teveDesvio: SimNao;
  desvios: Desvio[];
  teveFeedback: SimNao;
  feedbacks: Feedback[];
  teveDestaque: SimNao;
  destaques: Destaque[];

  escalaCumprida: SimNao;
  escalaOcorrencias: EscalaOcorrencia[];
  distribuicao: '' | 'SIM' | 'PARCIALMENTE' | 'NÃO';
  distribuicaoProblema: string;
  distribuicaoAjuste: string;
  alunosTarde: string;
  atendimentos: AtendimentoTreinador[];
  expAgendadas: string;
  expRealizadas: string;
  expAusentes: string;

  teveOcorrenciaAluno: SimNao;
  ocorrenciasAluno: OcorrenciaAluno[];

  salaOk: '' | 'SIM' | 'PARCIALMENTE' | 'NÃO';
  salaProblema: string;
  salaProvidencia: string;
  teveEstrutura: SimNao;
  estruturaProblema: string;
  estruturaImpacto: string;
  estruturaProvidencia: string;
  estruturaGerente: SimNao;

  tevePendencia: SimNao;
  pendencias: Pendencia[];
  prioridade: '' | 'NENHUMA' | 'ACOMPANHAR PROFISSIONAL' | 'ACOMPANHAR ALUNO' | 'CORRIGIR PADRÃO TÉCNICO' | 'AJUSTAR ESCALA OU DISTRIBUIÇÃO' | 'RESOLVER PROBLEMA ESTRUTURAL' | 'OUTRO';
  prioridadeDetalhe: string;
}

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const initial: Respostas = {
  unidade: '',
  coordenador: '',
  data: hoje(),
  alinhamentoManha: null,
  alinhamentoManhaMotivo: '',
  alinhamentoNoite: null,
  alinhamentoNoiteMotivo: '',
  pontos: [],
  pontosDetalhe: '',
  ronda: '',
  rondaMotivo: '',
  teveDesvio: null,
  desvios: [],
  teveFeedback: null,
  feedbacks: [],
  teveDestaque: null,
  destaques: [],
  escalaCumprida: null,
  escalaOcorrencias: [],
  distribuicao: '',
  distribuicaoProblema: '',
  distribuicaoAjuste: '',
  alunosTarde: '',
  atendimentos: [],
  expAgendadas: '',
  expRealizadas: '',
  expAusentes: '',
  teveOcorrenciaAluno: null,
  ocorrenciasAluno: [],
  salaOk: '',
  salaProblema: '',
  salaProvidencia: '',
  teveEstrutura: null,
  estruturaProblema: '',
  estruturaImpacto: '',
  estruturaProvidencia: '',
  estruturaGerente: null,
  tevePendencia: null,
  pendencias: [],
  prioridade: '',
  prioridadeDetalhe: '',
};

const PONTO_NENHUM = 'NENHUMA PENDÊNCIA';
const PONTOS_OPCOES = [
  PONTO_NENHUM,
  'ALUNO QUE EXIGE ATENÇÃO',
  'CORREÇÃO TÉCNICA',
  'CONDUTA DA EQUIPE',
  'FALTA OU ATRASO',
  'ESTRUTURA OU EQUIPAMENTO',
  'OUTRO',
];

const GENERICAS = ['todos', 'todos show', 'equipe toda', 'tudo certo', 'muito bom', 'todas', 'geral'];
const isGenerica = (s: string) => GENERICAS.includes(s.trim().toLowerCase());

const up = (s: string) => s.toUpperCase();
const filled = (s: string) => s.trim().length > 0;
const intOf = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function SimNaoCards({ value, onChange, simLabel = 'Sim', naoLabel = 'Não' }: { value: SimNao; onChange: (v: boolean) => void; simLabel?: string; naoLabel?: string }) {
  return (
    <>
      <OptionCard emoji="✅" label={simLabel} selected={value === true} onClick={() => onChange(true)} />
      <OptionCard emoji="🚫" label={naoLabel} selected={value === false} onClick={() => onChange(false)} />
    </>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-anamnese-card-foreground">{label}</p>
      {children}
    </div>
  );
}

function ListaBloco({ titulo, itens, onAdd, onRemove, addLabel, children }: {
  titulo: string;
  itens: unknown[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  addLabel: string;
  children: (i: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {itens.map((_, i) => (
        <div key={i} className="rounded-2xl border-2 border-anamnese-border bg-anamnese-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-anamnese-category">{titulo} {i + 1}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(i)} className="h-8 px-2 text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {children(i)}
        </div>
      ))}
      <Button type="button" variant="outline" onClick={onAdd} className="h-12 w-full rounded-2xl">
        <Plus className="mr-2 h-4 w-4" /> {addLabel}
      </Button>
    </div>
  );
}

function Alerta({ texto }: { texto: string }) {
  return (
    <div className="flex gap-2 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span>{texto}</span>
    </div>
  );
}

export default function EncerramentoTecnico() {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('intro');
  const [step, setStep] = useState(0);
  const [r, setR] = useState<Respostas>(initial);
  const [saving, setSaving] = useState(false);
  const [substituindo, setSubstituindo] = useState<string | null>(null);
  const [confirmarSubstituicao, setConfirmarSubstituicao] = useState(false);

  useFormDraft<Respostas>({
    key: DRAFT_KEY,
    data: r,
    step,
    stage,
    enabled: stage !== 'done',
    onRestore: (d) => {
      setR({ ...initial, ...d.data });
      setStep(d.step);
      setStage(d.stage as Stage);
    },
  });

  const set = <K extends keyof Respostas>(k: K, v: Respostas[K]) => setR((prev) => ({ ...prev, [k]: v }));
  const setItem = <T,>(k: keyof Respostas, i: number, patch: Partial<T>) =>
    setR((prev) => {
      const arr = [...(prev[k] as unknown as T[])];
      arr[i] = { ...arr[i], ...patch };
      return { ...prev, [k]: arr } as Respostas;
    });
  const removeItem = (k: keyof Respostas, i: number) =>
    setR((prev) => ({ ...prev, [k]: (prev[k] as unknown[]).filter((_, idx) => idx !== i) } as Respostas));
  const addItem = <T,>(k: keyof Respostas, item: T) =>
    setR((prev) => ({ ...prev, [k]: [...(prev[k] as unknown as T[]), item] } as Respostas));

  const togglePonto = (p: string) => {
    setR((prev) => {
      if (p === PONTO_NENHUM) return { ...prev, pontos: prev.pontos.includes(p) ? [] : [PONTO_NENHUM], pontosDetalhe: '' };
      const semNenhum = prev.pontos.filter((x) => x !== PONTO_NENHUM);
      const next = semNenhum.includes(p) ? semNenhum.filter((x) => x !== p) : [...semNenhum, p];
      return { ...prev, pontos: next, pontosDetalhe: next.length ? prev.pontosDetalhe : '' };
    });
  };

  const expA = intOf(r.expAgendadas);
  const expR = intOf(r.expRealizadas);
  const expX = intOf(r.expAusentes);
  const expErro =
    expA !== null && expR !== null && expX !== null
      ? expR > expA
        ? 'Realizadas não podem passar das agendadas.'
        : expX > expA
          ? 'Ausentes não podem passar das agendadas.'
          : expR + expX > expA
            ? 'Realizadas + ausentes não podem passar das agendadas.'
            : null
      : null;

  const desviosOk =
    r.teveDesvio === false ||
    (r.desvios.length > 0 &&
      r.desvios.every(
        (d) =>
          filled(d.profissional) &&
          filled(d.desvio) &&
          filled(d.correcao) &&
          d.situacao !== '' &&
          (d.situacao === 'RESOLVIDA' || (filled(d.responsavel) && filled(d.prazo))),
      ));
  const feedbacksOk =
    r.teveFeedback === false ||
    (r.feedbacks.length > 0 && r.feedbacks.every((f) => filled(f.profissional) && filled(f.motivo) && filled(f.orientacao)));
  const destaquesOk =
    r.teveDestaque === false ||
    (r.destaques.length > 0 &&
      r.destaques.every(
        (d) => filled(d.profissional) && !isGenerica(d.profissional) && filled(d.comportamento) && !isGenerica(d.comportamento),
      ));
  const escalaOk =
    r.escalaCumprida === true ||
    (r.escalaOcorrencias.length > 0 &&
      r.escalaOcorrencias.every(
        (o) =>
          filled(o.profissional) &&
          o.tipo !== '' &&
          o.cobertura !== null &&
          (o.cobertura === false || filled(o.cobertura_responsavel)) &&
          filled(o.impacto),
      ));
  const alunosOk =
    r.teveOcorrenciaAluno === false ||
    (r.ocorrenciasAluno.length > 0 &&
      r.ocorrenciasAluno.every(
        (o) => o.tipo !== '' && filled(o.aluno) && filled(o.descricao) && filled(o.profissional) && filled(o.medida) && o.gerente_comunicado !== null,
      ));
  const pendenciasOk =
    r.tevePendencia === false ||
    (r.pendencias.length > 0 &&
      r.pendencias.every((p) => filled(p.pendencia) && filled(p.responsavel) && filled(p.prazo) && filled(p.acompanhamento)));

  const steps = useMemo(() => {
    const list: { categoria: string; pergunta: string; apoio?: string; canContinue: boolean; render: () => React.ReactNode }[] = [];

    // 1. Identificação
    list.push({
      categoria: 'Identificação',
      pergunta: 'Quem está registrando o encerramento?',
      canContinue: r.unidade !== '' && filled(r.coordenador) && filled(r.data),
      render: () => (
        <div className="space-y-4">
          <Campo label="Unidade">
            <div className="space-y-3">
              {UNIDADES_FORMULARIO.map((u) => (
                <OptionCard key={u.value} emoji="📍" label={`EVO ${u.label}`} selected={r.unidade === u.value} onClick={() => set('unidade', u.value)} />
              ))}
            </div>
          </Campo>
          <Campo label="Coordenador Geral Técnico">
            <Input value={r.coordenador} onChange={(e) => set('coordenador', up(e.target.value))} placeholder="SEU NOME" className="h-12 rounded-xl" />
          </Campo>
          <Campo label="Data">
            <Input type="date" value={r.data} onChange={(e) => set('data', e.target.value)} className="h-12 rounded-xl" />
          </Campo>
        </div>
      ),
    });

    // 2. Alinhamento dos turnos
    list.push({
      categoria: 'Alinhamento dos turnos',
      pergunta: 'Houve alinhamento com a manhã e com a noite?',
      canContinue:
        r.alinhamentoManha !== null &&
        (r.alinhamentoManha === true || filled(r.alinhamentoManhaMotivo)) &&
        r.alinhamentoNoite !== null &&
        (r.alinhamentoNoite === true || filled(r.alinhamentoNoiteMotivo)) &&
        r.pontos.length > 0 &&
        (r.pontos.includes(PONTO_NENHUM) || filled(r.pontosDetalhe)),
      render: () => (
        <div className="space-y-5">
          <Campo label="Alinhamento com a manhã">
            <div className="space-y-3">
              <SimNaoCards value={r.alinhamentoManha} onChange={(v) => set('alinhamentoManha', v)} />
              {r.alinhamentoManha === false && (
                <Textarea value={r.alinhamentoManhaMotivo} onChange={(e) => set('alinhamentoManhaMotivo', e.target.value)} placeholder="Motivo" className="rounded-xl" />
              )}
            </div>
          </Campo>
          <Campo label="Alinhamento com a noite">
            <div className="space-y-3">
              <SimNaoCards value={r.alinhamentoNoite} onChange={(v) => set('alinhamentoNoite', v)} />
              {r.alinhamentoNoite === false && (
                <Textarea value={r.alinhamentoNoiteMotivo} onChange={(e) => set('alinhamentoNoiteMotivo', e.target.value)} placeholder="Motivo" className="rounded-xl" />
              )}
            </div>
          </Campo>
          <Campo label="Pontos alinhados (pode marcar vários)">
            <div className="space-y-3">
              {PONTOS_OPCOES.map((p) => (
                <OptionCard key={p} emoji="📌" label={p} selected={r.pontos.includes(p)} onClick={() => togglePonto(p)} />
              ))}
              {r.pontos.length > 0 && !r.pontos.includes(PONTO_NENHUM) && (
                <Textarea value={r.pontosDetalhe} onChange={(e) => set('pontosDetalhe', e.target.value)} placeholder="Descreva brevemente os pontos alinhados" className="rounded-xl" />
              )}
            </div>
          </Campo>
        </div>
      ),
    });

    // 3. Supervisão técnica
    list.push({
      categoria: 'Supervisão técnica',
      pergunta: 'Como foi a supervisão no salão?',
      canContinue:
        r.ronda !== '' &&
        (r.ronda === 'INTEGRALMENTE' || filled(r.rondaMotivo)) &&
        r.teveDesvio !== null &&
        desviosOk &&
        r.teveFeedback !== null &&
        feedbacksOk &&
        r.teveDestaque !== null &&
        destaquesOk,
      render: () => (
        <div className="space-y-5">
          <Campo label="Ronda técnica no salão">
            <div className="space-y-3">
              <OptionCard emoji="🔍" label="Sim, integralmente" selected={r.ronda === 'INTEGRALMENTE'} onClick={() => set('ronda', 'INTEGRALMENTE')} />
              <OptionCard emoji="🕗" label="Parcialmente" selected={r.ronda === 'PARCIALMENTE'} onClick={() => set('ronda', 'PARCIALMENTE')} />
              <OptionCard emoji="🚫" label="Não" selected={r.ronda === 'NÃO'} onClick={() => set('ronda', 'NÃO')} />
              {(r.ronda === 'PARCIALMENTE' || r.ronda === 'NÃO') && (
                <Textarea value={r.rondaMotivo} onChange={(e) => set('rondaMotivo', e.target.value)} placeholder="Motivo" className="rounded-xl" />
              )}
            </div>
          </Campo>

          <Campo label="Desvio técnico ou de conduta">
            <div className="space-y-3">
              <SimNaoCards value={r.teveDesvio} onChange={(v) => { set('teveDesvio', v); if (v && r.desvios.length === 0) addItem<Desvio>('desvios', { profissional: '', desvio: '', correcao: '', situacao: '', responsavel: '', prazo: '' }); if (!v) set('desvios', []); }} naoLabel="Não houve" simLabel="Sim, houve" />
              {r.teveDesvio === true && (
                <ListaBloco
                  titulo="Desvio"
                  itens={r.desvios}
                  addLabel="Adicionar outro desvio"
                  onAdd={() => addItem<Desvio>('desvios', { profissional: '', desvio: '', correcao: '', situacao: '', responsavel: '', prazo: '' })}
                  onRemove={(i) => removeItem('desvios', i)}
                >
                  {(i) => (
                    <div className="space-y-2">
                      <Input value={r.desvios[i].profissional} onChange={(e) => setItem<Desvio>('desvios', i, { profissional: up(e.target.value) })} placeholder="PROFISSIONAL ENVOLVIDO" className="h-11 rounded-xl" />
                      <Textarea value={r.desvios[i].desvio} onChange={(e) => setItem<Desvio>('desvios', i, { desvio: e.target.value })} placeholder="Desvio identificado" className="rounded-xl" />
                      <Textarea value={r.desvios[i].correcao} onChange={(e) => setItem<Desvio>('desvios', i, { correcao: e.target.value })} placeholder="Correção aplicada" className="rounded-xl" />
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant={r.desvios[i].situacao === 'RESOLVIDA' ? 'default' : 'outline'} className="h-11 rounded-xl" onClick={() => setItem<Desvio>('desvios', i, { situacao: 'RESOLVIDA' })}>Resolvida</Button>
                        <Button type="button" variant={r.desvios[i].situacao === 'PENDENTE' ? 'default' : 'outline'} className="h-11 rounded-xl" onClick={() => setItem<Desvio>('desvios', i, { situacao: 'PENDENTE' })}>Pendente</Button>
                      </div>
                      {r.desvios[i].situacao === 'PENDENTE' && (
                        <>
                          <Input value={r.desvios[i].responsavel} onChange={(e) => setItem<Desvio>('desvios', i, { responsavel: up(e.target.value) })} placeholder="RESPONSÁVEL PELO ACOMPANHAMENTO" className="h-11 rounded-xl" />
                          <Input type="date" value={r.desvios[i].prazo} onChange={(e) => setItem<Desvio>('desvios', i, { prazo: e.target.value })} className="h-11 rounded-xl" />
                        </>
                      )}
                    </div>
                  )}
                </ListaBloco>
              )}
            </div>
          </Campo>

          <Campo label="Feedback corretivo aplicado">
            <div className="space-y-3">
              <SimNaoCards value={r.teveFeedback} onChange={(v) => { set('teveFeedback', v); if (v && r.feedbacks.length === 0) addItem<Feedback>('feedbacks', { profissional: '', motivo: '', orientacao: '' }); if (!v) set('feedbacks', []); }} naoLabel="Não apliquei" simLabel="Sim, apliquei" />
              {r.teveFeedback === true && (
                <ListaBloco
                  titulo="Feedback"
                  itens={r.feedbacks}
                  addLabel="Adicionar outro feedback"
                  onAdd={() => addItem<Feedback>('feedbacks', { profissional: '', motivo: '', orientacao: '' })}
                  onRemove={(i) => removeItem('feedbacks', i)}
                >
                  {(i) => (
                    <div className="space-y-2">
                      <Input value={r.feedbacks[i].profissional} onChange={(e) => setItem<Feedback>('feedbacks', i, { profissional: up(e.target.value) })} placeholder="PROFISSIONAL" className="h-11 rounded-xl" />
                      <Textarea value={r.feedbacks[i].motivo} onChange={(e) => setItem<Feedback>('feedbacks', i, { motivo: e.target.value })} placeholder="Motivo" className="rounded-xl" />
                      <Textarea value={r.feedbacks[i].orientacao} onChange={(e) => setItem<Feedback>('feedbacks', i, { orientacao: e.target.value })} placeholder="Orientação aplicada" className="rounded-xl" />
                    </div>
                  )}
                </ListaBloco>
              )}
            </div>
          </Campo>

          <Campo label="Destaque positivo">
            <div className="space-y-3">
              <SimNaoCards value={r.teveDestaque} onChange={(v) => { set('teveDestaque', v); if (v && r.destaques.length === 0) addItem<Destaque>('destaques', { profissional: '', comportamento: '' }); if (!v) set('destaques', []); }} naoLabel="Não houve" simLabel="Sim, houve" />
              {r.teveDestaque === true && (
                <ListaBloco
                  titulo="Destaque"
                  itens={r.destaques}
                  addLabel="Adicionar outro destaque"
                  onAdd={() => addItem<Destaque>('destaques', { profissional: '', comportamento: '' })}
                  onRemove={(i) => removeItem('destaques', i)}
                >
                  {(i) => (
                    <div className="space-y-2">
                      <Input value={r.destaques[i].profissional} onChange={(e) => setItem<Destaque>('destaques', i, { profissional: up(e.target.value) })} placeholder="PROFISSIONAL (NOME)" className="h-11 rounded-xl" />
                      <Textarea value={r.destaques[i].comportamento} onChange={(e) => setItem<Destaque>('destaques', i, { comportamento: e.target.value })} placeholder="Comportamento observado" className="rounded-xl" />
                      {(isGenerica(r.destaques[i].profissional) || isGenerica(r.destaques[i].comportamento)) && (
                        <Alerta texto="Informe o nome do profissional e o comportamento específico — respostas genéricas não são aceitas." />
                      )}
                    </div>
                  )}
                </ListaBloco>
              )}
            </div>
          </Campo>
        </div>
      ),
    });

    // 4. Equipe e operação
    list.push({
      categoria: 'Equipe e operação',
      pergunta: 'Como foi a operação do turno da tarde?',
      canContinue:
        r.escalaCumprida !== null &&
        escalaOk &&
        r.distribuicao !== '' &&
        (r.distribuicao === 'SIM' || (filled(r.distribuicaoProblema) && filled(r.distribuicaoAjuste))) &&
        intOf(r.alunosTarde) !== null &&
        expA !== null &&
        expR !== null &&
        expX !== null &&
        !expErro &&
        r.atendimentos.every((a) => filled(a.treinador) && intOf(a.quantidade) !== null),
      render: () => (
        <div className="space-y-5">
          <Campo label="Escala cumprida integralmente?">
            <div className="space-y-3">
              <SimNaoCards value={r.escalaCumprida} onChange={(v) => { set('escalaCumprida', v); if (!v && r.escalaOcorrencias.length === 0) addItem<EscalaOcorrencia>('escalaOcorrencias', { profissional: '', tipo: '', cobertura: null, cobertura_responsavel: '', impacto: '' }); if (v) set('escalaOcorrencias', []); }} />
              {r.escalaCumprida === false && (
                <ListaBloco
                  titulo="Ocorrência"
                  itens={r.escalaOcorrencias}
                  addLabel="Adicionar outra ocorrência"
                  onAdd={() => addItem<EscalaOcorrencia>('escalaOcorrencias', { profissional: '', tipo: '', cobertura: null, cobertura_responsavel: '', impacto: '' })}
                  onRemove={(i) => removeItem('escalaOcorrencias', i)}
                >
                  {(i) => (
                    <div className="space-y-2">
                      <Input value={r.escalaOcorrencias[i].profissional} onChange={(e) => setItem<EscalaOcorrencia>('escalaOcorrencias', i, { profissional: up(e.target.value) })} placeholder="PROFISSIONAL" className="h-11 rounded-xl" />
                      <div className="grid grid-cols-3 gap-2">
                        {(['FALTA', 'ATRASO', 'SAÍDA ANTECIPADA'] as const).map((t) => (
                          <Button key={t} type="button" variant={r.escalaOcorrencias[i].tipo === t ? 'default' : 'outline'} className="h-11 rounded-xl text-xs" onClick={() => setItem<EscalaOcorrencia>('escalaOcorrencias', i, { tipo: t })}>{t}</Button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant={r.escalaOcorrencias[i].cobertura === true ? 'default' : 'outline'} className="h-11 rounded-xl" onClick={() => setItem<EscalaOcorrencia>('escalaOcorrencias', i, { cobertura: true })}>Houve cobertura</Button>
                        <Button type="button" variant={r.escalaOcorrencias[i].cobertura === false ? 'default' : 'outline'} className="h-11 rounded-xl" onClick={() => setItem<EscalaOcorrencia>('escalaOcorrencias', i, { cobertura: false, cobertura_responsavel: '' })}>Sem cobertura</Button>
                      </div>
                      {r.escalaOcorrencias[i].cobertura === true && (
                        <Input value={r.escalaOcorrencias[i].cobertura_responsavel} onChange={(e) => setItem<EscalaOcorrencia>('escalaOcorrencias', i, { cobertura_responsavel: up(e.target.value) })} placeholder="RESPONSÁVEL PELA COBERTURA" className="h-11 rounded-xl" />
                      )}
                      <Textarea value={r.escalaOcorrencias[i].impacto} onChange={(e) => setItem<EscalaOcorrencia>('escalaOcorrencias', i, { impacto: e.target.value })} placeholder="Impacto no atendimento" className="rounded-xl" />
                    </div>
                  )}
                </ListaBloco>
              )}
            </div>
          </Campo>

          <Campo label="Distribuição dos alunos entre os treinadores adequada?">
            <div className="space-y-3">
              <OptionCard emoji="⚖️" label="Sim" selected={r.distribuicao === 'SIM'} onClick={() => set('distribuicao', 'SIM')} />
              <OptionCard emoji="🟡" label="Parcialmente" selected={r.distribuicao === 'PARCIALMENTE'} onClick={() => set('distribuicao', 'PARCIALMENTE')} />
              <OptionCard emoji="🚫" label="Não" selected={r.distribuicao === 'NÃO'} onClick={() => set('distribuicao', 'NÃO')} />
              {(r.distribuicao === 'PARCIALMENTE' || r.distribuicao === 'NÃO') && (
                <>
                  <Textarea value={r.distribuicaoProblema} onChange={(e) => set('distribuicaoProblema', e.target.value)} placeholder="Problema identificado" className="rounded-xl" />
                  <Textarea value={r.distribuicaoAjuste} onChange={(e) => set('distribuicaoAjuste', e.target.value)} placeholder="Ajuste realizado" className="rounded-xl" />
                </>
              )}
            </div>
          </Campo>

          <Campo label="Alunos atendidos no turno da tarde">
            <Input type="number" min={0} inputMode="numeric" value={r.alunosTarde} onChange={(e) => set('alunosTarde', e.target.value)} placeholder="0" className="h-12 rounded-xl" />
          </Campo>

          <Campo label="Atendimentos por treinador">
            <ListaBloco
              titulo="Treinador"
              itens={r.atendimentos}
              addLabel="Adicionar treinador"
              onAdd={() => addItem<AtendimentoTreinador>('atendimentos', { treinador: '', quantidade: '' })}
              onRemove={(i) => removeItem('atendimentos', i)}
            >
              {(i) => (
                <div className="grid grid-cols-3 gap-2">
                  <Input className="col-span-2 h-11 rounded-xl" value={r.atendimentos[i].treinador} onChange={(e) => setItem<AtendimentoTreinador>('atendimentos', i, { treinador: up(e.target.value) })} placeholder="TREINADOR" />
                  <Input className="h-11 rounded-xl" type="number" min={0} value={r.atendimentos[i].quantidade} onChange={(e) => setItem<AtendimentoTreinador>('atendimentos', i, { quantidade: e.target.value })} placeholder="Qtd" />
                </div>
              )}
            </ListaBloco>
          </Campo>

          <Campo label="Experimentais do turno da tarde">
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" min={0} value={r.expAgendadas} onChange={(e) => set('expAgendadas', e.target.value)} placeholder="Agendadas" className="h-11 rounded-xl" />
              <Input type="number" min={0} value={r.expRealizadas} onChange={(e) => set('expRealizadas', e.target.value)} placeholder="Realizadas" className="h-11 rounded-xl" />
              <Input type="number" min={0} value={r.expAusentes} onChange={(e) => set('expAusentes', e.target.value)} placeholder="Ausentes" className="h-11 rounded-xl" />
            </div>
            {expErro && <div className="pt-2"><Alerta texto={expErro} /></div>}
          </Campo>
        </div>
      ),
    });

    // 5. Experiência do aluno
    const alertaAluno = r.ocorrenciasAluno.some((o) => o.tipo === 'LESÃO' || o.tipo === 'CONFLITO');
    list.push({
      categoria: 'Experiência do aluno',
      pergunta: 'Houve reclamação, dor, lesão, conflito ou outro feedback?',
      canContinue: r.teveOcorrenciaAluno !== null && alunosOk,
      render: () => (
        <div className="space-y-3">
          <SimNaoCards value={r.teveOcorrenciaAluno} onChange={(v) => { set('teveOcorrenciaAluno', v); if (v && r.ocorrenciasAluno.length === 0) addItem<OcorrenciaAluno>('ocorrenciasAluno', { tipo: '', aluno: '', descricao: '', profissional: '', medida: '', gerente_comunicado: null }); if (!v) set('ocorrenciasAluno', []); }} naoLabel="Não houve" simLabel="Sim, houve" />
          {alertaAluno && <Alerta texto="Comunique imediatamente o Gerente de Unidade." />}
          {r.teveOcorrenciaAluno === true && (
            <ListaBloco
              titulo="Registro"
              itens={r.ocorrenciasAluno}
              addLabel="Adicionar outro registro"
              onAdd={() => addItem<OcorrenciaAluno>('ocorrenciasAluno', { tipo: '', aluno: '', descricao: '', profissional: '', medida: '', gerente_comunicado: null })}
              onRemove={(i) => removeItem('ocorrenciasAluno', i)}
            >
              {(i) => (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {(['RECLAMAÇÃO', 'DOR', 'LESÃO', 'CONFLITO', 'OUTRO FEEDBACK'] as const).map((t) => (
                      <Button key={t} type="button" variant={r.ocorrenciasAluno[i].tipo === t ? 'default' : 'outline'} className="h-11 rounded-xl text-xs" onClick={() => setItem<OcorrenciaAluno>('ocorrenciasAluno', i, { tipo: t })}>{t}</Button>
                    ))}
                  </div>
                  <Input value={r.ocorrenciasAluno[i].aluno} onChange={(e) => setItem<OcorrenciaAluno>('ocorrenciasAluno', i, { aluno: up(e.target.value) })} placeholder="NOME DO ALUNO" className="h-11 rounded-xl" />
                  <Textarea value={r.ocorrenciasAluno[i].descricao} onChange={(e) => setItem<OcorrenciaAluno>('ocorrenciasAluno', i, { descricao: e.target.value })} placeholder="Descrição objetiva" className="rounded-xl" />
                  <Input value={r.ocorrenciasAluno[i].profissional} onChange={(e) => setItem<OcorrenciaAluno>('ocorrenciasAluno', i, { profissional: up(e.target.value) })} placeholder="PROFISSIONAL ENVOLVIDO" className="h-11 rounded-xl" />
                  <Textarea value={r.ocorrenciasAluno[i].medida} onChange={(e) => setItem<OcorrenciaAluno>('ocorrenciasAluno', i, { medida: e.target.value })} placeholder="Medida adotada" className="rounded-xl" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant={r.ocorrenciasAluno[i].gerente_comunicado === true ? 'default' : 'outline'} className="h-11 rounded-xl" onClick={() => setItem<OcorrenciaAluno>('ocorrenciasAluno', i, { gerente_comunicado: true })}>Gerente comunicado</Button>
                    <Button type="button" variant={r.ocorrenciasAluno[i].gerente_comunicado === false ? 'default' : 'outline'} className="h-11 rounded-xl" onClick={() => setItem<OcorrenciaAluno>('ocorrenciasAluno', i, { gerente_comunicado: false })}>Não comunicado</Button>
                  </div>
                </div>
              )}
            </ListaBloco>
          )}
        </div>
      ),
    });

    // 6. Organização e segurança
    list.push({
      categoria: 'Organização e segurança',
      pergunta: 'A sala ficou organizada e segura?',
      canContinue:
        r.salaOk !== '' &&
        (r.salaOk === 'SIM' || (filled(r.salaProblema) && filled(r.salaProvidencia))) &&
        r.teveEstrutura !== null &&
        (r.teveEstrutura === false ||
          (filled(r.estruturaProblema) && filled(r.estruturaImpacto) && filled(r.estruturaProvidencia) && r.estruturaGerente !== null)),
      render: () => (
        <div className="space-y-5">
          <Campo label="Sala organizada e segura?">
            <div className="space-y-3">
              <OptionCard emoji="🧼" label="Sim" selected={r.salaOk === 'SIM'} onClick={() => set('salaOk', 'SIM')} />
              <OptionCard emoji="🟡" label="Parcialmente" selected={r.salaOk === 'PARCIALMENTE'} onClick={() => set('salaOk', 'PARCIALMENTE')} />
              <OptionCard emoji="🚫" label="Não" selected={r.salaOk === 'NÃO'} onClick={() => set('salaOk', 'NÃO')} />
              {(r.salaOk === 'PARCIALMENTE' || r.salaOk === 'NÃO') && (
                <>
                  <Textarea value={r.salaProblema} onChange={(e) => set('salaProblema', e.target.value)} placeholder="Problema identificado" className="rounded-xl" />
                  <Textarea value={r.salaProvidencia} onChange={(e) => set('salaProvidencia', e.target.value)} placeholder="Providência adotada" className="rounded-xl" />
                </>
              )}
            </div>
          </Campo>
          <Campo label="Problema de estrutura ou equipamento?">
            <div className="space-y-3">
              <SimNaoCards value={r.teveEstrutura} onChange={(v) => set('teveEstrutura', v)} naoLabel="Não houve" simLabel="Sim, houve" />
              {r.teveEstrutura === true && (
                <>
                  <Textarea value={r.estruturaProblema} onChange={(e) => set('estruturaProblema', e.target.value)} placeholder="Qual o problema" className="rounded-xl" />
                  <Textarea value={r.estruturaImpacto} onChange={(e) => set('estruturaImpacto', e.target.value)} placeholder="Impacto na operação" className="rounded-xl" />
                  <Textarea value={r.estruturaProvidencia} onChange={(e) => set('estruturaProvidencia', e.target.value)} placeholder="Providência adotada" className="rounded-xl" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant={r.estruturaGerente === true ? 'default' : 'outline'} className="h-11 rounded-xl" onClick={() => set('estruturaGerente', true)}>Gerente comunicado</Button>
                    <Button type="button" variant={r.estruturaGerente === false ? 'default' : 'outline'} className="h-11 rounded-xl" onClick={() => set('estruturaGerente', false)}>Não comunicado</Button>
                  </div>
                  <Alerta texto="Se houver risco à segurança, comunique imediatamente o Gerente de Unidade." />
                </>
              )}
            </div>
          </Campo>
        </div>
      ),
    });

    // 7. Pendências e prioridade
    list.push({
      categoria: 'Pendências e prioridade',
      pergunta: 'O que fica para o próximo dia?',
      canContinue:
        r.tevePendencia !== null &&
        pendenciasOk &&
        r.prioridade !== '' &&
        (r.prioridade === 'NENHUMA' || filled(r.prioridadeDetalhe)),
      render: () => (
        <div className="space-y-5">
          <Campo label="Pendência para o próximo turno ou dia?">
            <div className="space-y-3">
              <SimNaoCards value={r.tevePendencia} onChange={(v) => { set('tevePendencia', v); if (v && r.pendencias.length === 0) addItem<Pendencia>('pendencias', { pendencia: '', responsavel: '', prazo: '', acompanhamento: '' }); if (!v) set('pendencias', []); }} naoLabel="Nenhuma" simLabel="Sim, há" />
              {r.tevePendencia === true && (
                <ListaBloco
                  titulo="Pendência"
                  itens={r.pendencias}
                  addLabel="Adicionar outra pendência"
                  onAdd={() => addItem<Pendencia>('pendencias', { pendencia: '', responsavel: '', prazo: '', acompanhamento: '' })}
                  onRemove={(i) => removeItem('pendencias', i)}
                >
                  {(i) => (
                    <div className="space-y-2">
                      <Textarea value={r.pendencias[i].pendencia} onChange={(e) => setItem<Pendencia>('pendencias', i, { pendencia: e.target.value })} placeholder="Pendência" className="rounded-xl" />
                      <Input value={r.pendencias[i].responsavel} onChange={(e) => setItem<Pendencia>('pendencias', i, { responsavel: up(e.target.value) })} placeholder="RESPONSÁVEL" className="h-11 rounded-xl" />
                      <Input type="date" value={r.pendencias[i].prazo} onChange={(e) => setItem<Pendencia>('pendencias', i, { prazo: e.target.value })} className="h-11 rounded-xl" />
                      <Input value={r.pendencias[i].acompanhamento} onChange={(e) => setItem<Pendencia>('pendencias', i, { acompanhamento: e.target.value })} placeholder="Forma de acompanhamento" className="h-11 rounded-xl" />
                    </div>
                  )}
                </ListaBloco>
              )}
            </div>
          </Campo>
          <Campo label="Prioridade técnica do próximo dia">
            <div className="space-y-3">
              {(['NENHUMA', 'ACOMPANHAR PROFISSIONAL', 'ACOMPANHAR ALUNO', 'CORRIGIR PADRÃO TÉCNICO', 'AJUSTAR ESCALA OU DISTRIBUIÇÃO', 'RESOLVER PROBLEMA ESTRUTURAL', 'OUTRO'] as const).map((p) => (
                <OptionCard key={p} emoji="🎯" label={p} selected={r.prioridade === p} onClick={() => set('prioridade', p)} />
              ))}
              {r.prioridade !== '' && r.prioridade !== 'NENHUMA' && (
                <Textarea value={r.prioridadeDetalhe} onChange={(e) => set('prioridadeDetalhe', e.target.value)} placeholder="Detalhamento" className="rounded-xl" />
              )}
            </div>
          </Campo>
        </div>
      ),
    });

    return list;
  }, [r, desviosOk, feedbacksOk, destaquesOk, escalaOk, alunosOk, pendenciasOk, expA, expR, expX, expErro]);

  const safeStep = Math.min(step, steps.length - 1);
  const current = steps[safeStep];
  const isLast = safeStep === steps.length - 1;

  const resumo = useMemo(() => {
    const naoAplica = 'Não se aplica';
    const sn = (v: SimNao) => (v === true ? 'Sim' : v === false ? 'Não' : 'Não informado');
    const t = (s: string, fb = naoAplica) => (s.trim() ? s : fb);
    const linhas: string[] = [];
    linhas.push(`📍 Unidade: ${r.unidade ? `EVO ${getUnidadeLabelByValue(r.unidade)}` : naoAplica}`);
    linhas.push(`👤 Coordenador: ${t(r.coordenador)}`);
    linhas.push(`📅 Data: ${r.data.split('-').reverse().join('/')}`);
    linhas.push(`🔄 Alinhamento com a manhã: ${sn(r.alinhamentoManha)}`);
    linhas.push(`📝 Motivo: ${t(r.alinhamentoManhaMotivo)}`);
    linhas.push(`🔄 Alinhamento com a noite: ${sn(r.alinhamentoNoite)}`);
    linhas.push(`📝 Motivo: ${t(r.alinhamentoNoiteMotivo)}`);
    linhas.push(`📌 Pontos alinhados: ${r.pontos.length ? r.pontos.join(', ') : PONTO_NENHUM}`);
    linhas.push(`📝 Detalhamento: ${t(r.pontosDetalhe)}`);
    linhas.push(`🔍 Ronda técnica: ${t(r.ronda, 'Não informado')}`);
    linhas.push(`📝 Motivo: ${t(r.rondaMotivo)}`);
    linhas.push(`⚠️ Desvio técnico ou de conduta: ${sn(r.teveDesvio)}`);
    r.desvios.forEach((d, i) => linhas.push(`  ${i + 1}. ${d.profissional} — ${d.desvio} | ${d.correcao} | ${d.situacao}${d.situacao === 'PENDENTE' ? ` | ${d.responsavel} até ${d.prazo}` : ''}`));
    linhas.push(`💬 Feedback corretivo aplicado: ${sn(r.teveFeedback)}`);
    r.feedbacks.forEach((f, i) => linhas.push(`  ${i + 1}. ${f.profissional} — ${f.motivo} | ${f.orientacao}`));
    linhas.push(`🌟 Destaque positivo: ${sn(r.teveDestaque)}`);
    r.destaques.forEach((d, i) => linhas.push(`  ${i + 1}. ${d.profissional} — ${d.comportamento}`));
    linhas.push(`👥 Escala cumprida integralmente: ${sn(r.escalaCumprida)}`);
    r.escalaOcorrencias.forEach((o, i) => linhas.push(`  ${i + 1}. ${o.profissional} — ${o.tipo} | Cobertura: ${o.cobertura ? o.cobertura_responsavel : 'Não'} | ${o.impacto}`));
    linhas.push(`⚖️ Distribuição dos alunos: ${t(r.distribuicao, 'Não informado')}`);
    linhas.push(`📝 Problema identificado: ${t(r.distribuicaoProblema)}`);
    linhas.push(`✅ Ajuste realizado: ${t(r.distribuicaoAjuste)}`);
    linhas.push(`🏋️ Alunos atendidos no turno da tarde: ${intOf(r.alunosTarde) ?? 0}`);
    linhas.push(`📈 Atendimentos por treinador: ${r.atendimentos.length ? r.atendimentos.map((a) => `${a.treinador}: ${intOf(a.quantidade) ?? 0}`).join(' | ') : 'Nenhum registro'}`);
    linhas.push(`🧪 Experimentais agendadas: ${expA ?? 0}`);
    linhas.push(`✅ Experimentais realizadas: ${expR ?? 0}`);
    linhas.push(`❌ Experimentais ausentes: ${expX ?? 0}`);
    linhas.push(`🙋 Feedback ou ocorrência com aluno: ${sn(r.teveOcorrenciaAluno)}`);
    r.ocorrenciasAluno.forEach((o, i) => linhas.push(`  ${i + 1}. ${o.tipo} | ${o.aluno} | ${o.descricao} | ${o.profissional} | ${o.medida} | Gerente: ${sn(o.gerente_comunicado)}`));
    linhas.push(`🧼 Sala organizada e segura: ${t(r.salaOk, 'Não informado')}`);
    linhas.push(`📝 Problema identificado: ${t(r.salaProblema)}`);
    linhas.push(`✅ Providência adotada: ${t(r.salaProvidencia)}`);
    linhas.push(`🛠️ Problema de estrutura ou equipamento: ${sn(r.teveEstrutura)}`);
    linhas.push(`📝 Descrição: ${t(r.estruturaProblema)}`);
    linhas.push(`📊 Impacto na operação: ${t(r.estruturaImpacto)}`);
    linhas.push(`✅ Providência adotada: ${t(r.estruturaProvidencia)}`);
    linhas.push(`📣 Gerente comunicado: ${r.teveEstrutura ? sn(r.estruturaGerente) : naoAplica}`);
    linhas.push(`⏳ Pendência para o próximo turno ou dia: ${sn(r.tevePendencia)}`);
    r.pendencias.forEach((p, i) => linhas.push(`  ${i + 1}. ${p.pendencia} | ${p.responsavel} | ${p.prazo} | ${p.acompanhamento}`));
    linhas.push(`🎯 Prioridade técnica do próximo dia: ${t(r.prioridade, 'Nenhuma')}`);
    linhas.push(`📝 Detalhamento: ${t(r.prioridadeDetalhe)}`);
    return linhas;
  }, [r, expA, expR, expX]);

  const payload = () => ({
    unidade: r.unidade as string,
    unidade_id: getUnidadeIdByValue(r.unidade) ?? null,
    coordenador_nome: r.coordenador.trim(),
    data: r.data,
    alinhamento_manha: r.alinhamentoManha === true,
    alinhamento_manha_motivo: r.alinhamentoManhaMotivo.trim() || null,
    alinhamento_noite: r.alinhamentoNoite === true,
    alinhamento_noite_motivo: r.alinhamentoNoiteMotivo.trim() || null,
    pontos_alinhados: r.pontos,
    pontos_alinhados_detalhe: r.pontosDetalhe.trim() || null,
    ronda_tecnica: r.ronda,
    ronda_motivo: r.rondaMotivo.trim() || null,
    teve_desvio: r.teveDesvio === true,
    desvios: r.desvios,
    teve_feedback: r.teveFeedback === true,
    feedbacks: r.feedbacks,
    teve_destaque: r.teveDestaque === true,
    destaques: r.destaques,
    escala_cumprida: r.escalaCumprida === true,
    escala_ocorrencias: r.escalaOcorrencias,
    distribuicao_alunos: r.distribuicao,
    distribuicao_problema: r.distribuicaoProblema.trim() || null,
    distribuicao_ajuste: r.distribuicaoAjuste.trim() || null,
    alunos_atendidos_tarde: intOf(r.alunosTarde) ?? 0,
    atendimentos_treinador: r.atendimentos.map((a) => ({ treinador: a.treinador, quantidade: intOf(a.quantidade) ?? 0 })),
    experimentais_agendadas: expA ?? 0,
    experimentais_realizadas: expR ?? 0,
    experimentais_ausentes: expX ?? 0,
    teve_ocorrencia_aluno: r.teveOcorrenciaAluno === true,
    ocorrencias_aluno: r.ocorrenciasAluno,
    sala_organizada: r.salaOk,
    sala_problema: r.salaProblema.trim() || null,
    sala_providencia: r.salaProvidencia.trim() || null,
    teve_problema_estrutura: r.teveEstrutura === true,
    estrutura_problema: r.estruturaProblema.trim() || null,
    estrutura_impacto: r.estruturaImpacto.trim() || null,
    estrutura_providencia: r.estruturaProvidencia.trim() || null,
    estrutura_gerente_comunicado: r.teveEstrutura === true ? r.estruturaGerente : null,
    teve_pendencia: r.tevePendencia === true,
    pendencias: r.pendencias,
    prioridade_tecnica: r.prioridade,
    prioridade_detalhe: r.prioridadeDetalhe.trim() || null,
  });

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const unidadeId = getUnidadeIdByValue(r.unidade) ?? null;

      // Já existe encerramento do mesmo coordenador nesta unidade e data?
      if (!confirmarSubstituicao && unidadeId) {
        const { data: existenteId } = await supabase.rpc('encerramento_tecnico_existente', {
          p_unidade_id: unidadeId,
          p_coordenador: r.coordenador.trim(),
          p_data: r.data,
        });
        if (existenteId) {
          setSubstituindo(existenteId as string);
          setConfirmarSubstituicao(true);
          setSaving(false);
          return;
        }
      }

      if (substituindo) {
        await supabase.rpc('encerramento_tecnico_arquivar', { p_resposta_id: substituindo });
      }

      const res = await submitWithRetry(() =>
        supabase
          .from('encerramento_tecnico_respostas')
          .insert({ ...payload(), substitui_resposta_id: substituindo })
          .select('id')
          .single(),
      );
      if (res.error) throw res.error;

      await submitFormularioPublico({
        tipo_formulario: 'coordenador_tecnico',
        unidade: r.unidade,
        unidade_id: unidadeId ?? undefined,
        resposta_id: (res.data as { id: string }).id,
      });

      clearDraft(DRAFT_KEY);
      setStage('done');
    } catch (e) {
      toast({
        title: 'Não foi possível enviar',
        description: e instanceof Error ? e.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ========= INTRO =========
  if (stage === 'intro') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-anamnese-royal p-6 text-anamnese-royal-foreground">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="font-display text-4xl font-extrabold uppercase leading-tight">Encerramento Técnico Diário</h1>
          <p className="text-base opacity-90">Coordenador Geral Técnico — leva menos de 5 minutos.</p>
          <Button
            size="lg"
            onClick={() => { setStage('wizard'); setStep(0); }}
            className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-anamnese-royal shadow-lg hover:bg-white/90"
          >
            Começar <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  // ========= REVIEW =========
  if (stage === 'review') {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-anamnese-bg">
        <header className="sticky top-0 z-20 bg-anamnese-royal px-4 py-3 text-anamnese-royal-foreground">
          <div className="mx-auto max-w-md">
            <p className="font-display-condensed text-lg font-extrabold uppercase tracking-wider">Confira antes de enviar</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-5 pb-48 pt-5">
          {confirmarSubstituicao && substituindo && (
            <div className="mb-4">
              <Alerta texto="Já existe um encerramento seu para esta unidade e data. Ao enviar novamente, ele será substituído e a versão anterior fica guardada no histórico." />
            </div>
          )}
          <div className="space-y-1.5 rounded-2xl border-2 border-anamnese-border bg-anamnese-card p-4">
            {resumo.map((l, i) => (
              <p key={i} className="text-sm leading-snug text-anamnese-card-foreground">{l}</p>
            ))}
          </div>
        </main>
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-anamnese-border bg-anamnese-card/95 backdrop-blur safe-bottom">
          <div className="mx-auto flex max-w-md flex-col gap-2 px-5 pb-3 pt-3">
            <Button
              type="button"
              size="lg"
              disabled={saving}
              onClick={handleSubmit}
              className="h-14 w-full rounded-2xl bg-anamnese-royal text-base font-semibold text-anamnese-royal-foreground hover:bg-anamnese-royal/90"
            >
              {saving ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando...</>
              ) : confirmarSubstituicao && substituindo ? (
                <>Confirmar substituição <ArrowRight className="ml-2 h-5 w-5" /></>
              ) : (
                <>Enviar encerramento <ArrowRight className="ml-2 h-5 w-5" /></>
              )}
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
          <h1 className="font-display text-4xl font-extrabold uppercase leading-tight">Encerramento registrado</h1>
          <p className="text-base opacity-90">Obrigado! Bom descanso.</p>
          <Button
            size="lg"
            onClick={() => { setR(initial); setStep(0); setSubstituindo(null); setConfirmarSubstituicao(false); setStage('intro'); }}
            className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-anamnese-royal shadow-lg hover:bg-white/90"
          >
            <RefreshCw className="mr-2 h-5 w-5" /> Novo encerramento
          </Button>
        </div>
      </div>
    );
  }

  // ========= WIZARD =========
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
