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
    
    // Count unique leads for each metric
    const agendamentosSet = new Set(interacoes.filter(i => i.agendou_experimental === true).map(i => i.lead_id));
    const comparecimentosSet = new Set(interacoes.filter(i => i.compareceu === true).map(i => i.lead_id));
    const matriculasSet = new Set(interacoes.filter(i => i.fechou_matricula === true).map(i => i.lead_id));
    
    const agendamentos = agendamentosSet.size;
    const comparecimentos = comparecimentosSet.size;
    const matriculas = matriculasSet.size;
    const taxaConversao = comparecimentos > 0 ? (matriculas / comparecimentos) * 100 : 0;

    return { leadsDoMes, agendamentos, comparecimentos, matriculas, taxaConversao };
  }, [leads, interacoes]);

  // ==================== FUNIL EXECUTIVO ====================
  const funilExecutivo = useMemo(() => {
    const leadsTotal = leads.length;
    
    // Count unique leads for each funnel stage
    const contatoFeitoSet = new Set(interacoes.filter(i => i.atendido_por).map(i => i.lead_id));
    const agendamentosSet = new Set(interacoes.filter(i => i.agendou_experimental === true).map(i => i.lead_id));
    const comparecimentosSet = new Set(interacoes.filter(i => i.compareceu === true).map(i => i.lead_id));
    const matriculasSet = new Set(interacoes.filter(i => i.fechou_matricula === true).map(i => i.lead_id));
    
    const contatoFeito = contatoFeitoSet.size;
    const agendamentos = agendamentosSet.size;
    const comparecimentos = comparecimentosSet.size;
    const matriculas = matriculasSet.size;

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
    if (!origem || origem.trim() === '') return 'NÃO INFORMADO';
    
    const normalizado = origem.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
    
    // WhatsApp
    if (/^(whats|whasapp|whatspp|whatsapp|wpp|zap|zapzap)/.test(normalizado)) {
      return 'WHATSAPP';
    }
    
    // Instagram
    if (/^(insta|instagram|instagran|ig)/.test(normalizado)) {
      return 'INSTAGRAM';
    }
    
    // Tráfego Pago
    if (/^(trafego|ads|anuncio|anuncios|google ads|meta ads|facebook ads|campanha|patrocinado)/.test(normalizado) ||
        normalizado.includes('pago') || normalizado.includes('ads')) {
      return 'TRÁFEGO PAGO';
    }
    
    // Indicação
    if (/^(indica|idicacao|indicacao|indicacoes)/.test(normalizado) ||
        normalizado.includes('indica')) {
      return 'INDICAÇÃO';
    }
    
    // Visita Presencial
    if (/^(presencial|visita|pessoalmente|diretamente|unidade|na academia|passou na frente|passando)/.test(normalizado) ||
        normalizado.includes('presencial') || normalizado.includes('visita')) {
      return 'VISITA PRESENCIAL';
    }
    
    // Terceiros
    if (/^(terceiro|parceiro|empresa|convenio|corporativo|b2b)/.test(normalizado) ||
        normalizado.includes('terceiro') || normalizado.includes('parceiro')) {
      return 'TERCEIROS';
    }
    
    // Não Informado
    if (/^(nao informado|n[aã]o informado|desconhecido|sem informacao|vazio|null|undefined|-|n\/a)/.test(normalizado)) {
      return 'NÃO INFORMADO';
    }
    
    // Se não matchou nenhum padrão, retorna a origem original em caixa alta
    return origem.trim().toUpperCase();
  };

  // ==================== ORIGEM DOS LEADS ====================
  const origemData = useMemo(() => {
    const grouped = new Map<string, { leads: number; matriculasSet: Set<string> }>();
    
    leads.forEach(lead => {
      const origem = padronizarOrigem(lead.origem);
      const current = grouped.get(origem) || { leads: 0, matriculasSet: new Set() };
      grouped.set(origem, { ...current, leads: current.leads + 1 });
    });

    // Count unique leads that enrolled per origin
    interacoes.filter(i => i.fechou_matricula === true).forEach(int => {
      const lead = leads.find(l => l.id === int.lead_id);
      const origem = padronizarOrigem(lead?.origem);
      const current = grouped.get(origem) || { leads: 0, matriculasSet: new Set() };
      current.matriculasSet.add(int.lead_id);
      grouped.set(origem, current);
    });

    return Array.from(grouped.entries()).map(([origem, data]) => ({
      origem,
      leads: data.leads,
      matriculas: data.matriculasSet.size,
      conversao: data.leads > 0 ? (data.matriculasSet.size / data.leads) * 100 : 0,
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

  // ==================== EXCLUSÃO DE RESPONSÁVEIS ====================
  const deveExcluirResponsavel = (nome: string | null | undefined): boolean => {
    if (!nome) return false;
    const normalizado = nome.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizado === 'manu paes' || 
           normalizado === 'manu' ||
           normalizado === 'emanuel.paes@gmail.com' ||
           normalizado.includes('manu paes') ||
           normalizado.includes('manu ') ||
           /^manu/.test(normalizado);
  };

  // ==================== PADRONIZAÇÃO DE RESPONSÁVEIS ====================

  const padronizarResponsavel = (nome: string | null | undefined): string => {
    if (!nome || nome.trim() === '') return 'NAO INFORMADO';
    
    const normalizado = nome.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
    
    // THAIS
    if (/^thais/.test(normalizado)) {
      return 'THAIS';
    }
    
    // GABRIELA LIMA
    if (/^gabriela/.test(normalizado)) {
      return 'GABRIELA LIMA';
    }
    
    // NATANAEL DA SILVA
    if (/^natanael/.test(normalizado)) {
      return 'NATANAEL DA SILVA';
    }
    
    // ANDREZA TEODORO
    if (/^andreza/.test(normalizado)) {
      return 'ANDREZA TEODORO';
    }
    
    // GABRIEL
    if (/^gabriel$/.test(normalizado) || normalizado === 'gabriel') {
      return 'GABRIEL';
    }
    
    // SISTEMA
    if (/^sistema/.test(normalizado)) {
      return 'SISTEMA';
    }
    
    // NAO INFORMADO
    if (/^(nao informado|n[aã]o informado|desconhecido|vazio|null|undefined|-|n\/a)/.test(normalizado) ||
        normalizado === '') {
      return 'NAO INFORMADO';
    }
    
    // Se não matchou, retorna em caixa alta
    return nome.trim().toUpperCase();
  };

  // ==================== PERFORMANCE POR CADASTRADOR ====================
  const performanceCadastrador = useMemo(() => {
    const grouped = new Map<string, { leadsSet: Set<string>; agendamentosSet: Set<string>; matriculasSet: Set<string> }>();

    interacoes.forEach(int => {
      const cadastradorOriginal = int.cadastrado_por || '';
      if (!cadastradorOriginal || deveExcluirResponsavel(cadastradorOriginal)) return;
      
      const cadastrador = padronizarResponsavel(cadastradorOriginal);
      const current = grouped.get(cadastrador) || { leadsSet: new Set(), agendamentosSet: new Set(), matriculasSet: new Set() };
      
      // Track unique leads per cadastrador
      current.leadsSet.add(int.lead_id);
      if (int.agendou_experimental) current.agendamentosSet.add(int.lead_id);
      if (int.fechou_matricula) current.matriculasSet.add(int.lead_id);
      
      grouped.set(cadastrador, current);
    });

    return Array.from(grouped.entries())
      .map(([cadastrador, data]) => ({
        cadastrador,
        leads: data.leadsSet.size,
        agendamentos: data.agendamentosSet.size,
        matriculas: data.matriculasSet.size,
        conversao: data.agendamentosSet.size > 0 ? (data.matriculasSet.size / data.agendamentosSet.size) * 100 : 0,
      }))
      .filter(r => r.leads > 0 || r.agendamentos > 0 || r.matriculas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [interacoes]);

  // ==================== PERFORMANCE POR FECHADOR ====================
  const performanceFechador = useMemo(() => {
    const grouped = new Map<string, { comparecimentosSet: Set<string>; matriculasSet: Set<string>; valorTotal: number }>();

    interacoes.forEach(int => {
      // Fechador é quem fechou a matrícula (responsavel_fechamento)
      if (int.fechou_matricula) {
        const fechadorOriginal = int.responsavel_fechamento || int.atendido_por || '';
        if (!fechadorOriginal || deveExcluirResponsavel(fechadorOriginal)) return;
        
        const fechador = padronizarResponsavel(fechadorOriginal);
        const current = grouped.get(fechador) || { comparecimentosSet: new Set(), matriculasSet: new Set(), valorTotal: 0 };
        current.matriculasSet.add(int.lead_id);
        current.valorTotal += (int.valor_plano || 0);
        grouped.set(fechador, current);
      }
      
      // Contabilizar comparecimentos
      if (int.compareceu) {
        const atendidoOriginal = int.atendido_por || '';
        if (!atendidoOriginal || deveExcluirResponsavel(atendidoOriginal)) return;
        
        const atendido = padronizarResponsavel(atendidoOriginal);
        const current = grouped.get(atendido) || { comparecimentosSet: new Set(), matriculasSet: new Set(), valorTotal: 0 };
        current.comparecimentosSet.add(int.lead_id);
        grouped.set(atendido, current);
      }
    });

    return Array.from(grouped.entries())
      .map(([fechador, data]) => ({
        fechador,
        atendimentos: 0,
        comparecimentos: data.comparecimentosSet.size,
        matriculas: data.matriculasSet.size,
        valorTotal: data.valorTotal,
        conversao: data.comparecimentosSet.size > 0 ? (data.matriculasSet.size / data.comparecimentosSet.size) * 100 : 0,
      }))
      .filter(r => r.comparecimentos > 0 || r.matriculas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [interacoes]);

  // ==================== PADRONIZAÇÃO DE TREINADORES ====================
  const padronizarTreinador = (nome: string | null | undefined): string => {
    if (!nome || nome.trim() === '') return 'NAO INFORMADO';
    
    const normalizado = nome.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Mapeamento de treinadores conhecidos
    if (/^thais/.test(normalizado)) return 'THAIS';
    if (/^gabriela/.test(normalizado)) return 'GABRIELA LIMA';
    if (/^natanael/.test(normalizado)) return 'NATANAEL DA SILVA';
    if (/^andreza/.test(normalizado)) return 'ANDREZA TEODORO';
    if (/^gabriel$/.test(normalizado) || normalizado === 'gabriel') return 'GABRIEL';
    if (/^sistema/.test(normalizado)) return 'SISTEMA';
    if (/^(nao informado|n[aã]o informado|desconhecido|vazio|null|undefined|-|n\/a)/.test(normalizado)) {
      return 'NAO INFORMADO';
    }
    
    return nome.trim().toUpperCase();
  };

  // ==================== PERFORMANCE TREINADORES ====================
  const performanceTreinadores = useMemo(() => {
    const grouped = new Map<string, { aulasSet: Set<string>; matriculasSet: Set<string> }>();

    interacoes.forEach(int => {
      const treinadorOriginal = int.treinador_responsavel;
      if (!treinadorOriginal) return;
      
      // Excluir MANU PAES
      if (deveExcluirResponsavel(treinadorOriginal)) return;
      
      const treinador = padronizarTreinador(treinadorOriginal);
      const current = grouped.get(treinador) || { aulasSet: new Set(), matriculasSet: new Set() };
      
      // Track unique leads for experimental classes given
      if (int.compareceu) {
        current.aulasSet.add(int.lead_id);
      }
      
      // Track unique leads for matriculas generated
      if (int.fechou_matricula) {
        current.matriculasSet.add(int.lead_id);
      }

      grouped.set(treinador, current);
    });

    return Array.from(grouped.entries())
      .map(([treinador, data]) => {
        const aulas = data.aulasSet.size;
        const matriculas = data.matriculasSet.size;
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
      .filter(t => t.aulas > 0 || t.matriculas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [interacoes]);

  // ==================== RESUMO FINAL ====================
  const resumoFinal = useMemo(() => {
    const totalLeads = leads.length;
    
    // Count unique leads for summary
    const totalAgendamentos = new Set(interacoes.filter(i => i.agendou_experimental === true).map(i => i.lead_id)).size;
    const totalComparecimentos = new Set(interacoes.filter(i => i.compareceu === true).map(i => i.lead_id)).size;
    const totalMatriculas = new Set(interacoes.filter(i => i.fechou_matricula === true).map(i => i.lead_id)).size;
    const conversaoGeral = totalComparecimentos > 0 ? (totalMatriculas / totalComparecimentos) * 100 : 0;
    const mediaNoShow = agendaPresenca.mediaNoShow;

    const melhorCadastrador = performanceCadastrador.length > 0 ? performanceCadastrador[0].cadastrador : '-';
    const melhorFechador = performanceFechador.length > 0 ? performanceFechador[0].fechador : '-';
    const melhorTreinador = performanceTreinadores.length > 0 ? performanceTreinadores[0].treinador : '-';

    return {
      totalLeads,
      totalAgendamentos,
      totalComparecimentos,
      totalMatriculas,
      conversaoGeral,
      mediaNoShow,
      melhorCadastrador,
      melhorFechador,
      melhorTreinador,
    };
  }, [leads, interacoes, agendaPresenca, performanceCadastrador, performanceFechador, performanceTreinadores]);

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

    // Performance por Cadastrador
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance por Cadastrador', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Cadastrador', 'Leads', 'Agendamentos', 'Matrículas', 'Conversão']],
      body: performanceCadastrador.map(item => [
        item.cadastrador,
        item.leads,
        item.agendamentos,
        item.matriculas,
        `${item.conversao.toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Performance por Fechador
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance por Fechador', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Fechador', 'Comparecimentos', 'Matrículas', 'Conversão', 'Valor Total']],
      body: performanceFechador.map(item => [
        item.fechador,
        item.comparecimentos,
        item.matriculas,
        `${item.conversao.toFixed(1)}%`,
        formatCurrency(item.valorTotal)
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
        ['Melhor Cadastrador', resumoFinal.melhorCadastrador],
        ['Melhor Fechador', resumoFinal.melhorFechador],
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

            {/* 5. PERFORMANCE POR CADASTRADOR */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" /> Performance por Cadastrador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cadastrador</TableHead>
                      <TableHead className="text-center">Leads</TableHead>
                      <TableHead className="text-center">Agendamentos</TableHead>
                      <TableHead className="text-center">Matrículas</TableHead>
                      <TableHead className="text-center">Conversão (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceCadastrador.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {i === 0 && item.matriculas > 0 && <Award className="w-4 h-4 inline mr-2 text-amber-500" />}
                          {item.cadastrador}
                        </TableCell>
                        <TableCell className="text-center">{item.leads}</TableCell>
                        <TableCell className="text-center">{item.agendamentos}</TableCell>
                        <TableCell className="text-center font-semibold">{item.matriculas}</TableCell>
                        <TableCell className="text-center">
                          <span className={item.conversao >= 50 ? 'text-green-600 font-medium' : ''}>
                            {item.conversao.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {performanceCadastrador.length === 0 && (
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

            {/* 6. PERFORMANCE POR FECHADOR */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" /> Performance por Fechador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fechador</TableHead>
                      <TableHead className="text-center">Comparecimentos</TableHead>
                      <TableHead className="text-center">Matrículas</TableHead>
                      <TableHead className="text-center">Conversão (%)</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceFechador.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {i === 0 && item.matriculas > 0 && <Award className="w-4 h-4 inline mr-2 text-amber-500" />}
                          {item.fechador}
                        </TableCell>
                        <TableCell className="text-center">{item.comparecimentos}</TableCell>
                        <TableCell className="text-center font-semibold">{item.matriculas}</TableCell>
                        <TableCell className="text-center">
                          <span className={item.conversao >= 50 ? 'text-green-600 font-medium' : ''}>
                            {item.conversao.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatCurrency(item.valorTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {performanceFechador.length === 0 && (
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
                    <p className="text-lg font-bold">{resumoFinal.melhorCadastrador}</p>
                    <p className="text-sm text-muted-foreground">Melhor Cadastrador</p>
                  </div>
                  <div className="text-center p-4">
                    <p className="text-lg font-bold">{resumoFinal.melhorFechador}</p>
                    <p className="text-sm text-muted-foreground">Melhor Fechador</p>
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
