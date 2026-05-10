import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  Users, Calendar, DollarSign, UserMinus, Sparkles, MessageSquare, ThumbsUp, ThumbsDown,
  Wrench, Wind, Sparkle, Building2, HeartHandshake, Activity, Star,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, Legend,
} from 'recharts';
import { useDashboardOperacionalData } from '@/hooks/useDashboardOperacionalData';

// ============ MOCK DATA ============
const mock = {
  visaoGeral: {
    alunosAtivosZN: 200,
    alunosAtivosZS: 225,
    experimentaisHoje: { ZN: 4, ZS: 3 },
    fechamentosHoje: { ZN: 2, ZS: 1 },
    cancelamentosHoje: { ZN: 1, ZS: 0 },
    semana: [
      { dia: 'Seg', leads: 18, experimentais: 6, fechamentos: 2 },
      { dia: 'Ter', leads: 22, experimentais: 8, fechamentos: 3 },
      { dia: 'Qua', leads: 15, experimentais: 5, fechamentos: 1 },
      { dia: 'Qui', leads: 28, experimentais: 9, fechamentos: 4 },
      { dia: 'Sex', leads: 24, experimentais: 7, fechamentos: 3 },
      { dia: 'Sáb', leads: 12, experimentais: 4, fechamentos: 1 },
      { dia: 'Dom', leads: 6, experimentais: 0, fechamentos: 0 },
    ],
    comparativo: [
      { metrica: 'Ativos', ZN: 200, ZS: 225 },
      { metrica: 'Experimentais', ZN: 4, ZS: 3 },
      { metrica: 'Fechamentos', ZN: 2, ZS: 1 },
      { metrica: 'Cancelamentos', ZN: 1, ZS: 0 },
    ],
  },
  recepcao: {
    leadsRecebidos: 24,
    experimentaisRealizadas: 7,
    novosFechamentos: 3,
    renovacoes: 5,
    cancelamentos: 1,
    inadimplentes: 12,
    naoRenovados: 4,
    atividades: [
      'Atendimento de leads via WhatsApp',
      'Confirmação de experimentais',
      'Cobrança de inadimplentes',
      'Recepção de visitantes',
      'Atualização de cadastros no CRM',
      'Renovações de planos',
    ],
    pendencias: [
      'Não consegui finalizar follow-up de 3 leads — alta demanda no balcão.',
      'Faltou confirmar 2 experimentais para amanhã — sem retorno do cliente.',
    ],
    planejamento: [
      'Concluir follow-ups pendentes do dia anterior',
      'Confirmar todas as experimentais da semana',
      'Cobrar mensalidades em atraso (lista até quinta)',
      'Atualizar status no CRM dos novos fechamentos',
    ],
    suporte: 'Necessário 1 maquininha extra de cartão na recepção — cliente esperou 8 minutos hoje.',
  },
  estagiario: {
    turnos: [
      {
        nome: 'Manhã',
        ocorrencias: { tem: false, descricao: '' },
        padraoAtendimento: true,
        destaquePositivo: { nome: 'João Silva', descricao: 'Excelente atendimento na recepção da experimental.' },
        feedbackCorretivo: { nome: '', descricao: '' },
        climaEquipe: 5,
        equipamentos: [],
        feedbacksAlunos: { positivos: ['Aluno elogiou pontualidade do treinador'], negativos: [] },
        padraoIron: true,
        autoavaliacao: { faria: 'Conferir agenda 30 min antes para evitar correria.', suporte: '' },
      },
      {
        nome: 'Tarde',
        ocorrencias: { tem: true, descricao: 'Aluno se desentendeu na recepção sobre horário.' },
        padraoAtendimento: true,
        destaquePositivo: { nome: 'Pedro Almeida', descricao: 'Resolveu situação com aluno de forma calma e profissional.' },
        feedbackCorretivo: { nome: 'Marcelo R.', descricao: 'Atrasou 10 min para iniciar atendimento.' },
        climaEquipe: 4,
        equipamentos: [{ nome: 'Esteira 02', descricao: 'Display piscando intermitentemente.' }],
        feedbacksAlunos: { positivos: ['Aluna parabenizou organização'], negativos: ['Reclamação sobre fila no banheiro'] },
        padraoIron: true,
        autoavaliacao: { faria: 'Antecipar a abertura do segundo balcão.', suporte: 'Pedi apoio do coordenador para resolver discussão.' },
      },
      {
        nome: 'Noite',
        ocorrencias: { tem: false, descricao: '' },
        padraoAtendimento: true,
        destaquePositivo: { nome: 'Rafael Souza', descricao: 'Ajudou nova aluna em todo o circuito.' },
        feedbackCorretivo: { nome: '', descricao: '' },
        climaEquipe: 4,
        equipamentos: [],
        feedbacksAlunos: { positivos: ['Aluno elogiou energia da equipe'], negativos: [] },
        padraoIron: true,
        autoavaliacao: { faria: 'Nada a alterar, fluxo bom.', suporte: '' },
      },
    ],
  },
  coordHorario: {
    turnos: [
      {
        nome: 'Manhã',
        atendimentosTreinador: [{ nome: 'João', qtd: 8 }, { nome: 'Pedro', qtd: 7 }, { nome: 'Rafael', qtd: 6 }],
        experimentais: 3,
        notaGeral: 4,
        ocorrencias: [{ tipo: 'Equipamento', gravidade: 'baixa', descricao: 'Halteres fora do lugar', status: 'resolvido' }],
        feedbacks: { positivos: ['Aluno elogiou treino'], negativos: [] },
        destaqueTreinador: 'João',
        feedbackCorretivoNome: '',
        salaOrganizada: true,
        pendenciasSala: '',
      },
      {
        nome: 'Tarde',
        atendimentosTreinador: [{ nome: 'Lucas', qtd: 9 }, { nome: 'Bruno', qtd: 8 }],
        experimentais: 2,
        notaGeral: 3,
        ocorrencias: [{ tipo: 'Comportamento', gravidade: 'média', descricao: 'Aluno reclamou de outro aluno na esteira', status: 'resolvido' }],
        feedbacks: { positivos: [], negativos: ['Reclamação sobre temperatura da sala'] },
        destaqueTreinador: 'Lucas',
        feedbackCorretivoNome: 'Bruno — chegou 5 min atrasado',
        salaOrganizada: false,
        pendenciasSala: 'Anilhas espalhadas na sala de musculação.',
      },
      {
        nome: 'Noite',
        atendimentosTreinador: [{ nome: 'Marcos', qtd: 7 }, { nome: 'Rafael', qtd: 6 }],
        experimentais: 2,
        notaGeral: 5,
        ocorrencias: [],
        feedbacks: { positivos: ['Equipe muito atenciosa', 'Recepção rápida'], negativos: [] },
        destaqueTreinador: 'Marcos',
        feedbackCorretivoNome: '',
        salaOrganizada: true,
        pendenciasSala: '',
      },
    ],
  },
  coordUnidade: {
    avaliacoes: {
      limpeza: 4.2,
      equipamentos: 3.8,
      climatizacao: 4.5,
      organizacao: 4.0,
      infraestrutura: 4.3,
      postura: 4.6,
      proatividade: 4.1,
      notaGeral: 4.2,
    },
    presenca: [
      { nome: 'João Silva', status: 'presente' },
      { nome: 'Pedro Almeida', status: 'presente' },
      { nome: 'Rafael Souza', status: 'atrasou' },
      { nome: 'Marcelo R.', status: 'faltou' },
      { nome: 'Lucas Mendes', status: 'presente' },
      { nome: 'Bruno Lima', status: 'presente' },
    ],
    destaques: {
      positivos: [
        { nome: 'João Silva', descricao: 'Sempre proativo com novos alunos.' },
        { nome: 'Lucas Mendes', descricao: 'Conduziu 9 atendimentos sem queixas.' },
      ],
      corretivos: [{ nome: 'Marcelo R.', descricao: 'Falta sem aviso prévio.' }],
    },
    ocorrencias: [
      { gravidade: 'baixa', descricao: 'Halteres fora do lugar', acao: 'Equipe organizou no fim do turno', status: 'resolvido' },
      { gravidade: 'média', descricao: 'Discussão entre alunos', acao: 'Coordenador interveio e separou', status: 'resolvido' },
    ],
    reclamacoes: ['Temperatura da sala de musculação muito alta às 18h.'],
    elogios: ['Equipe da recepção super atenciosa.', 'Treinador Lucas elogiado por 2 alunos.'],
    padraoIron: true,
    fechamento: {
      pontosAtencao: ['Verificar ar-condicionado da musculação.', 'Repor papel toalha nos vestiários.'],
      pendencias: ['Pintura do corredor agendada para sábado.'],
    },
  },
};

// ============ HELPERS ============
const COR_PRIMARIA = '#0033FF';
const COR_SECUNDARIA = '#00C2FF';

function KpiCard({ icon: Icon, label, value, sub, accent }: any) {
  return (
    <Card className="bg-white shadow-sm border-0 rounded-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold mt-2" style={{ color: accent || '#0F172A' }}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${COR_PRIMARIA}10` }}>
            <Icon className="w-5 h-5" style={{ color: COR_PRIMARIA }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className="w-4 h-4" fill={i < n ? COR_PRIMARIA : 'transparent'} stroke={i < n ? COR_PRIMARIA : '#CBD5E1'} />
      ))}
    </div>
  );
}

function GravidadeBadge({ g }: { g: string }) {
  const map: Record<string, string> = {
    baixa: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    média: 'bg-amber-100 text-amber-700 border-amber-200',
    alta: 'bg-red-100 text-red-700 border-red-200',
  };
  return <Badge variant="outline" className={map[g] || ''}>{g.toUpperCase()}</Badge>;
}

function StatusBadge({ s }: { s: string }) {
  const ok = s === 'resolvido' || s === 'presente';
  const warn = s === 'atrasou';
  return (
    <Badge variant="outline" className={
      ok ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : warn ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-red-100 text-red-700 border-red-200'
    }>{s.toUpperCase()}</Badge>
  );
}

function YesNoBadge({ ok, labelOk = 'SIM', labelNo = 'NÃO' }: { ok: boolean; labelOk?: string; labelNo?: string }) {
  return ok ? (
    <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3 mr-1" /> {labelOk}
    </Badge>
  ) : (
    <Badge className="bg-red-100 text-red-700 border border-red-200">
      <XCircle className="w-3 h-3 mr-1" /> {labelNo}
    </Badge>
  );
}

// ============ PAGE ============
export default function DashboardOperacional() {
  const { isAdmin, loading } = useAuth();
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('hoje');
  const [unidade, setUnidade] = useState<'todas' | 'ZN' | 'ZS'>('todas');

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const v = mock.visaoGeral;
  const totalAtivos = v.alunosAtivosZN + v.alunosAtivosZS;
  const expHoje = (unidade === 'ZN' ? v.experimentaisHoje.ZN : unidade === 'ZS' ? v.experimentaisHoje.ZS : v.experimentaisHoje.ZN + v.experimentaisHoje.ZS);
  const fechHoje = (unidade === 'ZN' ? v.fechamentosHoje.ZN : unidade === 'ZS' ? v.fechamentosHoje.ZS : v.fechamentosHoje.ZN + v.fechamentosHoje.ZS);
  const cancHoje = (unidade === 'ZN' ? v.cancelamentosHoje.ZN : unidade === 'ZS' ? v.cancelamentosHoje.ZS : v.cancelamentosHoje.ZN + v.cancelamentosHoje.ZS);
  const ativos = (unidade === 'ZN' ? v.alunosAtivosZN : unidade === 'ZS' ? v.alunosAtivosZS : totalAtivos);

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FF', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* HEADER */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: COR_PRIMARIA }}>Iron Club · Dashboard Operacional</h1>
              <p className="text-xs text-muted-foreground">Visão consolidada de operação · Recife</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border bg-white p-1">
              {(['hoje', 'semana', 'mes'] as const).map((p) => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${periodo === p ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  style={periodo === p ? { background: COR_PRIMARIA } : {}}>
                  {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border bg-white p-1">
              {([['todas', 'Todas'], ['ZN', 'Zona Norte'], ['ZS', 'Zona Sul']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setUnidade(k as any)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${unidade === k ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  style={unidade === k ? { background: COR_PRIMARIA } : {}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="visao" className="space-y-6">
          <TabsList className="bg-white border shadow-sm h-auto p-1 rounded-xl flex-wrap">
            <TabsTrigger value="visao" className="data-[state=active]:text-white data-[state=active]:shadow" style={{ ['--tw-bg' as any]: COR_PRIMARIA }}>Visão Geral</TabsTrigger>
            <TabsTrigger value="recepcao">Recepção</TabsTrigger>
            <TabsTrigger value="estagiario">Estagiário Líder</TabsTrigger>
            <TabsTrigger value="horario">Coordenador de Horário</TabsTrigger>
            <TabsTrigger value="unidade">Coordenador de Unidade</TabsTrigger>
          </TabsList>

          {/* === VISÃO GERAL === */}
          <TabsContent value="visao" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Users} label="Alunos ativos" value={ativos} sub={unidade === 'todas' ? `ZN ${v.alunosAtivosZN} · ZS ${v.alunosAtivosZS}` : ''} />
              <KpiCard icon={Calendar} label="Experimentais hoje" value={expHoje} sub={unidade === 'todas' ? `ZN ${v.experimentaisHoje.ZN} · ZS ${v.experimentaisHoje.ZS}` : ''} />
              <KpiCard icon={DollarSign} label="Novos fechamentos" value={fechHoje} sub={unidade === 'todas' ? `ZN ${v.fechamentosHoje.ZN} · ZS ${v.fechamentosHoje.ZS}` : ''} />
              <KpiCard icon={UserMinus} label="Cancelamentos" value={cancHoje} sub="Hoje" accent="#DC2626" />
            </div>

            <Card className="bg-white shadow-sm border-0 rounded-xl">
              <CardHeader><CardTitle className="text-base">Evolução semanal</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={v.semana}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="dia" stroke="#64748B" fontSize={12} />
                      <YAxis stroke="#64748B" fontSize={12} />
                      <RTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="leads" stroke={COR_PRIMARIA} strokeWidth={2.5} dot={{ r: 4 }} name="Leads recebidos" />
                      <Line type="monotone" dataKey="experimentais" stroke={COR_SECUNDARIA} strokeWidth={2.5} dot={{ r: 4 }} name="Experimentais" />
                      <Line type="monotone" dataKey="fechamentos" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} name="Fechamentos" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-0 rounded-xl">
              <CardHeader><CardTitle className="text-base">Comparativo Zona Norte × Zona Sul</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={v.comparativo}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="metrica" stroke="#64748B" fontSize={12} />
                      <YAxis stroke="#64748B" fontSize={12} />
                      <RTooltip />
                      <Legend />
                      <Bar dataKey="ZN" fill={COR_PRIMARIA} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="ZS" fill={COR_SECUNDARIA} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === RECEPÇÃO === */}
          <TabsContent value="recepcao" className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <KpiCard icon={MessageSquare} label="Leads recebidos" value={mock.recepcao.leadsRecebidos} />
              <KpiCard icon={Calendar} label="Experimentais" value={mock.recepcao.experimentaisRealizadas} />
              <KpiCard icon={DollarSign} label="Novos fechados" value={mock.recepcao.novosFechamentos} />
              <KpiCard icon={Sparkles} label="Renovações" value={mock.recepcao.renovacoes} />
              <KpiCard icon={UserMinus} label="Cancelamentos" value={mock.recepcao.cancelamentos} accent="#DC2626" />
              <KpiCard icon={AlertTriangle} label="Inadimplentes" value={mock.recepcao.inadimplentes} accent="#D97706" />
              <KpiCard icon={TrendingDown} label="Não renovados" value={mock.recepcao.naoRenovados} accent="#D97706" />
            </div>

            <Card className="bg-white shadow-sm border-0 rounded-xl">
              <CardHeader><CardTitle className="text-base">Atividades realizadas no dia</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {mock.recepcao.atividades.map((a) => (
                  <Badge key={a} className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 py-1.5 px-3">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {a}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-white shadow-sm border-0 rounded-xl">
                <CardHeader><CardTitle className="text-base">Pendências do dia</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {mock.recepcao.pendencias.map((p, i) => (
                    <div key={i} className="flex gap-2 text-sm p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-slate-700">{p}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-white shadow-sm border-0 rounded-xl">
                <CardHeader><CardTitle className="text-base">Planejamento de amanhã</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {mock.recepcao.planejamento.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: COR_PRIMARIA }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {mock.recepcao.suporte && (
              <Card className="bg-white shadow-sm border-0 rounded-xl border-l-4" style={{ borderLeftColor: '#DC2626' }}>
                <CardContent className="p-5 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Solicitação de suporte</p>
                    <p className="text-sm text-slate-700 mt-1">{mock.recepcao.suporte}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* === ESTAGIÁRIO LÍDER === */}
          <TabsContent value="estagiario" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {mock.estagiario.turnos.map((t) => (
                <Card key={t.nome} className="bg-white shadow-sm border-0 rounded-xl">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base" style={{ color: COR_PRIMARIA }}>{t.nome}</CardTitle>
                    <Stars n={t.climaEquipe} />
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ocorrências</span>
                      <YesNoBadge ok={!t.ocorrencias.tem} labelOk="NENHUMA" labelNo="SIM" />
                    </div>
                    {t.ocorrencias.tem && <p className="text-xs text-slate-600 -mt-2 italic">{t.ocorrencias.descricao}</p>}

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Padrão de atendimento</span>
                      <YesNoBadge ok={t.padraoAtendimento} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Operação dentro do padrão Iron</span>
                      <YesNoBadge ok={t.padraoIron} />
                    </div>

                    {t.destaquePositivo.nome && (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Destaque positivo</p>
                        <p className="text-sm font-medium text-slate-800 mt-1">{t.destaquePositivo.nome}</p>
                        <p className="text-xs text-slate-600">{t.destaquePositivo.descricao}</p>
                      </div>
                    )}

                    {t.feedbackCorretivo.nome && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                        <p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> Feedback corretivo</p>
                        <p className="text-sm font-medium text-slate-800 mt-1">{t.feedbackCorretivo.nome}</p>
                        <p className="text-xs text-slate-600">{t.feedbackCorretivo.descricao}</p>
                      </div>
                    )}

                    {t.equipamentos.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1"><Wrench className="w-3 h-3" /> Equipamentos com problema</p>
                        {t.equipamentos.map((e: any, i: number) => (
                          <div key={i} className="text-xs text-slate-600 pl-4">• <b>{e.nome}:</b> {e.descricao}</div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-emerald-50">
                        <p className="text-[10px] font-semibold text-emerald-700">Feedbacks +</p>
                        {t.feedbacksAlunos.positivos.length === 0 && <p className="text-xs text-slate-500">—</p>}
                        {t.feedbacksAlunos.positivos.map((f: string, i: number) => <p key={i} className="text-xs text-slate-700">• {f}</p>)}
                      </div>
                      <div className="p-2 rounded bg-red-50">
                        <p className="text-[10px] font-semibold text-red-700">Feedbacks −</p>
                        {t.feedbacksAlunos.negativos.length === 0 && <p className="text-xs text-slate-500">—</p>}
                        {t.feedbacksAlunos.negativos.map((f: string, i: number) => <p key={i} className="text-xs text-slate-700">• {f}</p>)}
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-1">
                      <p className="text-xs font-semibold text-slate-700">Autoavaliação</p>
                      <p className="text-xs text-slate-600"><b>Faria diferente:</b> {t.autoavaliacao.faria || '—'}</p>
                      {t.autoavaliacao.suporte && <p className="text-xs text-slate-600"><b>Precisou suporte:</b> {t.autoavaliacao.suporte}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* === COORDENADOR HORÁRIO === */}
          <TabsContent value="horario" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {mock.coordHorario.turnos.map((t) => (
                <Card key={t.nome} className="bg-white shadow-sm border-0 rounded-xl">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base" style={{ color: COR_PRIMARIA }}>{t.nome}</CardTitle>
                    <Stars n={t.notaGeral} />
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">Atendimentos por treinador</p>
                      <div className="space-y-1.5">
                        {t.atendimentosTreinador.map((a) => {
                          const max = Math.max(...t.atendimentosTreinador.map((x) => x.qtd));
                          return (
                            <div key={a.nome} className="flex items-center gap-2">
                              <span className="text-xs w-16 text-slate-600">{a.nome}</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${(a.qtd / max) * 100}%`, background: COR_PRIMARIA }} />
                              </div>
                              <span className="text-xs font-semibold w-6 text-right">{a.qtd}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Experimentais no turno</span>
                      <Badge style={{ background: COR_PRIMARIA }} className="text-white">{t.experimentais}</Badge>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1.5">Ocorrências</p>
                      {t.ocorrencias.length === 0 && <p className="text-xs text-emerald-700">Nenhuma ocorrência</p>}
                      {t.ocorrencias.map((o, i) => (
                        <div key={i} className="text-xs p-2 rounded bg-slate-50 mb-1">
                          <div className="flex gap-1.5 mb-1"><GravidadeBadge g={o.gravidade} /><StatusBadge s={o.status} /></div>
                          <p className="text-slate-700"><b>{o.tipo}:</b> {o.descricao}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-emerald-50">
                        <p className="text-[10px] font-semibold text-emerald-700">Feedbacks +</p>
                        {t.feedbacks.positivos.length === 0 && <p className="text-xs text-slate-500">—</p>}
                        {t.feedbacks.positivos.map((f, i) => <p key={i} className="text-xs text-slate-700">• {f}</p>)}
                      </div>
                      <div className="p-2 rounded bg-red-50">
                        <p className="text-[10px] font-semibold text-red-700">Feedbacks −</p>
                        {t.feedbacks.negativos.length === 0 && <p className="text-xs text-slate-500">—</p>}
                        {t.feedbacks.negativos.map((f, i) => <p key={i} className="text-xs text-slate-700">• {f}</p>)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs"><b className="text-emerald-700">Destaque:</b> {t.destaqueTreinador}</p>
                      {t.feedbackCorretivoNome && <p className="text-xs"><b className="text-amber-700">Corretivo:</b> {t.feedbackCorretivoNome}</p>}
                    </div>

                    <div className="flex items-center justify-between border-t pt-3">
                      <span className="text-muted-foreground text-xs">Sala organizada p/ próximo turno</span>
                      <YesNoBadge ok={t.salaOrganizada} />
                    </div>
                    {!t.salaOrganizada && t.pendenciasSala && (
                      <p className="text-xs text-amber-700 italic">⚠ {t.pendenciasSala}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* === COORDENADOR UNIDADE === */}
          <TabsContent value="unidade" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { k: 'limpeza', label: 'Limpeza geral', icon: Sparkle },
                { k: 'equipamentos', label: 'Equipamentos', icon: Wrench },
                { k: 'climatizacao', label: 'Climatização', icon: Wind },
                { k: 'organizacao', label: 'Organização', icon: Building2 },
                { k: 'infraestrutura', label: 'Infraestrutura', icon: Building2 },
                { k: 'postura', label: 'Postura da equipe', icon: HeartHandshake },
                { k: 'proatividade', label: 'Proatividade', icon: Activity },
                { k: 'notaGeral', label: 'Nota geral', icon: Star },
              ].map(({ k, label, icon: Icon }) => {
                const val = (mock.coordUnidade.avaliacoes as any)[k] as number;
                return (
                  <Card key={k} className="bg-white shadow-sm border-0 rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                        <Icon className="w-4 h-4" style={{ color: COR_PRIMARIA }} />
                      </div>
                      <p className="text-2xl font-bold" style={{ color: COR_PRIMARIA }}>{val.toFixed(1)}<span className="text-sm text-muted-foreground">/5</span></p>
                      <Progress value={(val / 5) * 100} className="h-1.5 mt-2" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-white shadow-sm border-0 rounded-xl">
                <CardHeader><CardTitle className="text-base">Presença da equipe</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {mock.coordUnidade.presenca.map((p) => (
                    <div key={p.nome} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                      <span className="text-slate-700">{p.nome}</span>
                      <StatusBadge s={p.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-white shadow-sm border-0 rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Padrão Iron</CardTitle>
                  <YesNoBadge ok={mock.coordUnidade.padraoIron} labelOk="DENTRO DO PADRÃO" labelNo="FORA DO PADRÃO" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">A unidade encerrou o turno mantendo todos os critérios da operação Iron Club.</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-white shadow-sm border-0 rounded-xl">
                <CardHeader><CardTitle className="text-base text-emerald-700 flex items-center gap-2"><ThumbsUp className="w-4 h-4" /> Destaques positivos</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {mock.coordUnidade.destaques.positivos.map((d, i) => (
                    <div key={i} className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                      <p className="text-sm font-medium text-slate-800">{d.nome}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{d.descricao}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-white shadow-sm border-0 rounded-xl">
                <CardHeader><CardTitle className="text-base text-amber-700 flex items-center gap-2"><ThumbsDown className="w-4 h-4" /> Feedbacks corretivos</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {mock.coordUnidade.destaques.corretivos.length === 0 && <p className="text-sm text-slate-500">Sem feedbacks corretivos.</p>}
                  {mock.coordUnidade.destaques.corretivos.map((d, i) => (
                    <div key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <p className="text-sm font-medium text-slate-800">{d.nome}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{d.descricao}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white shadow-sm border-0 rounded-xl">
              <CardHeader><CardTitle className="text-base">Ocorrências do dia</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {mock.coordUnidade.ocorrencias.map((o, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-slate-50">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <GravidadeBadge g={o.gravidade} />
                      <StatusBadge s={o.status} />
                    </div>
                    <p className="text-sm text-slate-700"><b>Descrição:</b> {o.descricao}</p>
                    <p className="text-xs text-slate-600 mt-1"><b>Ação tomada:</b> {o.acao}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-white shadow-sm border-0 rounded-xl">
                <CardHeader><CardTitle className="text-base">Reclamações de alunos</CardTitle></CardHeader>
                <CardContent>
                  {mock.coordUnidade.reclamacoes.length === 0 && <p className="text-sm text-slate-500">Nenhuma.</p>}
                  {mock.coordUnidade.reclamacoes.map((r, i) => (
                    <div key={i} className="text-sm p-2 rounded bg-red-50 border border-red-100 mb-1.5 text-slate-700">{r}</div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-white shadow-sm border-0 rounded-xl">
                <CardHeader><CardTitle className="text-base">Elogios de alunos</CardTitle></CardHeader>
                <CardContent>
                  {mock.coordUnidade.elogios.map((r, i) => (
                    <div key={i} className="text-sm p-2 rounded bg-emerald-50 border border-emerald-100 mb-1.5 text-slate-700">{r}</div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white shadow-sm border-0 rounded-xl">
              <CardHeader><CardTitle className="text-base">Fechamento do dia</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Pontos de atenção para amanhã</p>
                  <ul className="space-y-1.5">
                    {mock.coordUnidade.fechamento.pontosAtencao.map((p, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Pendências abertas</p>
                  <ul className="space-y-1.5">
                    {mock.coordUnidade.fechamento.pendencias.map((p, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: COR_PRIMARIA }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
