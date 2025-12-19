import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Lead, Interacao } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Users, 
  CalendarCheck, 
  UserCheck, 
  GraduationCap,
  Percent,
  Filter,
  TrendingUp,
  Trophy,
  Dumbbell,
  AlertTriangle,
  Award,
  FileDown
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function DashboardExecutivo() {
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const { toast } = useToast();

  // Date filters
  const [dataInicio, setDataInicio] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [dataFim, setDataFim] = useState<string>(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );

  useEffect(() => {
    fetchData();
  }, [dataInicio, dataFim]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch leads in period
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim + 'T23:59:59')
      .eq('ativo', true);

    if (leadsError) {
      toast({ title: 'Erro ao carregar leads', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch all interacoes in period
    const { data: interacoesData, error: interacoesError } = await supabase
      .from('interacoes')
      .select('*')
      .gte('data_interacao', dataInicio)
      .lte('data_interacao', dataFim + 'T23:59:59');

    if (interacoesError) {
      toast({ title: 'Erro ao carregar interações', variant: 'destructive' });
      setLoading(false);
      return;
    }

    setLeads((leadsData || []) as unknown as Lead[]);
    setInteracoes((interacoesData || []) as unknown as Interacao[]);
    setLoading(false);
  };

  // ==================== TOP CARDS ====================
  const topCards = useMemo(() => {
    const leadsDoMes = leads.length;
    const agendamentos = interacoes.filter(i => i.agendou_experimental === true).length;
    const comparecimentos = interacoes.filter(i => i.compareceu === true).length;
    const matriculas = interacoes.filter(i => i.fechou_matricula === true).length;
    const taxaConversao = comparecimentos > 0 ? (matriculas / comparecimentos) * 100 : 0;

    return { leadsDoMes, agendamentos, comparecimentos, matriculas, taxaConversao };
  }, [leads, interacoes]);

  // ==================== FUNIL EXECUTIVO ====================
  const funilExecutivo = useMemo(() => {
    const leadsTotal = leads.length;
    const contatoFeito = interacoes.filter(i => i.atendido_por).length;
    const agendamentos = interacoes.filter(i => i.agendou_experimental === true).length;
    const comparecimentos = interacoes.filter(i => i.compareceu === true).length;
    const matriculas = interacoes.filter(i => i.fechou_matricula === true).length;

    return [
      { etapa: 'Leads', quantidade: leadsTotal, conversao: null },
      { etapa: 'Contato Feito', quantidade: contatoFeito, conversao: leadsTotal > 0 ? (contatoFeito / leadsTotal) * 100 : 0 },
      { etapa: 'Agendamentos', quantidade: agendamentos, conversao: contatoFeito > 0 ? (agendamentos / contatoFeito) * 100 : 0 },
      { etapa: 'Comparecimentos', quantidade: comparecimentos, conversao: agendamentos > 0 ? (comparecimentos / agendamentos) * 100 : 0 },
      { etapa: 'Matrículas', quantidade: matriculas, conversao: comparecimentos > 0 ? (matriculas / comparecimentos) * 100 : 0 },
    ];
  }, [leads, interacoes]);

  // ==================== PADRONIZAÇÃO DE ORIGENS ====================
  const padronizarOrigem = (origem: string | null | undefined): string => {
    if (!origem || origem.trim() === '') return 'Não Informado';
    
    const normalizado = origem.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
    
    // WhatsApp
    if (/^(whats|whasapp|whatspp|whatsapp|wpp|zap|zapzap)/.test(normalizado)) {
      return 'WhatsApp';
    }
    
    // Instagram
    if (/^(insta|instagram|instagran|ig)/.test(normalizado)) {
      return 'Instagram';
    }
    
    // Tráfego Pago
    if (/^(trafego|ads|anuncio|anuncios|google ads|meta ads|facebook ads|campanha|patrocinado)/.test(normalizado) ||
        normalizado.includes('pago') || normalizado.includes('ads')) {
      return 'Tráfego Pago';
    }
    
    // Indicação
    if (/^(indica|idicacao|indicacao|indicacoes)/.test(normalizado) ||
        normalizado.includes('indica')) {
      return 'Indicação';
    }
    
    // Visita Presencial
    if (/^(presencial|visita|pessoalmente|diretamente|unidade|na academia|passou na frente|passando)/.test(normalizado) ||
        normalizado.includes('presencial') || normalizado.includes('visita')) {
      return 'Visita Presencial';
    }
    
    // Terceiros
    if (/^(terceiro|parceiro|empresa|convenio|corporativo|b2b)/.test(normalizado) ||
        normalizado.includes('terceiro') || normalizado.includes('parceiro')) {
      return 'Terceiros';
    }
    
    // Não Informado
    if (/^(nao informado|n[aã]o informado|desconhecido|sem informacao|vazio|null|undefined|-|n\/a)/.test(normalizado)) {
      return 'Não Informado';
    }
    
    // Se não matchou nenhum padrão, retorna a origem original capitalizada
    return origem.trim();
  };

  // ==================== ORIGEM DOS LEADS ====================
  const origemData = useMemo(() => {
    const grouped = new Map<string, { leads: number; matriculas: number }>();
    
    leads.forEach(lead => {
      const origem = padronizarOrigem(lead.origem);
      const current = grouped.get(origem) || { leads: 0, matriculas: 0 };
      grouped.set(origem, { ...current, leads: current.leads + 1 });
    });

    interacoes.filter(i => i.fechou_matricula === true).forEach(int => {
      const lead = leads.find(l => l.id === int.lead_id);
      const origem = padronizarOrigem(lead?.origem);
      const current = grouped.get(origem) || { leads: 0, matriculas: 0 };
      grouped.set(origem, { ...current, matriculas: current.matriculas + 1 });
    });

    return Array.from(grouped.entries()).map(([origem, data]) => ({
      origem,
      leads: data.leads,
      matriculas: data.matriculas,
      conversao: data.leads > 0 ? (data.matriculas / data.leads) * 100 : 0,
    })).sort((a, b) => b.leads - a.leads);
  }, [leads, interacoes]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

  // ==================== AGENDA & PRESENÇA ====================
  const agendaPresenca = useMemo(() => {
    const agendamentosPorData = new Map<string, { agendados: number; compareceram: number }>();
    
    interacoes.filter(i => i.data_experimental).forEach(int => {
      const data = int.data_experimental!;
      const current = agendamentosPorData.get(data) || { agendados: 0, compareceram: 0 };
      agendamentosPorData.set(data, {
        agendados: current.agendados + 1,
        compareceram: current.compareceram + (int.compareceu ? 1 : 0),
      });
    });

    const rows = Array.from(agendamentosPorData.entries())
      .map(([data, stats]) => ({
        data,
        agendados: stats.agendados,
        compareceram: stats.compareceram,
        noShow: stats.agendados > 0 ? ((stats.agendados - stats.compareceram) / stats.agendados) * 100 : 0,
      }))
      .sort((a, b) => b.data.localeCompare(a.data));

    // Summary
    const totalAgendados = rows.reduce((sum, r) => sum + r.agendados, 0);
    const totalCompareceram = rows.reduce((sum, r) => sum + r.compareceram, 0);
    const mediaNoShow = totalAgendados > 0 ? ((totalAgendados - totalCompareceram) / totalAgendados) * 100 : 0;
    
    const melhorDia = rows.length > 0 ? rows.reduce((best, r) => {
      const presenca = r.agendados > 0 ? (r.compareceram / r.agendados) * 100 : 0;
      const bestPresenca = best.agendados > 0 ? (best.compareceram / best.agendados) * 100 : 0;
      return presenca > bestPresenca ? r : best;
    }) : null;

    const piorDia = rows.length > 0 ? rows.reduce((worst, r) => {
      const presenca = r.agendados > 0 ? (r.compareceram / r.agendados) * 100 : 0;
      const worstPresenca = worst.agendados > 0 ? (worst.compareceram / worst.agendados) * 100 : 0;
      return presenca < worstPresenca ? r : worst;
    }) : null;

    return { rows, mediaNoShow, melhorDia, piorDia };
  }, [interacoes]);

  // ==================== PERFORMANCE POR RESPONSÁVEL ====================
  const performanceResponsavel = useMemo(() => {
    const grouped = new Map<string, { agendamentos: number; comparecimentos: number; matriculas: number }>();

    interacoes.forEach(int => {
      // For agendamentos, use quem_agendou or atendido_por
      if (int.agendou_experimental) {
        const resp = int.quem_agendou || int.atendido_por || 'Não informado';
        const current = grouped.get(resp) || { agendamentos: 0, comparecimentos: 0, matriculas: 0 };
        grouped.set(resp, { ...current, agendamentos: current.agendamentos + 1 });
      }
      
      // For comparecimentos
      if (int.compareceu) {
        const resp = int.atendido_por || 'Não informado';
        const current = grouped.get(resp) || { agendamentos: 0, comparecimentos: 0, matriculas: 0 };
        grouped.set(resp, { ...current, comparecimentos: current.comparecimentos + 1 });
      }

      // For matriculas, use responsavel_fechamento
      if (int.fechou_matricula) {
        const resp = int.responsavel_fechamento || int.atendido_por || 'Não informado';
        const current = grouped.get(resp) || { agendamentos: 0, comparecimentos: 0, matriculas: 0 };
        grouped.set(resp, { ...current, matriculas: current.matriculas + 1 });
      }
    });

    return Array.from(grouped.entries())
      .map(([responsavel, data]) => ({
        responsavel,
        ...data,
        conversao: data.comparecimentos > 0 ? (data.matriculas / data.comparecimentos) * 100 : 0,
      }))
      .filter(r => r.agendamentos > 0 || r.comparecimentos > 0 || r.matriculas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [interacoes]);

  // ==================== PERFORMANCE TREINADORES ====================
  const performanceTreinadores = useMemo(() => {
    const grouped = new Map<string, { aulas: number; matriculas: number }>();

    interacoes.forEach(int => {
      const treinador = int.treinador_responsavel;
      if (!treinador) return;

      const current = grouped.get(treinador) || { aulas: 0, matriculas: 0 };
      
      // Count experimental classes given
      if (int.compareceu) {
        current.aulas += 1;
      }
      
      // Count matriculas generated
      if (int.fechou_matricula) {
        current.matriculas += 1;
      }

      grouped.set(treinador, current);
    });

    return Array.from(grouped.entries())
      .map(([treinador, data]) => {
        const { aulas, matriculas } = data;
        const conversao = aulas > 0 ? (matriculas / aulas) * 100 : 0;
        
        // Bonus calculation
        let bonusPorAluno = 0;
        if (matriculas >= 11) bonusPorAluno = 40;
        else if (matriculas >= 8) bonusPorAluno = 30;
        else if (matriculas >= 5) bonusPorAluno = 25;
        else if (matriculas >= 1) bonusPorAluno = 20;
        
        const bonusTotal = matriculas * bonusPorAluno;

        return { treinador, aulas, matriculas, conversao, bonusPorAluno, bonusTotal };
      })
      .filter(t => t.aulas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [interacoes]);

  // ==================== RESUMO FINAL ====================
  const resumoFinal = useMemo(() => {
    const totalLeads = leads.length;
    const totalAgendamentos = interacoes.filter(i => i.agendou_experimental === true).length;
    const totalComparecimentos = interacoes.filter(i => i.compareceu === true).length;
    const totalMatriculas = interacoes.filter(i => i.fechou_matricula === true).length;
    const conversaoGeral = totalComparecimentos > 0 ? (totalMatriculas / totalComparecimentos) * 100 : 0;
    const mediaNoShow = agendaPresenca.mediaNoShow;

    const melhorResponsavel = performanceResponsavel.length > 0 ? performanceResponsavel[0].responsavel : '-';
    const melhorTreinador = performanceTreinadores.length > 0 ? performanceTreinadores[0].treinador : '-';

    return {
      totalLeads,
      totalAgendamentos,
      totalComparecimentos,
      totalMatriculas,
      conversaoGeral,
      mediaNoShow,
      melhorResponsavel,
      melhorTreinador,
    };
  }, [leads, interacoes, agendaPresenca, performanceResponsavel, performanceTreinadores]);

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Dashboard Executivo', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${formatDate(dataInicio)} a ${formatDate(dataFim)}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Top Cards Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Geral', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Leads', 'Agendamentos', 'Comparecimentos', 'Matrículas', 'Taxa Conversão']],
      body: [[
        topCards.leadsDoMes,
        topCards.agendamentos,
        topCards.comparecimentos,
        topCards.matriculas,
        `${topCards.taxaConversao.toFixed(1)}%`
      ]],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Funil Executivo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Funil Executivo', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Etapa', 'Quantidade', 'Conversão']],
      body: funilExecutivo.map(item => [
        item.etapa,
        item.quantidade,
        item.conversao !== null ? `${item.conversao.toFixed(1)}%` : '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Origem dos Leads
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Conversão por Origem', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Origem', 'Leads', 'Matrículas', 'Conversão']],
      body: origemData.map(item => [
        item.origem,
        item.leads,
        item.matriculas,
        `${item.conversao.toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    // New page for more content
    doc.addPage();
    yPos = 20;

    // Performance por Responsável
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance por Responsável', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Responsável', 'Agendamentos', 'Comparecimentos', 'Matrículas', 'Conversão']],
      body: performanceResponsavel.map(item => [
        item.responsavel,
        item.agendamentos,
        item.comparecimentos,
        item.matriculas,
        `${item.conversao.toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Performance Treinadores
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance dos Treinadores', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Treinador', 'Aulas', 'Matrículas', 'Conversão', 'Bônus/Aluno', 'Bônus Total']],
      body: performanceTreinadores.map(item => [
        item.treinador,
        item.aulas,
        item.matriculas,
        `${item.conversao.toFixed(1)}%`,
        formatCurrency(item.bonusPorAluno),
        formatCurrency(item.bonusTotal)
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Resumo Final
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Final do Mês', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Leads', resumoFinal.totalLeads],
        ['Total Agendamentos', resumoFinal.totalAgendamentos],
        ['Total Comparecimentos', resumoFinal.totalComparecimentos],
        ['Total Matrículas', resumoFinal.totalMatriculas],
        ['Conversão Geral', `${resumoFinal.conversaoGeral.toFixed(1)}%`],
        ['Média No-Show', `${resumoFinal.mediaNoShow.toFixed(1)}%`],
        ['Melhor Responsável', resumoFinal.melhorResponsavel],
        ['Melhor Treinador', resumoFinal.melhorTreinador],
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    // Save
    doc.save(`dashboard-executivo-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso!' });
  };

  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Executivo</h1>
            <p className="text-sm text-muted-foreground">Pipeline de Aulas Experimentais</p>
          </div>
          <Button onClick={exportPDF} disabled={loading}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* 1. TOP CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Users className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Leads do Mês</p>
                      <p className="text-2xl font-bold">{topCards.leadsDoMes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <CalendarCheck className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Agendamentos</p>
                      <p className="text-2xl font-bold">{topCards.agendamentos}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <UserCheck className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Comparecimentos</p>
                      <p className="text-2xl font-bold">{topCards.comparecimentos}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <GraduationCap className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Matrículas</p>
                      <p className="text-2xl font-bold">{topCards.matriculas}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 rounded-lg">
                      <Percent className="w-6 h-6 text-cyan-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Taxa Conversão</p>
                      <p className="text-2xl font-bold">{topCards.taxaConversao.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 2. FUNIL EXECUTIVO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Funil Executivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      <TableHead className="text-center">Quantidade</TableHead>
                      <TableHead className="text-center">Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funilExecutivo.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.etapa}</TableCell>
                        <TableCell className="text-center text-lg font-semibold">{item.quantidade}</TableCell>
                        <TableCell className="text-center">
                          {item.conversao !== null ? (
                            <span className={item.conversao >= 50 ? 'text-green-600' : item.conversao >= 30 ? 'text-amber-600' : 'text-red-600'}>
                              {item.conversao.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 3. ORIGEM DOS LEADS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Leads por Origem</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={origemData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="origem" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="leads" fill="#3b82f6" name="Leads">
                          {origemData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversão por Origem</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-center">Leads</TableHead>
                        <TableHead className="text-center">Matrículas</TableHead>
                        <TableHead className="text-center">Conversão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {origemData.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.origem}</TableCell>
                          <TableCell className="text-center">{item.leads}</TableCell>
                          <TableCell className="text-center">{item.matriculas}</TableCell>
                          <TableCell className="text-center">
                            <span className={item.conversao >= 30 ? 'text-green-600 font-medium' : ''}>
                              {item.conversao.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* 4. AGENDA & PRESENÇA */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" /> Agenda & Presença (No-Show)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Média Geral No-Show</p>
                    <p className="text-2xl font-bold text-amber-600">{agendaPresenca.mediaNoShow.toFixed(1)}%</p>
                  </div>
                  <div className="p-4 bg-green-500/10 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Melhor Dia de Presença</p>
                    <p className="text-lg font-bold text-green-600">
                      {agendaPresenca.melhorDia ? formatDate(agendaPresenca.melhorDia.data) : '-'}
                    </p>
                    {agendaPresenca.melhorDia && (
                      <p className="text-xs text-muted-foreground">
                        {agendaPresenca.melhorDia.compareceram}/{agendaPresenca.melhorDia.agendados} presentes
                      </p>
                    )}
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Pior Dia de Presença</p>
                    <p className="text-lg font-bold text-red-600">
                      {agendaPresenca.piorDia ? formatDate(agendaPresenca.piorDia.data) : '-'}
                    </p>
                    {agendaPresenca.piorDia && (
                      <p className="text-xs text-muted-foreground">
                        {agendaPresenca.piorDia.compareceram}/{agendaPresenca.piorDia.agendados} presentes
                      </p>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Experimental</TableHead>
                        <TableHead className="text-center">Agendados</TableHead>
                        <TableHead className="text-center">Compareceram</TableHead>
                        <TableHead className="text-center">No-Show (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agendaPresenca.rows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{formatDate(row.data)}</TableCell>
                          <TableCell className="text-center">{row.agendados}</TableCell>
                          <TableCell className="text-center">{row.compareceram}</TableCell>
                          <TableCell className="text-center">
                            <span className={row.noShow > 30 ? 'text-red-600 font-medium' : row.noShow > 15 ? 'text-amber-600' : 'text-green-600'}>
                              {row.noShow.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {agendaPresenca.rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum agendamento no período
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* 5. PERFORMANCE POR RESPONSÁVEL */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" /> Performance por Responsável
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Responsável</TableHead>
                      <TableHead className="text-center">Agendamentos</TableHead>
                      <TableHead className="text-center">Comparecimentos</TableHead>
                      <TableHead className="text-center">Matrículas</TableHead>
                      <TableHead className="text-center">Conversão (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceResponsavel.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {i === 0 && item.matriculas > 0 && <Award className="w-4 h-4 inline mr-2 text-amber-500" />}
                          {item.responsavel}
                        </TableCell>
                        <TableCell className="text-center">{item.agendamentos}</TableCell>
                        <TableCell className="text-center">{item.comparecimentos}</TableCell>
                        <TableCell className="text-center font-semibold">{item.matriculas}</TableCell>
                        <TableCell className="text-center">
                          <span className={item.conversao >= 50 ? 'text-green-600 font-medium' : ''}>
                            {item.conversao.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {performanceResponsavel.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum dado disponível
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 6. PERFORMANCE TREINADORES */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-primary" /> Performance dos Treinadores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Treinador</TableHead>
                      <TableHead className="text-center">Aulas Experimentais</TableHead>
                      <TableHead className="text-center">Matrículas</TableHead>
                      <TableHead className="text-center">Conversão (%)</TableHead>
                      <TableHead className="text-center">Bônus/Aluno</TableHead>
                      <TableHead className="text-right">Bônus Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceTreinadores.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {i === 0 && item.matriculas > 0 && <Award className="w-4 h-4 inline mr-2 text-amber-500" />}
                          {item.treinador}
                        </TableCell>
                        <TableCell className="text-center">{item.aulas}</TableCell>
                        <TableCell className="text-center font-semibold">{item.matriculas}</TableCell>
                        <TableCell className="text-center">
                          <span className={item.conversao >= 50 ? 'text-green-600 font-medium' : ''}>
                            {item.conversao.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{formatCurrency(item.bonusPorAluno)}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatCurrency(item.bonusTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {performanceTreinadores.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum treinador com aulas no período
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {/* Bonus Rules */}
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Regras de Bônus:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <span>1-4 matrículas: R$20/aluno</span>
                    <span>5-7 matrículas: R$25/aluno</span>
                    <span>8-10 matrículas: R$30/aluno</span>
                    <span>11+ matrículas: R$40/aluno</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 7. RESUMO FINAL */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" /> Resumo Final do Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4">
                    <p className="text-3xl font-bold">{resumoFinal.totalLeads}</p>
                    <p className="text-sm text-muted-foreground">Total de Leads</p>
                  </div>
                  <div className="text-center p-4">
                    <p className="text-3xl font-bold">{resumoFinal.totalAgendamentos}</p>
                    <p className="text-sm text-muted-foreground">Total Agendamentos</p>
                  </div>
                  <div className="text-center p-4">
                    <p className="text-3xl font-bold">{resumoFinal.totalComparecimentos}</p>
                    <p className="text-sm text-muted-foreground">Total Comparecimentos</p>
                  </div>
                  <div className="text-center p-4">
                    <p className="text-3xl font-bold text-green-600">{resumoFinal.totalMatriculas}</p>
                    <p className="text-sm text-muted-foreground">Total Matrículas</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/50">
                  <div className="text-center p-4">
                    <p className="text-2xl font-bold text-cyan-600">{resumoFinal.conversaoGeral.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Conversão Geral</p>
                  </div>
                  <div className="text-center p-4">
                    <p className="text-2xl font-bold text-amber-600">{resumoFinal.mediaNoShow.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Média No-Show</p>
                  </div>
                  <div className="text-center p-4">
                    <p className="text-lg font-bold">{resumoFinal.melhorResponsavel}</p>
                    <p className="text-sm text-muted-foreground">Melhor Responsável</p>
                  </div>
                  <div className="text-center p-4">
                    <p className="text-lg font-bold">{resumoFinal.melhorTreinador}</p>
                    <p className="text-sm text-muted-foreground">Melhor Treinador</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
