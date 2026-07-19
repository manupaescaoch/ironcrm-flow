import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StepShell } from './StepShell';
import { OptionCard } from './OptionCard';

export interface AnamneseRespostas {
  nome: string;
  data_nascimento: string;
  objetivo: string;
  historico: string;
  frequencia_atual: string;
  obstaculo: string;
  dias_semana: string;
  preferencia_horario: string[];
  tem_condicao_saude: boolean | null;
  condicao_saude_descricao: string;
  tem_lesao: boolean | null;
  lesao_descricao: string;
  observacoes: string;
}

export const initialRespostas: AnamneseRespostas = {
  nome: '',
  data_nascimento: '',
  objetivo: '',
  historico: '',
  frequencia_atual: '',
  obstaculo: '',
  dias_semana: '',
  preferencia_horario: [],
  tem_condicao_saude: null,
  condicao_saude_descricao: '',
  tem_lesao: null,
  lesao_descricao: '',
  observacoes: '',
};

interface AnamneseWizardProps {
  initial: AnamneseRespostas;
  onComplete: (respostas: AnamneseRespostas) => void;
  onBackToIntro: () => void;
  skipNome?: boolean;
}

const TOTAL = 11;

const objetivoOpcoes = [
  { v: 'Emagrecer e perder gordura', e: '🔥' },
  { v: 'Ganhar massa e definição', e: '💪' },
  { v: 'Saúde e qualidade de vida', e: '❤️' },
  { v: 'Condicionamento físico', e: '⚡' },
  { v: 'Outro objetivo', e: '🎯' },
];

const historicoOpcoes = [
  { v: 'Nunca treinei com acompanhamento', e: '🌱' },
  { v: 'Sim, e continuo treinando', e: '✅' },
  { v: 'Sim, mas parei em algum momento', e: '⏸️' },
  { v: 'Treino por conta própria', e: '🏋️' },
];

const frequenciaOpcoes = [
  { v: 'Sim, treino atualmente', e: '✅' },
  { v: 'Já treinei, mas estou parado(a)', e: '⏸️' },
  { v: 'Nunca treinei de forma consistente', e: '🌱' },
];

const obstaculoOpcoes = [
  { v: 'Falta de tempo', e: '⏰' },
  { v: 'Dificuldade de criar o hábito', e: '🔁' },
  { v: 'Falta de orientação / não saber o que fazer', e: '🧭' },
  { v: 'Falta de motivação', e: '🔋' },
  { v: 'Sem obstáculos no momento', e: '✨' },
];

const diasOpcoes = [
  { v: '2 dias por semana', e: '2️⃣' },
  { v: '3 dias por semana', e: '3️⃣' },
  { v: '4 dias por semana', e: '4️⃣' },
  { v: '5 ou mais dias por semana', e: '🔥' },
];

const horarioOpcoes = [
  { v: 'Manhã', e: '🌅', hint: '06h - 11h' },
  { v: 'Almoço', e: '☀️', hint: '11h - 14h' },
  { v: 'Tarde', e: '🌤️', hint: '14h - 18h' },
  { v: 'Noite', e: '🌙', hint: '18h - 22h' },
];

function isValidDate(value: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d &&
    date <= new Date()
  );
}

export function AnamneseWizard({ initial, onComplete, onBackToIntro, skipNome }: AnamneseWizardProps) {
  const [step, setStep] = useState(skipNome ? 2 : 1);
  const [r, setR] = useState<AnamneseRespostas>(initial);

  const upd = <K extends keyof AnamneseRespostas>(k: K, v: AnamneseRespostas[K]) =>
    setR((prev) => ({ ...prev, [k]: v }));

  const next = () => setStep((s) => Math.min(TOTAL + 1, s + 1));
  const back = () => (step <= (skipNome ? 2 : 1) ? onBackToIntro() : setStep((s) => s - 1));

  // Quando passa de etapa 11 → finaliza
  if (step > TOTAL) {
    onComplete(r);
    return null;
  }

  // Etapa 1 — Nome
  if (step === 1) {
    return (
      <StepShell
        stepNumber={1}
        totalSteps={TOTAL}
        categoria="Identificação"
        pergunta="Qual é o seu nome?"
        apoio="Como você gosta de ser chamado(a)."
        canContinue={r.nome.trim().length > 0}
        onBack={back}
        onContinue={next}
      >
        <Input
          autoFocus
          value={r.nome}
          onChange={(e) => upd('nome', e.target.value)}
          placeholder="SEU NOME..."
          className="h-14 rounded-2xl border-2 border-anamnese-border bg-anamnese-card px-5 text-base font-medium shadow-sm focus-visible:border-anamnese-border-selected focus-visible:ring-0"
        />
      </StepShell>
    );
  }

  // Etapa 2 — Data de nascimento
  if (step === 2) {
    return (
      <StepShell
        stepNumber={2}
        totalSteps={TOTAL}
        categoria="Identificação"
        pergunta="Qual é a sua data de nascimento?"
        apoio="Usamos essa informação para conhecer melhor nossos alunos."
        canContinue={isValidDate(r.data_nascimento)}
        onBack={back}
        onContinue={next}
      >
        <Input
          type="date"
          autoFocus
          value={r.data_nascimento}
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => upd('data_nascimento', e.target.value)}
          className="h-14 rounded-2xl border-2 border-anamnese-border bg-anamnese-card px-5 text-base font-medium shadow-sm focus-visible:border-anamnese-border-selected focus-visible:ring-0"
        />
      </StepShell>
    );
  }

  // Etapa 3 — Objetivo
  if (step === 3) {
    return (
      <StepShell
        stepNumber={3}
        totalSteps={TOTAL}
        categoria="Objetivo"
        pergunta="Qual é o seu principal objetivo?"
        apoio="Escolha o que melhor descreve o que você quer alcançar."
        canContinue={!!r.objetivo}
        onBack={back}
        onContinue={next}
      >
        {objetivoOpcoes.map((o) => (
          <OptionCard
            key={o.v}
            emoji={o.e}
            label={o.v}
            selected={r.objetivo === o.v}
            onClick={() => upd('objetivo', o.v)}
          />
        ))}
      </StepShell>
    );
  }

  // Etapa 4 — Histórico
  if (step === 4) {
    return (
      <StepShell
        stepNumber={4}
        totalSteps={TOTAL}
        categoria="Histórico"
        pergunta="Você já treinou com acompanhamento antes?"
        apoio="Personal trainer, academia com instrutores ou treino supervisionado."
        canContinue={!!r.historico}
        onBack={back}
        onContinue={next}
      >
        {historicoOpcoes.map((o) => (
          <OptionCard
            key={o.v}
            emoji={o.e}
            label={o.v}
            selected={r.historico === o.v}
            onClick={() => upd('historico', o.v)}
          />
        ))}
      </StepShell>
    );
  }

  // Etapa 5 — Frequência atual
  if (step === 5) {
    return (
      <StepShell
        stepNumber={5}
        totalSteps={TOTAL}
        categoria="Frequência atual"
        pergunta="Você treina atualmente?"
        apoio="Isso ajuda a equipe a entender seu ponto de partida."
        canContinue={!!r.frequencia_atual}
        onBack={back}
        onContinue={next}
      >
        {frequenciaOpcoes.map((o) => (
          <OptionCard
            key={o.v}
            emoji={o.e}
            label={o.v}
            selected={r.frequencia_atual === o.v}
            onClick={() => upd('frequencia_atual', o.v)}
          />
        ))}
      </StepShell>
    );
  }

  // Etapa 6 — Obstáculo
  if (step === 6) {
    return (
      <StepShell
        stepNumber={6}
        totalSteps={TOTAL}
        categoria="Obstáculo"
        pergunta="Qual é seu maior obstáculo para treinar com consistência?"
        apoio="Seja sincero(a). Isso ajuda o treinador a personalizar sua aula."
        canContinue={!!r.obstaculo}
        onBack={back}
        onContinue={next}
      >
        {obstaculoOpcoes.map((o) => (
          <OptionCard
            key={o.v}
            emoji={o.e}
            label={o.v}
            selected={r.obstaculo === o.v}
            onClick={() => upd('obstaculo', o.v)}
          />
        ))}
      </StepShell>
    );
  }

  // Etapa 7 — Disponibilidade (dias)
  if (step === 7) {
    return (
      <StepShell
        stepNumber={7}
        totalSteps={TOTAL}
        categoria="Disponibilidade"
        pergunta="Quantos dias por semana você consegue treinar?"
        apoio="Sendo realista com a sua rotina atual."
        canContinue={!!r.dias_semana}
        onBack={back}
        onContinue={next}
      >
        {diasOpcoes.map((o) => (
          <OptionCard
            key={o.v}
            emoji={o.e}
            label={o.v}
            selected={r.dias_semana === o.v}
            onClick={() => upd('dias_semana', o.v)}
          />
        ))}
      </StepShell>
    );
  }

  // Etapa 8 — Preferência de horário (multi)
  if (step === 8) {
    const togglePref = (v: string) => {
      const has = r.preferencia_horario.includes(v);
      upd(
        'preferencia_horario',
        has ? r.preferencia_horario.filter((x) => x !== v) : [...r.preferencia_horario, v],
      );
    };
    return (
      <StepShell
        stepNumber={8}
        totalSteps={TOTAL}
        categoria="Preferência de horário"
        pergunta="Qual período do dia funciona melhor pra você?"
        apoio="Pode selecionar mais de um."
        canContinue={r.preferencia_horario.length > 0}
        onBack={back}
        onContinue={next}
      >
        {horarioOpcoes.map((o) => (
          <OptionCard
            key={o.v}
            emoji={o.e}
            label={o.v}
            hint={o.hint}
            selected={r.preferencia_horario.includes(o.v)}
            onClick={() => togglePref(o.v)}
          />
        ))}
      </StepShell>
    );
  }

  // Etapa 9 — Saúde
  if (step === 9) {
    const showField = r.tem_condicao_saude === true;
    const canGo =
      r.tem_condicao_saude === false ||
      (r.tem_condicao_saude === true && r.condicao_saude_descricao.trim().length > 0);
    return (
      <StepShell
        stepNumber={9}
        totalSteps={TOTAL}
        categoria="Saúde"
        pergunta="Possui alguma condição de saúde relevante?"
        apoio="Hipertensão, diabetes, problemas cardíacos, cirurgias recentes, etc."
        canContinue={canGo}
        onBack={back}
        onContinue={next}
      >
        <OptionCard
          emoji="✅"
          label="Não"
          selected={r.tem_condicao_saude === false}
          onClick={() => {
            upd('tem_condicao_saude', false);
            upd('condicao_saude_descricao', '');
          }}
        />
        <OptionCard
          emoji="⚕️"
          label="Sim"
          selected={r.tem_condicao_saude === true}
          onClick={() => upd('tem_condicao_saude', true)}
        />
        {showField && (
          <Textarea
            autoFocus
            value={r.condicao_saude_descricao}
            onChange={(e) => upd('condicao_saude_descricao', e.target.value)}
            placeholder="DESCREVA QUAL CONDIÇÃO DE SAÚDE..."
            className="min-h-[110px] rounded-2xl border-2 border-anamnese-border bg-anamnese-card p-4 text-base shadow-sm focus-visible:border-anamnese-border-selected focus-visible:ring-0"
          />
        )}
      </StepShell>
    );
  }

  // Etapa 10 — Lesões
  if (step === 10) {
    const showField = r.tem_lesao === true;
    const canGo =
      r.tem_lesao === false ||
      (r.tem_lesao === true && r.lesao_descricao.trim().length > 0);
    return (
      <StepShell
        stepNumber={10}
        totalSteps={TOTAL}
        categoria="Lesões e limitações"
        pergunta="Tem alguma lesão ou limitação física?"
        apoio="Dores, cirurgias recentes, restrições de movimento, etc."
        canContinue={canGo}
        onBack={back}
        onContinue={next}
      >
        <OptionCard
          emoji="✅"
          label="Não"
          selected={r.tem_lesao === false}
          onClick={() => {
            upd('tem_lesao', false);
            upd('lesao_descricao', '');
          }}
        />
        <OptionCard
          emoji="🩹"
          label="Sim"
          selected={r.tem_lesao === true}
          onClick={() => upd('tem_lesao', true)}
        />
        {showField && (
          <Textarea
            autoFocus
            value={r.lesao_descricao}
            onChange={(e) => upd('lesao_descricao', e.target.value)}
            placeholder="DESCREVA SUA LESÃO OU LIMITAÇÃO..."
            className="min-h-[110px] rounded-2xl border-2 border-anamnese-border bg-anamnese-card p-4 text-base shadow-sm focus-visible:border-anamnese-border-selected focus-visible:ring-0"
          />
        )}
      </StepShell>
    );
  }

  // Etapa 11 — Observações finais (opcional)
  return (
    <StepShell
      stepNumber={11}
      totalSteps={TOTAL}
      categoria="Observações finais"
      pergunta="Alguma informação importante que a equipe precisa saber?"
      apoio="Algo que possa ajudar na condução da sua aula experimental. Você pode pular se preferir."
      canContinue={true}
      onBack={back}
      onContinue={next}
      continueLabel="Finalizar"
    >
      <Textarea
        value={r.observacoes}
        onChange={(e) => upd('observacoes', e.target.value)}
        placeholder="ESCREVA AQUI..."
        className="min-h-[140px] rounded-2xl border-2 border-anamnese-border bg-anamnese-card p-4 text-base shadow-sm focus-visible:border-anamnese-border-selected focus-visible:ring-0"
      />
    </StepShell>
  );
}
