import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Loader2, User, Phone, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import evoClubLogo from '@/assets/evo-club-logo-dark.png.asset.json';

/* ---------------- dados ---------------- */

const PAISES = [
  { code: 'BR', flag: '🇧🇷', nome: 'Brasil', ddi: '+55' },
  { code: 'PT', flag: '🇵🇹', nome: 'Portugal', ddi: '+351' },
  { code: 'US', flag: '🇺🇸', nome: 'Estados Unidos', ddi: '+1' },
  { code: 'AR', flag: '🇦🇷', nome: 'Argentina', ddi: '+54' },
  { code: 'CL', flag: '🇨🇱', nome: 'Chile', ddi: '+56' },
  { code: 'CO', flag: '🇨🇴', nome: 'Colômbia', ddi: '+57' },
  { code: 'UY', flag: '🇺🇾', nome: 'Uruguai', ddi: '+598' },
  { code: 'PY', flag: '🇵🇾', nome: 'Paraguai', ddi: '+595' },
  { code: 'PE', flag: '🇵🇪', nome: 'Peru', ddi: '+51' },
  { code: 'BO', flag: '🇧🇴', nome: 'Bolívia', ddi: '+591' },
  { code: 'VE', flag: '🇻🇪', nome: 'Venezuela', ddi: '+58' },
  { code: 'MX', flag: '🇲🇽', nome: 'México', ddi: '+52' },
  { code: 'CA', flag: '🇨🇦', nome: 'Canadá', ddi: '+1' },
  { code: 'ES', flag: '🇪🇸', nome: 'Espanha', ddi: '+34' },
  { code: 'FR', flag: '🇫🇷', nome: 'França', ddi: '+33' },
  { code: 'IT', flag: '🇮🇹', nome: 'Itália', ddi: '+39' },
  { code: 'DE', flag: '🇩🇪', nome: 'Alemanha', ddi: '+49' },
  { code: 'GB', flag: '🇬🇧', nome: 'Reino Unido', ddi: '+44' },
  { code: 'IE', flag: '🇮🇪', nome: 'Irlanda', ddi: '+353' },
  { code: 'CH', flag: '🇨🇭', nome: 'Suíça', ddi: '+41' },
  { code: 'JP', flag: '🇯🇵', nome: 'Japão', ddi: '+81' },
  { code: 'AO', flag: '🇦🇴', nome: 'Angola', ddi: '+244' },
  { code: 'MZ', flag: '🇲🇿', nome: 'Moçambique', ddi: '+258' },
  { code: 'AU', flag: '🇦🇺', nome: 'Austrália', ddi: '+61' },
];

const UNIDADES = ['EVO MADALENA', 'EVO BOA VIAGEM', 'EVO SETÚBAL', 'EVO SANTA CRUZ'];

type Tipo = 'contato' | 'unidade' | 'single' | 'multi' | 'paragrafo' | 'curto' | 'escala';
interface Etapa {
  key: string;
  titulo: string;
  tipo: Tipo;
  opcoes?: string[];
  obrigatorio?: boolean;
  outro?: boolean;
  exclusiva?: string[]; // opções que desmarcam as demais
}

const ETAPAS: Etapa[] = [
  { key: 'contato', titulo: 'Seu nome, WhatsApp e unidade', tipo: 'contato', obrigatorio: true },
  { key: 'plano', titulo: 'Qual é o seu plano atual?', tipo: 'single', obrigatorio: true, outro: true,
    opcoes: ['Mensal', 'Semestral', 'Anual', 'Executivo', 'Completo', 'Outro'] },
  { key: 'motivos', titulo: 'Qual é o principal motivo da sua decisão?', tipo: 'multi', obrigatorio: true, outro: true,
    opcoes: ['Valor da mensalidade', 'Mudança de endereço', 'Mudança de cidade', 'Falta de tempo', 'Horários disponíveis',
      'Dificuldade para manter frequência', 'Atendimento', 'Acompanhamento durante os treinos', 'Estrutura', 'Equipamentos',
      'Lotação / disponibilidade de horários', 'Problemas pessoais', 'Questões financeiras', 'Questões de saúde',
      'Vou treinar em outro local', 'Não me adaptei à metodologia', 'Outro'] },
  { key: 'detalhamento', titulo: 'Conte um pouco mais sobre o motivo da sua decisão.', tipo: 'paragrafo' },
  { key: 'problemas', titulo: 'Durante sua experiência, houve algum problema específico?', tipo: 'multi', obrigatorio: true, outro: true,
    exclusiva: ['Nenhum problema específico'],
    opcoes: ['Nenhum problema específico', 'Atendimento da recepção', 'Atendimento comercial', 'Atendimento dos professores',
      'Falta de acompanhamento', 'Agendamento', 'Disponibilidade de horários', 'Estrutura', 'Equipamentos', 'Limpeza',
      'Manutenção', 'Climatização', 'Estacionamento', 'Cobrança / financeiro', 'Comunicação', 'Outro'] },
  { key: 'acompanhamento', titulo: 'Você sentiu que recebeu acompanhamento durante os treinos?', tipo: 'single', obrigatorio: true,
    opcoes: ['Sim, sempre', 'Na maioria das vezes', 'Algumas vezes', 'Raramente', 'Não'] },
  { key: 'evolucao', titulo: 'Você percebeu evolução durante o período em que treinou conosco?', tipo: 'single', obrigatorio: true,
    opcoes: ['Sim, bastante', 'Sim, alguma evolução', 'Pouca evolução', 'Não percebi evolução', 'Não permaneci tempo suficiente para avaliar'] },
  { key: 'nota', titulo: 'De 0 a 10, como você avalia sua experiência geral conosco?', tipo: 'escala', obrigatorio: true },
  { key: 'pontos_positivos', titulo: 'O que você mais gostou durante sua experiência?', tipo: 'paragrafo' },
  { key: 'evitaria_saida', titulo: 'O que poderíamos ter feito para evitar sua saída?', tipo: 'paragrafo' },
  { key: 'solucoes_retencao', titulo: 'Existe alguma solução que faria você reconsiderar o cancelamento?', tipo: 'multi', obrigatorio: true, outro: true,
    exclusiva: ['Não, minha decisão está tomada'],
    opcoes: ['Ajuste no plano', 'Mudança de horário', 'Mudança de unidade', 'Conversar com a gerência', 'Melhor acompanhamento',
      'Resolver algum problema específico', 'Pausar temporariamente o plano', 'Uma condição comercial diferente',
      'Não, minha decisão está tomada', 'Outro'] },
  { key: 'vai_treinar_outro_local', titulo: 'Você pretende continuar treinando em outro local?', tipo: 'single', obrigatorio: true,
    opcoes: ['Sim', 'Não', 'Ainda não decidi'] },
  { key: 'proxima_escolha', titulo: 'Qual academia, modalidade ou solução você pretende escolher?', tipo: 'curto' },
  { key: 'fator_escolha', titulo: 'Qual foi o principal fator para essa escolha?', tipo: 'single', outro: true,
    opcoes: ['Preço', 'Localização', 'Estrutura', 'Equipamentos', 'Atendimento', 'Metodologia', 'Horário', 'Conveniência',
      'Benefícios', 'Indicação', 'Modalidade diferente', 'Outro'] },
  { key: 'aceita_contato_antes', titulo: 'Podemos entrar em contato para apresentar uma possível solução antes da conclusão do cancelamento?', tipo: 'single', obrigatorio: true, opcoes: ['Sim', 'Não'] },
  { key: 'aceita_contato_futuro', titulo: 'Podemos entrar em contato futuramente caso tenhamos melhorias ou novidades relacionadas ao motivo da sua saída?', tipo: 'single', obrigatorio: true, opcoes: ['Sim', 'Não'] },
];

const TOTAL = ETAPAS.length;
const DRAFT_KEY = 'evo_cancelamento_rascunho';

type Respostas = Record<string, any>;

function maskBR(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* ---------------- estilos ---------------- */

const fieldClass =
  'h-14 rounded-xl border border-[#E4E7EC] bg-white px-4 text-base text-[#0F172A] placeholder:text-[#98A2B3] shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus-visible:border-[#0A6CFF] focus-visible:ring-4 focus-visible:ring-[#0A6CFF]/15 focus-visible:ring-offset-0';

function OptionCard({ label, selected, onClick, multi }: { label: string; selected: boolean; onClick: () => void; multi?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border px-4 py-4 text-left text-[15px] font-medium transition-all active:scale-[0.99]',
        selected
          ? 'border-[#0A6CFF] bg-[#0A6CFF]/[0.06] text-[#0F172A] shadow-[0_0_0_3px_rgba(10,108,255,0.12)]'
          : 'border-[#E4E7EC] bg-white text-[#344054] hover:border-[#B9C2D0] hover:bg-[#FAFBFC]',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors',
          multi ? 'rounded-md' : 'rounded-full',
          selected ? 'border-[#0A6CFF] bg-[#0A6CFF] text-white' : 'border-[#D0D5DD] bg-white',
        )}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3.5} />}
      </span>
      <span className="leading-snug">{label}</span>
    </button>
  );
}

/* ---------------- página ---------------- */

export default function CancelamentoPublico() {
  const [step, setStep] = useState(0); // 0..TOTAL-1 perguntas, TOTAL = revisão, TOTAL+1 = obrigado
  const [r, setR] = useState<Respostas>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Date.now() - p.ts < 24 * 3600 * 1000) return p.r;
      }
    } catch { /* ignore */ }
    return { pais: 'BR', motivos: [], problemas: [], solucoes_retencao: [] };
  });
  const [erro, setErro] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paisOpen, setPaisOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const telRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Formulário de Cancelamento | EVO Club';
  }, []);

  useEffect(() => {
    if (step <= TOTAL) localStorage.setItem(DRAFT_KEY, JSON.stringify({ ts: Date.now(), r }));
  }, [r, step]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setErro(null);
  }, [step]);

  const pais = PAISES.find((p) => p.code === r.pais) ?? PAISES[0];
  const isBR = pais.code === 'BR';
  const digits = (r.telefone ?? '').replace(/\D/g, '');
  const telFormatado = isBR && digits.length >= 10
    ? `${pais.ddi} ${maskBR(digits)}`
    : `${pais.ddi} ${digits}`;

  const set = (k: string, v: any) => { setR((p) => ({ ...p, [k]: v })); setErro(null); };

  const toggleMulti = (e: Etapa, op: string) => {
    const atual: string[] = r[e.key] ?? [];
    let novo: string[];
    if (atual.includes(op)) novo = atual.filter((x) => x !== op);
    else if (e.exclusiva?.includes(op)) novo = [op];
    else novo = [...atual.filter((x) => !e.exclusiva?.includes(x)), op];
    set(e.key, novo);
  };

  const validar = (e: Etapa): string | null => {
    if (e.tipo === 'contato') {
      if (!r.nome || r.nome.trim().length < 2) return 'Informe seu nome.';
      const min = isBR ? 10 : 6;
      if (digits.length < min) return 'Informe um WhatsApp válido.';
      if (!r.unidade) return 'Selecione sua unidade.';
      return null;
    }
    if (!e.obrigatorio) return null;
    const v = r[e.key];
    if (e.tipo === 'multi') {
      if (!v || v.length === 0) return 'Selecione ao menos uma opção.';
      if (e.outro && v.includes('Outro') && !r[`${e.key}_outro`]?.trim()) return 'Descreva a opção "Outro".';
      return null;
    }
    if (e.tipo === 'escala') return v === undefined || v === null ? 'Escolha uma nota de 0 a 10.' : null;
    if (!v) return 'Selecione uma opção.';
    if (e.outro && v === 'Outro' && !r[`${e.key}_outro`]?.trim()) return 'Descreva a opção "Outro".';
    return null;
  };

  const avancar = () => {
    if (step >= TOTAL) return;
    const e = ETAPAS[step];
    const msg = validar(e);
    if (msg) { setErro(msg); return; }
    if (e.tipo === 'contato') { setConfirmOpen(true); return; }
    setStep((s) => s + 1);
  };

  const voltar = () => { if (step > 0) setStep((s) => s - 1); };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Enter' || confirmOpen || paisOpen) return;
      const t = ev.target as HTMLElement;
      if (t.tagName === 'TEXTAREA' && !ev.metaKey && !ev.ctrlKey) return;
      if (step < TOTAL) { ev.preventDefault(); avancar(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const comOutro = (k: string, v: any) => {
    if (Array.isArray(v)) return v.map((x) => (x === 'Outro' && r[`${k}_outro`] ? `Outro: ${r[`${k}_outro`].trim()}` : x));
    if (v === 'Outro' && r[`${k}_outro`]) return `Outro: ${r[`${k}_outro`].trim()}`;
    return v ?? null;
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      const payload = {
        nome: r.nome.trim(),
        ddi: pais.ddi,
        telefone: digits,
        telefone_formatado: telFormatado,
        unidade: r.unidade,
        plano: comOutro('plano', r.plano),
        motivos: comOutro('motivos', r.motivos ?? []),
        detalhamento: r.detalhamento?.trim() || null,
        problemas: comOutro('problemas', r.problemas ?? []),
        acompanhamento: r.acompanhamento ?? null,
        evolucao: r.evolucao ?? null,
        nota: r.nota ?? null,
        pontos_positivos: r.pontos_positivos?.trim() || null,
        evitaria_saida: r.evitaria_saida?.trim() || null,
        solucoes_retencao: comOutro('solucoes_retencao', r.solucoes_retencao ?? []),
        vai_treinar_outro_local: r.vai_treinar_outro_local ?? null,
        proxima_escolha: r.proxima_escolha?.trim() || null,
        fator_escolha: comOutro('fator_escolha', r.fator_escolha),
        aceita_contato_antes: r.aceita_contato_antes ? r.aceita_contato_antes === 'Sim' : null,
        aceita_contato_futuro: r.aceita_contato_futuro ? r.aceita_contato_futuro === 'Sim' : null,
      };
      const { data, error } = await supabase.functions.invoke('cancelamento-solicitacao', { body: payload });
      if (error || !data?.success) throw error ?? new Error('falha');
      localStorage.removeItem(DRAFT_KEY);
      setStep(TOTAL + 1);
    } catch {
      toast.error('Não foi possível enviar agora. Verifique sua conexão e tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const finalizar = () => {
    setR({ pais: 'BR', motivos: [], problemas: [], solucoes_retencao: [] });
    setStep(0);
  };

  const etapaAtual = step < TOTAL ? ETAPAS[step] : null;
  const pct = step < TOTAL ? Math.round(((step + 1) / TOTAL) * 100) : 100;

  /* ---------- render do campo ---------- */

  const renderCampo = (e: Etapa) => {
    switch (e.tipo) {
      case 'contato':
        return (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="nome" className="text-sm font-semibold text-[#344054]">Seu nome <span className="text-[#0A6CFF]">*</span></label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#98A2B3]" />
                <Input
                  id="nome"
                  autoFocus
                  autoComplete="name"
                  maxLength={120}
                  placeholder="Digite seu nome"
                  value={r.nome ?? ''}
                  onChange={(ev) => set('nome', ev.target.value.toUpperCase())}
                  className={cn(fieldClass, 'pl-11')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="telefone" className="text-sm font-semibold text-[#344054]">WhatsApp <span className="text-[#0A6CFF]">*</span></label>
              <div className="flex gap-2">
                <Popover open={paisOpen} onOpenChange={setPaisOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Selecionar país"
                      className="flex h-14 shrink-0 items-center gap-1.5 rounded-xl border border-[#E4E7EC] bg-white px-3 text-base text-[#0F172A] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#FAFBFC] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0A6CFF]/15"
                    >
                      <span className="text-xl leading-none">{pais.flag}</span>
                      <span className="font-medium">{pais.ddi}</span>
                      <ChevronDown className="h-4 w-4 text-[#98A2B3]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 border-[#E4E7EC] bg-white p-1">
                    <div className="max-h-72 overflow-y-auto">
                      {PAISES.map((p) => (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => { set('pais', p.code); set('telefone', ''); setPaisOpen(false); setTimeout(() => telRef.current?.focus(), 50); }}
                          className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#344054] hover:bg-[#F2F4F7]', p.code === pais.code && 'bg-[#0A6CFF]/[0.06] font-semibold text-[#0F172A]')}
                        >
                          <span className="text-lg">{p.flag}</span>
                          <span className="flex-1">{p.nome}</span>
                          <span className="text-[#667085]">{p.ddi}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="relative flex-1">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#98A2B3]" />
                  <Input
                    id="telefone"
                    ref={telRef}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="Apenas números"
                    value={isBR ? maskBR(r.telefone ?? '') : (r.telefone ?? '')}
                    onChange={(ev) => set('telefone', ev.target.value.replace(/\D/g, '').slice(0, isBR ? 11 : 15))}
                    className={cn(fieldClass, 'pl-11')}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="unidade" className="text-sm font-semibold text-[#344054]">Unidade <span className="text-[#0A6CFF]">*</span></label>
              <div className="relative">
                <select
                  id="unidade"
                  value={r.unidade ?? ''}
                  onChange={(ev) => set('unidade', ev.target.value)}
                  className={cn(fieldClass, 'w-full appearance-none rounded-xl border border-[#E4E7EC] bg-white px-4 pr-11 text-base', !r.unidade && 'text-[#98A2B3]')}
                >
                  <option value="" disabled>Selecione sua unidade</option>
                  {UNIDADES.map((u) => <option key={u} value={u} className="text-[#0F172A]">{u}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              </div>
            </div>
          </div>
        );
      case 'unidade':
        return (
          <div className="grid gap-3">
            {e.opcoes!.map((op) => (
              <OptionCard key={op} label={op} selected={r.unidade === op} onClick={() => set('unidade', op)} />
            ))}
          </div>
        );
      case 'single':
        return (
          <div className="space-y-3">
            <div className={cn('grid gap-3', e.opcoes!.length > 6 && 'sm:grid-cols-2')}>
              {e.opcoes!.map((op) => (
                <OptionCard key={op} label={op} selected={r[e.key] === op} onClick={() => set(e.key, op)} />
              ))}
            </div>
            {e.outro && r[e.key] === 'Outro' && (
              <Input autoFocus maxLength={200} placeholder="Descreva" value={r[`${e.key}_outro`] ?? ''}
                onChange={(ev) => set(`${e.key}_outro`, ev.target.value.toUpperCase())} className={fieldClass} />
            )}
          </div>
        );
      case 'multi':
        return (
          <div className="space-y-3">
            <p className="text-sm text-[#667085]">Marque todas as opções que se aplicam.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {e.opcoes!.map((op) => (
                <OptionCard key={op} multi label={op} selected={(r[e.key] ?? []).includes(op)} onClick={() => toggleMulti(e, op)} />
              ))}
            </div>
            {e.outro && (r[e.key] ?? []).includes('Outro') && (
              <Input autoFocus maxLength={200} placeholder="Descreva" value={r[`${e.key}_outro`] ?? ''}
                onChange={(ev) => set(`${e.key}_outro`, ev.target.value.toUpperCase())} className={fieldClass} />
            )}
          </div>
        );
      case 'paragrafo':
        return (
          <div className="space-y-2">
            <Textarea
              autoFocus
              rows={6}
              maxLength={2000}
              placeholder="Escreva sua resposta (opcional)"
              value={r[e.key] ?? ''}
              onChange={(ev) => set(e.key, ev.target.value.toUpperCase())}
              className="min-h-[160px] rounded-xl border-[#E4E7EC] bg-white p-4 text-base text-[#0F172A] placeholder:text-[#98A2B3] focus-visible:border-[#0A6CFF] focus-visible:ring-4 focus-visible:ring-[#0A6CFF]/15 focus-visible:ring-offset-0"
            />
            <p className="text-right text-xs text-[#98A2B3]">{(r[e.key] ?? '').length}/2000</p>
          </div>
        );
      case 'curto':
        return (
          <Input autoFocus maxLength={300} placeholder="Digite sua resposta (opcional)" value={r[e.key] ?? ''}
            onChange={(ev) => set(e.key, ev.target.value.toUpperCase())} className={fieldClass} />
        );
      case 'escala':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
              {Array.from({ length: 11 }, (_, n) => {
                const sel = r.nota === n;
                const tom = n <= 6 ? 'hover:border-[#F04438]' : n <= 8 ? 'hover:border-[#F79009]' : 'hover:border-[#12B76A]';
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set('nota', n)}
                    aria-pressed={sel}
                    className={cn(
                      'flex h-14 items-center justify-center rounded-xl border text-lg font-bold transition-all active:scale-95',
                      sel ? 'border-[#0A6CFF] bg-[#0A6CFF] text-white shadow-[0_6px_16px_-6px_rgba(10,108,255,0.6)]' : cn('border-[#E4E7EC] bg-white text-[#344054]', tom),
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs font-medium text-[#667085]">
              <span>0 · Muito insatisfeito</span>
              <span>10 · Muito satisfeito</span>
            </div>
          </div>
        );
    }
  };

  /* ---------- revisão ---------- */

  const revisao = useMemo(() => [
    ['Nome', r.nome],
    ['Telefone', telFormatado],
    ['Unidade', r.unidade],
    ['Plano', comOutro('plano', r.plano)],
    ['Motivo principal', (comOutro('motivos', r.motivos ?? []) as string[]).join(', ')],
    ['Contato antes do cancelamento', r.aceita_contato_antes],
    ['Contato futuro', r.aceita_contato_futuro],
  ], [r, telFormatado]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- layout ---------- */

  return (
    <div className="min-h-screen bg-[#F4F5F7] px-4 py-8 text-[#0F172A] sm:py-14" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
      <div className="mx-auto w-full max-w-[760px]">
        <div className="overflow-hidden rounded-[28px] border border-[#EAECF0] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06),0_24px_48px_-24px_rgba(16,24,40,0.12)]">
          {/* Cabeçalho */}
          <header className="flex justify-center bg-black px-6 py-6 sm:py-7">
            <img src={evoClubLogo.url} alt="EVO Club" className="h-auto w-44 object-contain sm:w-56" />
          </header>

          {step === TOTAL + 1 ? (
            <div className="animate-fade-in px-6 py-14 text-center sm:px-12">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#12B76A]/10">
                <CheckCircle2 className="h-9 w-9 text-[#12B76A]" />
              </div>
              <h1 className="text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">Solicitação recebida.</h1>
              <div className="mx-auto mt-5 max-w-md space-y-3 text-[15px] leading-relaxed text-[#475467]">
                <p>Obrigado por compartilhar sua experiência com a EVO Club.</p>
                <p>Suas respostas são importantes para entendermos como podemos melhorar.</p>
                <p>Nossa equipe dará sequência à sua solicitação conforme as condições do seu plano.</p>
              </div>
              <button onClick={finalizar} className="mt-10 inline-flex h-14 items-center justify-center rounded-xl bg-[#0A6CFF] px-10 text-base font-semibold text-white shadow-[0_8px_20px_-8px_rgba(10,108,255,0.7)] transition hover:bg-[#075CE0] active:scale-[0.98]">
                Finalizar
              </button>
            </div>
          ) : (
            <>
              {/* Título */}
              <section className="px-6 pt-9 text-center sm:px-12">
                <h1 className="text-[28px] font-extrabold uppercase leading-[1.1] tracking-tight sm:text-[40px]">
                  Formulário de cancelamento
                </h1>
                {step === 0 && (
                  <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#667085]">
                    Sentimos que sua jornada conosco esteja chegando ao fim. Este formulário serve para entender sua experiência e o que podemos melhorar. Suas respostas são tratadas com atenção e usadas para evoluir nosso atendimento, acompanhamento e estrutura. Leva poucos minutos.
                  </p>
                )}
              </section>

              {/* Progresso */}
              <section className="px-6 pt-7 sm:px-12">
                <div className="rounded-2xl border border-[#EEF0F3] bg-[#F8F9FB] px-5 py-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#344054]">
                      {step < TOTAL ? `Etapa ${step + 1} de ${TOTAL}` : 'Revisão final'}
                    </span>
                    <span className="font-medium text-[#0A6CFF]">{pct}% concluído</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#E4E7EC]">
                    <div className="h-full rounded-full bg-[#0A6CFF] transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </section>

              {/* Conteúdo */}
              <section key={step} className="animate-fade-in px-6 pb-8 pt-8 sm:px-12">
                {etapaAtual ? (
                  <>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0A6CFF]">Pergunta {step + 1}</p>
                    <h2 className="mb-6 text-xl font-bold leading-snug text-[#0F172A] sm:text-2xl">
                      {etapaAtual.titulo}
                      {etapaAtual.obrigatorio && <span className="text-[#0A6CFF]"> *</span>}
                    </h2>
                    {renderCampo(etapaAtual)}
                  </>
                ) : (
                  <>
                    <h2 className="mb-2 text-xl font-bold sm:text-2xl">Revise suas informações</h2>
                    <p className="mb-6 text-sm text-[#667085]">Confira os dados antes de enviar sua solicitação.</p>
                    <dl className="divide-y divide-[#F2F4F7] overflow-hidden rounded-2xl border border-[#EAECF0]">
                      {revisao.map(([k, v]) => (
                        <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr] sm:gap-4">
                          <dt className="text-sm font-medium text-[#667085]">{k}</dt>
                          <dd className="text-[15px] font-semibold text-[#0F172A]">{v || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}

                {erro && <p role="alert" className="mt-4 text-sm font-medium text-[#D92D20]">{erro}</p>}

                {(step === 0 || step === TOTAL) && (
                  <p className="mt-6 rounded-xl bg-[#F8F9FB] px-4 py-3 text-center text-xs leading-relaxed text-[#667085]">
                    O envio deste formulário registra uma solicitação de cancelamento. A conclusão seguirá as condições contratuais aplicáveis ao plano do aluno.
                  </p>
                )}
              </section>

              {/* Rodapé */}
              <footer className="sticky bottom-0 border-t border-[#F2F4F7] bg-white/95 px-6 pb-5 pt-5 backdrop-blur sm:static sm:px-12 sm:pb-7">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={voltar}
                    disabled={step === 0 || enviando}
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-5 text-[15px] font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {step === TOTAL ? 'Voltar e revisar' : 'Voltar'}
                  </button>
                  {step < TOTAL ? (
                    <button
                      type="button"
                      onClick={avancar}
                      className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#0A6CFF] px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(10,108,255,0.7)] transition hover:bg-[#075CE0] active:scale-[0.98]"
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={enviar}
                      disabled={enviando}
                      className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#0A6CFF] px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(10,108,255,0.7)] transition hover:bg-[#075CE0] disabled:opacity-60"
                    >
                      {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar solicitação
                    </button>
                  )}
                </div>
                {step < TOTAL && (
                  <p className="mt-4 hidden text-center text-xs text-[#98A2B3] sm:block">
                    Pressione <kbd className="rounded border border-[#E4E7EC] bg-[#F9FAFB] px-1.5 py-0.5 font-sans font-semibold text-[#667085]">Enter</kbd> para continuar
                  </p>
                )}
              </footer>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-[#98A2B3]">© EVO Club</p>
      </div>

      {/* Confirmação do telefone */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-[#EAECF0] bg-white p-7 text-center text-[#0F172A]">
          <DialogHeader className="items-center space-y-3 text-center sm:text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0A6CFF]/10">
              <Phone className="h-5 w-5 text-[#0A6CFF]" />
            </div>
            <DialogTitle className="text-xl font-bold">Confirme seu WhatsApp</DialogTitle>
            <DialogDescription className="sr-only">Confirme se o número informado está correto.</DialogDescription>
          </DialogHeader>
          <p className="rounded-xl bg-[#F8F9FB] py-4 text-xl font-bold tracking-wide">{pais.flag} {telFormatado}</p>
          <p className="text-sm text-[#667085]">Este número está correto?</p>
          <div className="mt-2 grid gap-2">
            <button
              autoFocus
              onClick={() => { setConfirmOpen(false); setStep(1); }}
              className="h-12 rounded-xl bg-[#0A6CFF] text-[15px] font-semibold text-white transition hover:bg-[#075CE0]"
            >
              Confirmar e continuar
            </button>
            <button
              onClick={() => { setConfirmOpen(false); setTimeout(() => telRef.current?.focus(), 100); }}
              className="h-12 rounded-xl border border-[#E4E7EC] bg-white text-[15px] font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
            >
              Editar telefone
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
