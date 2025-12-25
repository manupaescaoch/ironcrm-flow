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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Interacao } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, Users, TrendingUp, Calculator, Briefcase, UserCheck, Award, FileDown, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useUnidade } from '@/contexts/UnidadeContext';

interface InteracaoComLead extends Interacao {
  lead_nome?: string;
}

interface ComissaoAgrupada {
  responsavel: string;
  matriculas: number;
  comissao: number;
}

const meses = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function Comissoes() {
  const [loading, setLoading] = useState(false);
  const [interacoes, setInteracoes] = useState<InteracaoComLead[]>([]);
  const [mes, setMes] = useState<string>((new Date().getMonth() + 1).toString());
  const [ano, setAno] = useState<string>(currentYear.toString());
  const [filterFuncionario, setFilterFuncionario] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<{ name: string; type: 'cadastrador' | 'fechador' } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();

  useEffect(() => {
    if (mes && ano && unidadeAtual) {
      fetchComissoes();
    }
  }, [mes, ano, unidadeAtual]);

  const fetchComissoes = async () => {
    if (!unidadeAtual) return;
    setLoading(true);

    const mesNum = parseInt(mes);
    const anoNum = parseInt(ano);

    // Calculate date range for the selected month
    const startDate = new Date(anoNum, mesNum - 1, 1);
    const endDate = new Date(anoNum, mesNum, 0); // Last day of month

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Fetch interacoes with fechou_matricula = true and data_fechamento in the range
    const { data: interacoesData, error: interacoesError } = await supabase
      .from('interacoes')
      .select('*, leads(nome, cadastrado_por)')
      .eq('fechou_matricula', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr)
      .order('data_fechamento', { ascending: false });

    if (interacoesError) {
      toast({ title: 'Erro ao carregar comissões', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Map the data
    const mappedData: InteracaoComLead[] = (interacoesData || []).map((int: any) => ({
      ...int,
      lead_nome: int.leads?.nome || 'Lead não encontrado',
      lead_cadastrado_por: int.leads?.cadastrado_por || null,
    }));

    setInteracoes(mappedData);
    setLoading(false);
  };

  // Filter by funcionario
  const filteredInteracoes = useMemo(() => {
    if (!filterFuncionario.trim()) return interacoes;
    const filter = filterFuncionario.toLowerCase();
    return interacoes.filter(
      (int) =>
        int.responsavel_fechamento?.toLowerCase().includes(filter) ||
        int.treinador_responsavel?.toLowerCase().includes(filter) ||
        (int as any).cadastrado_por?.toLowerCase().includes(filter)
    );
  }, [interacoes, filterFuncionario]);

  // ==================== NORMALIZAÇÃO DE CADASTRADORES ====================
  const normalizeCadastrador = (nome: string | null | undefined): string => {
    if (!nome) return 'NÃO INFORMADO';
    const normalizado = nome.trim().toUpperCase();
    
    // Mapeamento de variações conhecidas
    const mapeamento: Record<string, string> = {
      'ANDREZA': 'ANDREZA TEODORO',
      'THAIS': 'THAIS',
      'THAÍS': 'THAIS',
      'GABRIELA': 'GABRIELA LIMA',
      'NATANAEL': 'NATANAEL DA SILVA',
      'GABRIEL': 'GABRIEL',
      'MANU PAES': 'ANDREZA TEODORO',
      'MANU': 'ANDREZA TEODORO',
    };
    
    // Verifica mapeamento direto
    if (mapeamento[normalizado]) {
      return mapeamento[normalizado];
    }
    
    // Verifica por correspondência parcial
    for (const [key, value] of Object.entries(mapeamento)) {
      if (normalizado.includes(key)) {
        return value;
      }
    }
    
    return normalizado;
  };

  // ==================== EXCLUSÃO DE RESPONSÁVEIS ====================
  const deveExcluirResponsavel = (nome: string | null | undefined): boolean => {
    if (!nome) return false;
    const normalizado = nome.trim().toLowerCase();
    return normalizado === 'manu paes' || 
           normalizado === 'emanuel.paes@gmail.com' ||
           normalizado.includes('manu paes');
  };

  // Calculate summary stats with new commission logic
  const stats = useMemo(() => {
    const totalMatriculas = filteredInteracoes.length;
    const totalValorPlano = filteredInteracoes.reduce((sum, int) => sum + (int.valor_plano || 0), 0);
    const ticketMedio = totalMatriculas > 0 ? totalValorPlano / totalMatriculas : 0;
    // Cadastrador commission (3%) - stored in comissao_comercial for backward compatibility
    const totalComissaoCadastrador = filteredInteracoes.reduce((sum, int) => sum + (int.comissao_comercial || 0), 0);
    // Fechador commission (2%) - stored in comissao_recepcao
    const totalComissaoFechador = filteredInteracoes.reduce((sum, int) => sum + (int.comissao_recepcao || 0), 0);

    return {
      totalMatriculas,
      ticketMedio,
      totalComissaoCadastrador,
      totalComissaoFechador,
    };
  }, [filteredInteracoes]);

  // Group by cadastrador (who registered the lead) - gets 3%
  const comissoesCadastrador = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; comissao: number }>();

    filteredInteracoes.forEach((int) => {
      const comissao = int.comissao_comercial || 0;
      if (comissao <= 0) return;

      // Use cadastrado_por from the LEAD (who originally registered the lead in the system)
      const cadastradorOriginal = (int as any).lead_cadastrado_por || 'Não informado';
      
      // Normalize using the standard function
      const cadastrador = normalizeCadastrador(cadastradorOriginal);
      
      // Skip if excluded
      if (deveExcluirResponsavel(cadastrador)) return;
      
      const current = grouped.get(cadastrador) || { matriculas: 0, comissao: 0 };
      grouped.set(cadastrador, {
        matriculas: current.matriculas + 1,
        comissao: current.comissao + comissao,
      });
    });

    return Array.from(grouped.entries())
      .map(([responsavel, data]) => ({
        responsavel,
        ...data,
      }))
      .sort((a, b) => b.comissao - a.comissao);
  }, [filteredInteracoes]);

  // Group by fechador (responsavel_fechamento) - gets 2%
  const comissoesFechador = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; comissao: number }>();

    filteredInteracoes.forEach((int) => {
      const comissao = int.comissao_recepcao || 0;
      if (comissao <= 0) return;

      const responsavelOriginal = int.responsavel_fechamento || 'Não informado';
      
      // Normalize using the standard function
      const responsavel = normalizeCadastrador(responsavelOriginal);
      
      // Skip if excluded
      if (deveExcluirResponsavel(responsavel)) return;
      
      const current = grouped.get(responsavel) || { matriculas: 0, comissao: 0 };
      grouped.set(responsavel, {
        matriculas: current.matriculas + 1,
        comissao: current.comissao + comissao,
      });
    });

    return Array.from(grouped.entries())
      .map(([responsavel, data]) => ({
        responsavel,
        ...data,
      }))
      .sort((a, b) => b.comissao - a.comissao);
  }, [filteredInteracoes]);

  // Helper function to calculate bonus per student based on number of enrollments
  const calculateBonusPorAluno = (matriculas: number): number => {
    if (matriculas === 0) return 0;
    if (matriculas >= 1 && matriculas <= 4) return 20;
    if (matriculas >= 5 && matriculas <= 7) return 25;
    if (matriculas >= 8 && matriculas <= 10) return 30;
    if (matriculas >= 11) return 40;
    return 0;
  };


  // ==================== VALIDAÇÃO DE TREINADOR ====================
  const isValidTreinador = (nome: string | null | undefined): boolean => {
    if (!nome || nome.trim() === '') return false;
    
    const normalizado = nome.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Padrões inválidos - frases, observações, origens, etc.
    const invalidPatterns = [
      /sem experimental/i,
      /indicacao/i,
      /indicação/i,
      /recepcao/i,
      /recepção/i,
      /transferencia/i,
      /transferência/i,
      /zona sul/i,
      /zona norte/i,
      /veio da/i,
      /aluno veio/i,
      /unidade/i,
      /processo/i,
      /justificativa/i,
      /observacao/i,
      /observação/i,
      /n\/a/i,
      /nao informado/i,
      /não informado/i,
    ];
    
    // Se contém qualquer padrão inválido, retorna false
    for (const pattern of invalidPatterns) {
      if (pattern.test(normalizado)) return false;
    }
    
    // Se tem mais de 5 palavras, provavelmente é uma frase/observação
    const palavras = nome.trim().split(/\s+/);
    if (palavras.length > 5) return false;
    
    return true;
  };

  // ==================== PADRONIZAÇÃO DE TREINADOR ====================
  const padronizarTreinador = (nome: string): string => {
    const normalizado = nome.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Mapeamento de nomes conhecidos (igual ao Dashboard Executivo)
    if (/^josadaque/.test(normalizado)) return 'JOSADAQUE JOSE DA SILVA';
    if (/^lucia/.test(normalizado) || /^lúcia/.test(normalizado)) return 'LUCIA HELENA PINTO LOPES';
    if (/^stela/.test(normalizado)) return 'STELA';
    if (/^thais/.test(normalizado) || /^thaís/.test(normalizado)) return 'THAIS';
    if (/^gabriela/.test(normalizado)) return 'GABRIELA LIMA';
    if (/^natanael/.test(normalizado)) return 'NATANAEL DA SILVA';
    if (/^andreza/.test(normalizado)) return 'ANDREZA TEODORO';
    if (/^gabriel$/.test(normalizado)) return 'GABRIEL';
    if (/^sistema/.test(normalizado)) return 'SISTEMA';
    if (/^(nao informado|n[aã]o informado|desconhecido|vazio|null|undefined|-|n\/a)/.test(normalizado)) {
      return 'NAO INFORMADO';
    }
    
    // Se não matchou, retorna em caixa alta
    return nome.trim().toUpperCase();
  };

  // Group by treinador responsável pelo fechamento with bonus calculation
  const bonusTreinadores = useMemo(() => {
    const grouped = new Map<string, { aulasSet: Set<string>; matriculasSet: Set<string>; faturamento: number }>();

    // Only consider interactions with a valid trainer assigned
    filteredInteracoes.forEach((int) => {
      const treinadorOriginal = int.treinador_responsavel;
      
      // Skip invalid trainers and excluded names
      if (!isValidTreinador(treinadorOriginal)) return;
      if (deveExcluirResponsavel(treinadorOriginal)) return;
      
      const treinador = padronizarTreinador(treinadorOriginal!);
      const current = grouped.get(treinador) || { aulasSet: new Set(), matriculasSet: new Set(), faturamento: 0 };
      
      // Track unique leads for experimental classes given (compareceu = true)
      if (int.compareceu) {
        current.aulasSet.add(int.lead_id);
      }
      
      // Track unique leads for matriculas generated (fechou_matricula = true)
      if (int.fechou_matricula) {
        current.matriculasSet.add(int.lead_id);
        current.faturamento += (int.valor_plano || 0);
      }

      grouped.set(treinador, current);
    });

    return Array.from(grouped.entries())
      .map(([treinador, data]) => {
        const aulas = data.aulasSet.size;
        const matriculas = data.matriculasSet.size;
        const faturamento = data.faturamento;
        const conversao = aulas > 0 ? (matriculas / aulas) * 100 : 0;
        
        // Bonus calculation (igual ao Dashboard Executivo)
        let bonusPorAluno = 0;
        if (matriculas >= 11) bonusPorAluno = 40;
        else if (matriculas >= 8) bonusPorAluno = 30;
        else if (matriculas >= 5) bonusPorAluno = 25;
        else if (matriculas >= 1) bonusPorAluno = 20;
        
        const bonusTotal = matriculas * bonusPorAluno;
        
        return {
          treinador,
          aulas,
          matriculas,
          faturamento,
          conversao,
          bonusPorAluno,
          bonusTotal,
        };
      })
      .filter(t => t.aulas > 0 || t.matriculas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [filteredInteracoes]);

  // Calculate trainer bonus totals
  const treinadorStats = useMemo(() => {
    const totalMatriculas = bonusTreinadores.reduce((sum, t) => sum + t.matriculas, 0);
    const totalBonus = bonusTreinadores.reduce((sum, t) => sum + t.bonusTotal, 0);
    return { totalMatriculas, totalBonus };
  }, [bonusTreinadores]);

  // Total commissions including trainer bonus
  const totalComissoes = useMemo(() => {
    return stats.totalComissaoCadastrador + stats.totalComissaoFechador + treinadorStats.totalBonus;
  }, [stats.totalComissaoCadastrador, stats.totalComissaoFechador, treinadorStats.totalBonus]);

  // Leads for the selected person modal
  const leadsForModal = useMemo(() => {
    if (!selectedPerson) return [];
    
    return filteredInteracoes.filter((int) => {
      if (selectedPerson.type === 'cadastrador') {
        return (int as any).cadastrado_por === selectedPerson.name;
      } else {
        return int.responsavel_fechamento === selectedPerson.name;
      }
    });
  }, [selectedPerson, filteredInteracoes]);

  const handlePersonClick = (name: string, type: 'cadastrador' | 'fechador') => {
    setSelectedPerson({ name, type });
  };

  const handleNavigateToLead = (leadId: string) => {
    navigate(`/lead/${leadId}`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const mesLabel = meses.find(m => m.value === mes)?.label || mes;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.text(`Relatório de Comissões - ${mesLabel} ${ano}`, pageWidth / 2, 20, { align: 'center' });
    
    // Summary
    doc.setFontSize(12);
    doc.text('Resumo Geral', 14, 35);
    doc.setFontSize(10);
    doc.text(`Matrículas: ${stats.totalMatriculas}`, 14, 42);
    doc.text(`Ticket Médio: ${formatCurrency(stats.ticketMedio)}`, 14, 48);
    doc.text(`Total Cadastrador (3%): ${formatCurrency(stats.totalComissaoCadastrador)}`, 14, 54);
    doc.text(`Total Fechador (2%): ${formatCurrency(stats.totalComissaoFechador)}`, 14, 60);
    doc.text(`Total Bônus Treinador: ${formatCurrency(treinadorStats.totalBonus)}`, 14, 66);
    doc.text(`Total Comissões: ${formatCurrency(totalComissoes)}`, 14, 72);
    
    let yPos = 86;
    
    // Cadastrador Table
    if (comissoesCadastrador.length > 0) {
      doc.setFontSize(12);
      doc.text('Comissão do Cadastrador (3%)', 14, yPos);
      
      autoTable(doc, {
        startY: yPos + 5,
        head: [['Cadastrador', 'Matrículas', 'Comissão']],
        body: [
          ...comissoesCadastrador.map(item => [
            item.responsavel,
            item.matriculas.toString(),
            formatCurrency(item.comissao)
          ]),
          ['TOTAL', comissoesCadastrador.reduce((sum, i) => sum + i.matriculas, 0).toString(), formatCurrency(stats.totalComissaoCadastrador)]
        ],
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
        footStyles: { fontStyle: 'bold' },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Fechador Table
    if (comissoesFechador.length > 0) {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.text('Comissão do Fechador (2%)', 14, yPos);
      
      autoTable(doc, {
        startY: yPos + 5,
        head: [['Resp. Fechamento', 'Matrículas', 'Comissão']],
        body: [
          ...comissoesFechador.map(item => [
            item.responsavel,
            item.matriculas.toString(),
            formatCurrency(item.comissao)
          ]),
          ['TOTAL', comissoesFechador.reduce((sum, i) => sum + i.matriculas, 0).toString(), formatCurrency(stats.totalComissaoFechador)]
        ],
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Treinador Bonus Table
    if (bonusTreinadores.length > 0) {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.text('Bônus por Treinador Responsável', 14, yPos);
      
      autoTable(doc, {
        startY: yPos + 5,
        head: [['Treinador', 'Matrículas', 'Bônus Total']],
        body: [
          ...bonusTreinadores.map(item => [
            item.treinador,
            item.matriculas.toString(),
            formatCurrency(item.bonusTotal)
          ]),
          ['TOTAL', treinadorStats.totalMatriculas.toString(), formatCurrency(treinadorStats.totalBonus)]
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Detailed Table
    if (filteredInteracoes.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text('Detalhamento das Matrículas', 14, 20);
      
      autoTable(doc, {
        startY: 25,
        head: [['Lead', 'Cadastrador', 'Plano', 'Valor', 'Cad. (3%)', 'Fech. (2%)', 'Resp. Fech.', 'Data']],
        body: filteredInteracoes.map(int => [
          int.lead_nome || '-',
          (int as any).cadastrado_por || '-',
          int.plano_escolhido || '-',
          formatCurrency(int.valor_plano || 0),
          formatCurrency(int.comissao_comercial || 0),
          formatCurrency(int.comissao_recepcao || 0),
          int.responsavel_fechamento || '-',
          formatDate(int.data_fechamento)
        ]),
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 100, 100] },
      });
    }
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `IRON CLUB - Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    doc.save(`comissoes_${mesLabel.toLowerCase()}_${ano}.pdf`);
    toast({ title: 'PDF exportado com sucesso!' });
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Comissões do Mês</h1>
          <Button onClick={exportToPDF} disabled={loading || filteredInteracoes.length === 0}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={ano} onValueChange={setAno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Funcionário (opcional)</Label>
                <Input
                  value={filterFuncionario}
                  onChange={(e) => setFilterFuncionario(e.target.value)}
                  placeholder="Filtrar por nome..."
                />
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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <Card className="bg-card border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Matrículas</p>
                      <p className="text-2xl font-bold text-foreground">{stats.totalMatriculas}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                      <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.ticketMedio)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Cadastrador (3%)</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalComissaoCadastrador)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Fechador (2%)</p>
                      <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalComissaoFechador)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <Award className="w-6 h-6 text-blue-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Bônus Treinador</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(treinadorStats.totalBonus)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary/10 border-primary/30 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/30 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Comissões</p>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(totalComissoes)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Commission Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-green-500" />
                    Comissão do Cadastrador (3%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {comissoesCadastrador.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhuma comissão neste período
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cadastrador</TableHead>
                          <TableHead className="text-center">Matrículas</TableHead>
                          <TableHead className="text-right">Comissão (3%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comissoesCadastrador.map((item, index) => (
                          <TableRow 
                            key={index} 
                            className="cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => handlePersonClick(item.responsavel, 'cadastrador')}
                          >
                            <TableCell className="font-medium text-green-700 underline underline-offset-2">{item.responsavel}</TableCell>
                            <TableCell className="text-center">{item.matriculas}</TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(item.comissao)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-center font-bold">
                            {comissoesCadastrador.reduce((sum, i) => sum + i.matriculas, 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {formatCurrency(stats.totalComissaoCadastrador)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Fechador Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-500" />
                    Comissão do Fechador (2%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {comissoesFechador.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhuma comissão neste período
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Responsável Fechamento</TableHead>
                          <TableHead className="text-center">Matrículas</TableHead>
                          <TableHead className="text-right">Comissão (2%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comissoesFechador.map((item, index) => (
                          <TableRow 
                            key={index}
                            className="cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => handlePersonClick(item.responsavel, 'fechador')}
                          >
                            <TableCell className="font-medium text-amber-700 underline underline-offset-2">{item.responsavel}</TableCell>
                            <TableCell className="text-center">{item.matriculas}</TableCell>
                            <TableCell className="text-right font-semibold text-amber-600">
                              {formatCurrency(item.comissao)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-center font-bold">
                            {comissoesFechador.reduce((sum, i) => sum + i.matriculas, 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-amber-600">
                            {formatCurrency(stats.totalComissaoFechador)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
            </Card>

            {/* Treinador Responsável with Bonus Table */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-500" />
                  Fechamentos e Bônus por Treinador Responsável
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card className="bg-blue-500/5 border-blue-500/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total de matrículas fechadas</p>
                          <p className="text-xl font-bold">{treinadorStats.totalMatriculas}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-500/5 border-green-500/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                          <Award className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total de bônus a pagar</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(treinadorStats.totalBonus)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bonus Rules Info */}
                <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Regras de bônus por matrícula:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <span>1-4 alunos: R$ 20/aluno</span>
                    <span>5-7 alunos: R$ 25/aluno</span>
                    <span>8-10 alunos: R$ 30/aluno</span>
                    <span>11+ alunos: R$ 40/aluno</span>
                  </div>
                </div>

                {bonusTreinadores.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum fechamento com treinador responsável neste período
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Treinador</TableHead>
                        <TableHead className="text-center">Aulas</TableHead>
                        <TableHead className="text-center">Matrículas</TableHead>
                        <TableHead className="text-center">Conversão</TableHead>
                        <TableHead className="text-right">Bônus/Aluno</TableHead>
                        <TableHead className="text-right">Bônus Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bonusTreinadores.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.treinador}</TableCell>
                          <TableCell className="text-center">{item.aulas}</TableCell>
                          <TableCell className="text-center">{item.matriculas}</TableCell>
                          <TableCell className="text-center">{item.conversao.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.bonusPorAluno)}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatCurrency(item.bonusTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="text-center font-bold">
                          {bonusTreinadores.reduce((sum, t) => sum + t.aulas, 0)}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {treinadorStats.totalMatriculas}
                        </TableCell>
                        <TableCell className="text-center">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatCurrency(treinadorStats.totalBonus)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

            {/* Detailed Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Detalhamento das Matrículas - {meses.find(m => m.value === mes)?.label} {ano}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredInteracoes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhuma matrícula encontrada neste período
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead</TableHead>
                          <TableHead>Cadastrador</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Cadastrador (3%)</TableHead>
                          <TableHead className="text-right">Fechador (2%)</TableHead>
                          <TableHead>Resp. Fechamento</TableHead>
                          <TableHead>Treinador</TableHead>
                          <TableHead>Data Fechamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInteracoes.map((int) => {
                          const cadastradoPor = (int as any).cadastrado_por;
                          return (
                          <TableRow key={int.id}>
                            <TableCell className="font-medium">{int.lead_nome}</TableCell>
                            <TableCell>{cadastradoPor || '-'}</TableCell>
                            <TableCell>{int.plano_escolhido || '-'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(int.valor_plano || 0)}</TableCell>
                            <TableCell className="text-right text-green-600">
                              <div>{formatCurrency(int.comissao_comercial || 0)}</div>
                              {(int.comissao_comercial || 0) > 0 && cadastradoPor && (
                                <div className="text-xs text-muted-foreground">{cadastradoPor}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-amber-600">
                              <div>{formatCurrency(int.comissao_recepcao || 0)}</div>
                              {(int.comissao_recepcao || 0) > 0 && int.responsavel_fechamento && (
                                <div className="text-xs text-muted-foreground">{int.responsavel_fechamento}</div>
                              )}
                            </TableCell>
                            <TableCell>{int.responsavel_fechamento || '-'}</TableCell>
                            <TableCell>{int.treinador_responsavel || '-'}</TableCell>
                            <TableCell>{formatDate(int.data_fechamento)}</TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Modal de Leads por Pessoa */}
            <Dialog open={!!selectedPerson} onOpenChange={() => setSelectedPerson(null)}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Leads de {selectedPerson?.name} ({selectedPerson?.type === 'cadastrador' ? 'Cadastrador' : 'Fechador'})
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  {leadsForModal.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-center">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leadsForModal.map((int) => (
                          <TableRow key={int.id}>
                            <TableCell className="font-medium">{int.lead_nome}</TableCell>
                            <TableCell>{int.plano_escolhido || '-'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(int.valor_plano || 0)}</TableCell>
                            <TableCell>{formatDate(int.data_fechamento)}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNavigateToLead(int.lead_id)}
                              >
                                <ExternalLink className="w-4 h-4 mr-1" />
                                Ver Lead
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </Layout>
  );
}