import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Lead, StatusFunil, PlanoEscolhido } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/errorMessages';
import { Plus, Search, Eye, Trash2, Loader2, Pencil, Filter, Upload, FileSpreadsheet, Users, TrendingUp, UserCheck, UserX, CalendarIcon, CalendarCheck, CheckCircle, Download } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { validateCsvRow, type CsvRowValidationResult } from '@/utils/csvImportValidation';
import { ConversasWhatsAppSection } from '@/components/crm/ConversasWhatsAppSection';
import { MessageCircle, Clock, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';

// Validation schema for lead creation/update
const leadSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo (máx. 200 caracteres)'),
  email: z.string().trim().email('Email inválido').max(255, 'Email muito longo').optional().or(z.literal('')),
  telefone: z.string().trim().regex(/^\d{10,11}$/, 'Telefone deve conter 10 ou 11 dígitos numéricos (DDD + número)'),
  origem: z.string().min(1, 'Origem é obrigatória').max(100, 'Origem muito longa'),
});

const statusOptions: { value: StatusFunil; label: string }[] = [
  { value: 'novo', label: 'Novo Lead' },
  { value: 'aula_agendada', label: 'Experimental Agendada' },
  { value: 'aula_realizada', label: 'Experimental Realizada' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'perdido', label: 'Perdido' },
];

const planoOptions: PlanoEscolhido[] = [
  'Executivo Mensal',
  'Mensal',
  'Trimestral',
  'Semestral',
  'Anual',
  'Executivo Anual',
];

// Opções padronizadas de origem do lead
const ORIGEM_OPTIONS = [
  'WhatsApp',
  'Instagram',
  'Tráfego Pago',
  'Indicação',
  'Visita Presencial',
  'Embaixador / Parceria',
] as const;

// Lista única de cadastradores válidos (FONTE ÚNICA DE VERDADE)
const CADASTRADORES_VALIDOS = [
  'ANDREZA TEODORO',
  'THAIS',
  'GABRIELA LIMA',
  'NATANAEL DA SILVA',
  'GABRIEL',
] as const;

// Função para normalizar nome do cadastrador
const normalizeCadastrador = (nome: string | null | undefined): string => {
  if (!nome) return '';
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
  
  // Verifica se já é um cadastrador válido
  if (CADASTRADORES_VALIDOS.includes(normalizado as typeof CADASTRADORES_VALIDOS[number])) {
    return normalizado;
  }
  
  // Verifica por correspondência parcial
  for (const [key, value] of Object.entries(mapeamento)) {
    if (normalizado.includes(key)) {
      return value;
    }
  }
  
  return normalizado; // Retorna em caixa alta se não encontrar mapeamento
};

// Função para validar/normalizar origem
const validateOrigem = (origem: string | null | undefined): string => {
  if (!origem) return 'WhatsApp';
  const normalized = origem.trim();
  if (ORIGEM_OPTIONS.includes(normalized as typeof ORIGEM_OPTIONS[number])) {
    return normalized;
  }
  return 'WhatsApp'; // Fallback seguro
};

const statusLabels: Record<StatusFunil, string> = {
  novo: 'Novo Lead',
  contato_inicial: 'Contato Inicial',
  aula_agendada: 'Experimental Agendada',
  aula_realizada: 'Experimental Realizada',
  negociacao: 'Negociação',
  convertido: 'Convertido',
  perdido: 'Perdido',
  follow_up: 'Follow Up',
};

interface CSVRow {
  nome_completo: string;
  telefone: string;
  origem: string;
  atendido_por: string;
  status_funil: string;
  data_cadastro: string;
}

const REQUIRED_COLUMNS = ['nome_completo', 'telefone', 'origem', 'atendido_por', 'status_funil', 'data_cadastro'];

const STORAGE_KEY = 'crm:filters:v1';

interface SavedFilters {
  search?: string;
  filterOrigem?: string;
  filterCadastradoPor?: string;
  filterStatus?: string | string[];
  periodType?: 'all' | 'last7days' | 'currentMonth' | 'lastMonth' | 'custom';
  startDate?: string;
  endDate?: string;
}

const loadSavedFilters = (): SavedFilters => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedFilters) : {};
  } catch {
    return {};
  }
};

export default function CRM() {
  const { user } = useAuth();
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const _saved = loadSavedFilters();
  const [search, setSearch] = useState<string>(_saved.search ?? '');
  const [filterOrigem, setFilterOrigem] = useState<string>(_saved.filterOrigem ?? 'all');
  const [filterCadastradoPor, setFilterCadastradoPor] = useState<string>(_saved.filterCadastradoPor ?? 'all');
  const [filterStatus, setFilterStatus] = useState<string[]>(() => {
    const v = _saved.filterStatus;
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v && v !== 'all') return [v];
    return [];
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);

  // Date filter state (restored from sessionStorage)
  const [periodType, setPeriodType] = useState<'all' | 'last7days' | 'currentMonth' | 'lastMonth' | 'custom'>(
    _saved.periodType ?? 'all'
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    _saved.startDate ? new Date(_saved.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    _saved.endDate ? new Date(_saved.endDate) : undefined
  );

  // Interações no período (para KPIs de experimentais agendadas/realizadas)
  const [experimentaisAgendadasPeriodo, setExperimentaisAgendadasPeriodo] = useState(0);
  const [experimentaisRealizadasPeriodo, setExperimentaisRealizadasPeriodo] = useState(0);
  const [conversasCounts, setConversasCounts] = useState({ total: 0, naoVinculadas: 0, semResposta: 0 });

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    origem: '' as string,
    status_funil: 'novo' as StatusFunil,
    data_aula_experimental: '',
    hora_aula_experimental: '',
  });

  // Get user display name for "Cadastrado Por" field - normalizado para CAIXA ALTA
  const getUserDisplayName = (): string => {
    if (!user) return '';
    // Try to get name from user metadata, fallback to email
    const metadata = user.user_metadata as Record<string, unknown> | undefined;
    const name = metadata?.full_name || metadata?.name || metadata?.display_name;
    const displayName = typeof name === 'string' && name.trim() ? name.trim() : (user.email || 'Usuário');
    // Normalizar para cadastrador válido
    return normalizeCadastrador(displayName);
  };
  const { toast } = useToast();

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [validationResults, setValidationResults] = useState<CsvRowValidationResult[]>([]);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle period type change
  const handlePeriodChange = useCallback((value: string) => {
    setPeriodType(value as typeof periodType);
    const now = new Date();
    
    switch (value) {
      case 'last7days':
        setStartDate(startOfDay(subDays(now, 6)));
        setEndDate(endOfDay(now));
        break;
      case 'currentMonth':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        break;
      case 'all':
        setStartDate(undefined);
        setEndDate(undefined);
        break;
      case 'custom':
        // Keep current dates for custom
        break;
    }
  }, []);


  const fetchLeads = useCallback(async () => {
    if (!unidadeAtual) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('ativo', true)
      .eq('unidade_id', unidadeAtual.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar leads', description: getErrorMessage(error), variant: 'destructive' });
    } else {
      setLeads((data as unknown as Lead[]) || []);
    }
    setLoading(false);
  }, [unidadeAtual, toast]);

  useEffect(() => {
    if (unidadeAtual && !unidadeLoading) {
      fetchLeads();
    }
  }, [unidadeAtual, unidadeLoading, fetchLeads]);

  // Persist filters in sessionStorage so they survive navigating to lead detail and back
  useEffect(() => {
    const snapshot: SavedFilters = {
      search,
      filterOrigem,
      filterCadastradoPor,
      filterStatus,
      periodType,
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* ignore quota errors */
    }
  }, [search, filterOrigem, filterCadastradoPor, filterStatus, periodType, startDate, endDate]);

  // Fetch experimental KPIs (agendadas / realizadas) for the selected period
  useEffect(() => {
    if (!unidadeAtual) return;
    let cancelled = false;

    (async () => {
      let query = supabase
        .from('interacoes')
        .select('lead_id, agendou_experimental, compareceu, data_experimental')
        .eq('unidade_id', unidadeAtual.id)
        .not('data_experimental', 'is', null);

      if (startDate) query = query.gte('data_experimental', format(startDate, 'yyyy-MM-dd'));
      if (endDate) query = query.lte('data_experimental', format(endDate, 'yyyy-MM-dd'));

      const { data, error } = await query;
      if (cancelled || error || !data) return;

      const agendadas = new Set<string>();
      const realizadas = new Set<string>();
      for (const row of data as Array<{ lead_id: string; agendou_experimental: boolean | null; compareceu: boolean | null }>) {
        if (row.agendou_experimental) agendadas.add(row.lead_id);
        if (row.compareceu) realizadas.add(row.lead_id);
      }
      setExperimentaisAgendadasPeriodo(agendadas.size);
      setExperimentaisRealizadasPeriodo(realizadas.size);
    })();

    return () => {
      cancelled = true;
    };
  }, [unidadeAtual, startDate, endDate]);

  const uniqueOrigens = useMemo(() => {
    const origens = leads.map(l => l.origem).filter(Boolean) as string[];
    return [...new Set(origens)];
  }, [leads]);

  // Cadastradores normalizados (usa lista fixa para garantir consistência)
  const uniqueCadastradoPor = useMemo(() => {
    // Combina cadastradores válidos com cadastradores existentes nos leads (normalizados)
    const cadastradoresExistentes = leads
      .map(l => normalizeCadastrador(l.cadastrado_por))
      .filter(Boolean) as string[];
    const todosNormalizados = [...new Set([...CADASTRADORES_VALIDOS, ...cadastradoresExistentes])];
    return todosNormalizados.sort();
  }, [leads]);

  const handleCreate = async () => {
    // Validate form data using zod schema
    const validation = leadSchema.safeParse({
      nome: formData.nome,
      email: formData.email || '',
      telefone: formData.telefone || '',
      origem: formData.origem,
    });

    if (!validation.success) {
      toast({ 
        title: validation.error.errors[0].message, 
        variant: 'destructive' 
      });
      return;
    }

    // Validar telefone duplicado globalmente (telefone é o ID único do lead)
    if (formData.telefone.trim()) {
      const telefoneNormalizado = formData.telefone.trim().replace(/\D/g, '');

      const { data: existingLeads } = await supabase
        .from('leads')
        .select('id, nome, telefone, unidade_id, unidades(nome)')
        .eq('ativo', true);

      const duplicado = existingLeads?.find(lead => {
        const leadTelefone = lead.telefone?.replace(/\D/g, '');
        return leadTelefone === telefoneNormalizado;
      });

      if (duplicado) {
        const unidadeNome = (duplicado as any).unidades?.nome;
        const sufixo = unidadeNome && unidadeNome !== unidadeAtual?.nome
          ? ` na unidade ${unidadeNome}`
          : '';
        toast({
          title: 'Telefone já cadastrado',
          description: `Este telefone já está cadastrado para "${duplicado.nome}"${sufixo}.`,
          variant: 'destructive'
        });
        return;
      }
    }

    // Validar data obrigatória quando status é Experimental Agendada
    if (formData.status_funil === 'aula_agendada' && !formData.data_aula_experimental) {
      toast({ 
        title: 'Data da Experimental é obrigatória', 
        description: 'Preencha a data da experimental para este status.',
        variant: 'destructive' 
      });
      return;
    }

    // Preparar data_aula_experimental combinando data e hora se for status aula_agendada
    let dataAulaExperimental: string | null = null;
    const isExperimentalAgendada = formData.status_funil === 'aula_agendada' && formData.data_aula_experimental;
    
    if (isExperimentalAgendada) {
      const dataStr = formData.data_aula_experimental;
      const horaStr = formData.hora_aula_experimental || '00:00';
      dataAulaExperimental = `${dataStr}T${horaStr}:00`;
    }

    if (!unidadeAtual) {
      toast({ title: 'Nenhuma unidade selecionada', variant: 'destructive' });
      return;
    }

    const { data: leadData, error } = await supabase.from('leads').insert({
      nome: formData.nome.trim(),
      email: formData.email.trim() || null,
      telefone: formData.telefone.trim().replace(/\D/g, '') || null,
      origem: formData.origem || 'WhatsApp',
      status_funil: formData.status_funil,
      cadastrado_por: getUserDisplayName(),
      ativo: true,
      user_id: user?.id,
      created_by: user?.id,
      data_aula_experimental: dataAulaExperimental,
      hora_aula_experimental: formData.hora_aula_experimental || null,
      unidade_id: unidadeAtual.id,
    }).select().single();

    if (error) {
      // Check if it's a duplicate lead error from the database trigger
      if (error.code === '23505' || error.message?.includes('Lead duplicado detectado')) {
        const match = error.message.match(/Lead existente: (.+) - /);
        const nomeExistente = match ? match[1] : 'outro lead';
        toast({ 
          title: 'Lead duplicado', 
          description: `Este telefone já está cadastrado para "${nomeExistente}".`,
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Erro ao criar lead', description: error.message, variant: 'destructive' });
      }
      return;
    }

    // Se foi criado com experimental agendada, criar interação automaticamente
    if (isExperimentalAgendada && leadData) {
      const { error: interacaoError } = await supabase.from('interacoes').insert({
        lead_id: leadData.id,
        tipo: 'Agendamento Experimental',
        descricao: 'Experimental agendada no cadastro do lead',
        agendou_experimental: true,
        data_experimental: formData.data_aula_experimental,
        hora_experimental: formData.hora_aula_experimental || null,
        atendido_por: getUserDisplayName(),
        cadastrado_por: getUserDisplayName(),
        quem_agendou: getUserDisplayName(),
      });

      if (interacaoError) {
        console.error('Erro ao criar interação:', interacaoError);
      }
    }

    toast({ title: 'Lead criado com sucesso!' });
    setDialogOpen(false);
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      origem: '',
      status_funil: 'novo',
      data_aula_experimental: '',
      hora_aula_experimental: '',
    });
    fetchLeads();
  };

  const handleDelete = async () => {
    if (!leadToDelete) return;

    const { error } = await supabase
      .from('leads')
      .update({ ativo: false })
      .eq('id', leadToDelete);

    if (error) {
      toast({ title: 'Erro ao excluir lead', description: getErrorMessage(error), variant: 'destructive' });
    } else {
      toast({ title: 'Lead excluído com sucesso!' });
      fetchLeads();
    }
    setDeleteDialogOpen(false);
    setLeadToDelete(null);
  };

  // Parse CSV file
  const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });
    
    return { headers, rows };
  };

  // Parse Excel file
  const parseExcel = (buffer: ArrayBuffer): { headers: string[]; rows: string[][] } => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
    
    if (jsonData.length === 0) return { headers: [], rows: [] };
    
    const headers = (jsonData[0] as string[]).map(h => String(h || '').trim().toLowerCase());
    const rows = jsonData.slice(1).map(row => 
      (row as string[]).map(cell => String(cell || '').trim())
    );
    
    return { headers, rows };
  };

  const handlePreview = () => {
    if (!importFile) {
      toast({ title: 'Selecione um arquivo', variant: 'destructive' });
      return;
    }

    const isExcel = importFile.name.endsWith('.xlsx') || importFile.name.endsWith('.xls');
    const reader = new FileReader();
    
    reader.onload = (e) => {
      let headers: string[] = [];
      let rows: string[][] = [];
      
      if (isExcel) {
        const result = parseExcel(e.target?.result as ArrayBuffer);
        headers = result.headers;
        rows = result.rows;
      } else {
        const result = parseCSV(e.target?.result as string);
        headers = result.headers;
        rows = result.rows;
      }
      
      const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
      if (missingColumns.length > 0) {
        toast({ 
          title: 'Arquivo inválido. Verifique se os cabeçalhos estão corretos.',
          description: `Colunas faltando: ${missingColumns.join(', ')}`,
          variant: 'destructive' 
        });
        return;
      }

      const mappedRows: CSVRow[] = rows
        .filter(row => row.some(cell => cell.trim()))
        .map(row => {
          const obj: Record<string, string> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj as unknown as CSVRow;
        });

      // Validate all rows (zod + sanitização + bloqueio de conteúdo malicioso)
      const results: CsvRowValidationResult[] = mappedRows.map((row, idx) =>
        validateCsvRow(row as unknown as Record<string, string>, idx + 2)
      );

      // Detectar duplicidade de telefone dentro do próprio CSV
      const seenPhones = new Set<string>();
      results.forEach((r) => {
        const phone = r.data?.telefone;
        if (phone) {
          if (seenPhones.has(phone)) {
            r.duplicate = true;
            r.valid = false;
            r.errors.push('telefone duplicado no arquivo');
          } else {
            seenPhones.add(phone);
          }
        }
      });

      const validCount = results.filter((r) => r.valid).length;
      const invalidCount = results.length - validCount;

      setValidationResults(results);
      setPreviewData(mappedRows.slice(0, 20));
      setIsPreviewReady(true);

      toast({
        title: 'Pré-validação concluída',
        description: `${validCount} válidas · ${invalidCount} rejeitadas (de ${results.length})`,
        variant: invalidCount > 0 ? 'destructive' : 'default',
      });
    };
    
    if (isExcel) {
      reader.readAsArrayBuffer(importFile);
    } else {
      reader.readAsText(importFile, 'UTF-8');
    }
  };

  const parseDate = (dateStr: string): string => {
    // Constrói ISO ancorado em BRT (-03:00) para evitar drift de fuso
    const toBrtIso = (y: number, m: number, d: number) =>
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00-03:00`;

    if (!dateStr) return new Date().toISOString();

    // Handle Excel serial date numbers
    const num = Number(dateStr);
    if (!isNaN(num) && num > 10000) {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
      return toBrtIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }

    const formats = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{2})-(\d{2})-(\d{4})$/,
    ];

    for (const fmt of formats) {
      const match = dateStr.match(fmt);
      if (match) {
        if (fmt === formats[0] || fmt === formats[2]) {
          return toBrtIso(parseInt(match[3]), parseInt(match[2]), parseInt(match[1]));
        } else {
          return toBrtIso(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
        }
      }
    }

    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime())
      ? new Date().toISOString()
      : toBrtIso(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  };

  const validateStatusFunil = (status: string): StatusFunil => {
    const validStatuses: StatusFunil[] = ['novo', 'contato_inicial', 'aula_agendada', 'aula_realizada', 'negociacao', 'convertido', 'perdido'];
    const normalized = status.toLowerCase().trim();
    return validStatuses.includes(normalized as StatusFunil) ? (normalized as StatusFunil) : 'novo';
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);

    const isExcel = importFile.name.endsWith('.xlsx') || importFile.name.endsWith('.xls');
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      let headers: string[] = [];
      let rows: string[][] = [];
      
      if (isExcel) {
        const result = parseExcel(e.target?.result as ArrayBuffer);
        headers = result.headers;
        rows = result.rows;
      } else {
        const result = parseCSV(e.target?.result as string);
        headers = result.headers;
        rows = result.rows;
      }

      const allRows: CSVRow[] = rows
        .filter(row => row.some(cell => cell.trim()))
        .map(row => {
          const obj: Record<string, string> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj as unknown as CSVRow;
        });

      // Re-validar (não confiar apenas no preview client-side)
      const results: CsvRowValidationResult[] = allRows.map((row, idx) =>
        validateCsvRow(row as unknown as Record<string, string>, idx + 2)
      );
      const seen = new Set<string>();
      results.forEach((r) => {
        const phone = r.data?.telefone;
        if (phone) {
          if (seen.has(phone)) {
            r.duplicate = true;
            r.valid = false;
            r.errors.push('telefone duplicado no arquivo');
          } else {
            seen.add(phone);
          }
        }
      });

      const rejectedCount = results.filter((r) => !r.valid).length;

      // Telefones existentes no banco (escopo da unidade)
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('telefone')
        .eq('ativo', true)
        .eq('unidade_id', unidadeAtual?.id || '')
        .not('telefone', 'is', null);

      const existingPhones = new Set(
        (existingLeads || [])
          .map((l) => l.telefone?.replace(/\D/g, ''))
          .filter(Boolean)
      );

      let successCount = 0;
      let failCount = 0;
      let duplicateCount = 0;

      const validResults = results.filter((r) => r.valid && r.data);
      const chunkSize = 100;

      for (let i = 0; i < validResults.length; i += chunkSize) {
        const chunk = validResults.slice(i, i + chunkSize);
        const leadsToInsert = chunk
          .filter((r) => {
            const phone = r.data!.telefone;
            if (phone && existingPhones.has(phone)) {
              duplicateCount++;
              return false;
            }
            if (phone) existingPhones.add(phone);
            return true;
          })
          .map((r) => {
            const d = r.data!;
            const originalRow = allRows[r.index - 2];
            return {
              nome: d.nome_completo,
              telefone: d.telefone || null,
              email: d.email || null,
              origem: validateOrigem(d.origem || originalRow?.origem),
              atendido_por: d.atendido_por || null,
              status_funil: validateStatusFunil(d.status_funil || ''),
              observacoes: d.observacoes || null,
              created_at: parseDate(d.data_cadastro || originalRow?.data_cadastro || ''),
              user_id: user?.id || null,
              created_by: user?.id || null,
              cadastrado_por: getUserDisplayName(),
              ativo: true,
              unidade_id: unidadeAtual?.id,
            };
          });

        if (leadsToInsert.length > 0) {
          const { data, error } = await supabase.from('leads').insert(leadsToInsert).select();
          if (error) {
            failCount += leadsToInsert.length;
            console.error('CSV import insert error', error);
          } else {
            successCount += data?.length || 0;
          }
        }
      }

      // Audit log (sem PII)
      console.log(JSON.stringify({
        audit: 'crm_csv_import',
        user_id: user?.id ?? null,
        unidade_id: unidadeAtual?.id ?? null,
        total: results.length,
        success: successCount,
        rejected: rejectedCount,
        duplicates: duplicateCount,
        failed: failCount,
        at: new Date().toISOString(),
      }));

      setIsImporting(false);

      if (failCount > 0 || duplicateCount > 0 || rejectedCount > 0) {
        toast({
          title: 'Importação concluída com observações',
          description: `${successCount} importados · ${rejectedCount} rejeitados · ${duplicateCount} duplicados${failCount > 0 ? ` · ${failCount} falharam` : ''}`,
          variant: failCount > 0 || rejectedCount > 0 ? 'destructive' : 'default',
        });
      } else {
        toast({ title: `Importação concluída: ${successCount} leads importados com sucesso.` });
      }

      resetImportDialog();
      setImportDialogOpen(false);
      fetchLeads();
    };
    
    if (isExcel) {
      reader.readAsArrayBuffer(importFile);
    } else {
      reader.readAsText(importFile, 'UTF-8');
    }
  };

  const resetImportDialog = () => {
    setImportFile(null);
    setPreviewData([]);
    setValidationResults([]);
    setIsPreviewReady(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        lead.nome.toLowerCase().includes(searchLower) ||
        lead.telefone?.includes(search);
      const matchesOrigem = filterOrigem === 'all' || lead.origem === filterOrigem;
      const matchesCadastradoPor = filterCadastradoPor === 'all' || lead.cadastrado_por === filterCadastradoPor;
      const matchesStatus = filterStatus.length === 0 || filterStatus.includes(lead.status_funil);
      
      // Date filter
      let matchesDate = true;
      if (startDate || endDate) {
        const leadDate = new Date(lead.created_at);
        if (startDate && leadDate < startDate) matchesDate = false;
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (leadDate > endOfDay) matchesDate = false;
        }
      }
      
      return matchesSearch && matchesOrigem && matchesCadastradoPor && matchesStatus && matchesDate;
    });
  }, [leads, search, filterOrigem, filterCadastradoPor, filterStatus, startDate, endDate]);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = filteredLeads.length;
    const convertidos = filteredLeads.filter(l => l.status_funil === 'convertido').length;
    const perdidos = filteredLeads.filter(l => l.status_funil === 'perdido').length;
    const emNegociacao = filteredLeads.filter(l => ['aula_agendada', 'aula_realizada', 'negociacao', 'follow_up'].includes(l.status_funil)).length;
    const novos = filteredLeads.filter(l => l.status_funil === 'novo').length;
    const taxaConversao = total > 0 ? ((convertidos / total) * 100).toFixed(1) : '0';
    
    return { total, convertidos, perdidos, emNegociacao, novos, taxaConversao };
  }, [filteredLeads]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const handleExportLeads = useCallback(() => {
    if (filteredLeads.length === 0) {
      toast({ title: 'Nenhum lead para exportar', variant: 'destructive' });
      return;
    }

    const rows = filteredLeads.map((lead) => ({
      Nome: lead.nome,
      Numero: lead.telefone || '',
      Status: statusLabels[lead.status_funil] || lead.status_funil,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    const periodoLabel =
      startDate && endDate
        ? `${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}`
        : 'todos';
    XLSX.writeFile(wb, `leads_${periodoLabel}.xlsx`);

    toast({ title: `${rows.length} leads exportados` });
  }, [filteredLeads, startDate, endDate, toast]);


  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                Funil de Vendas
                {unidadeAtual && (
                  <Badge variant="outline" className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary border-primary/20">
                    {unidadeAtual.nome}
                  </Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestão dos leads e conversas recebidas pelo WhatsApp
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period Filter */}
            <Select value={periodType} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="last7days">Últimos 7 dias</SelectItem>
                <SelectItem value="currentMonth">Mês atual</SelectItem>
                <SelectItem value="lastMonth">Mês passado</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {periodType === 'custom' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
            <Button variant="outline" onClick={handleExportLeads}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Dialog open={importDialogOpen} onOpenChange={(open) => {
              setImportDialogOpen(open);
              if (!open) resetImportDialog();
            }}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Importar Planilha
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Importar Leads via CSV/Excel</DialogTitle>
                  <DialogDescription>
                    Use um arquivo CSV ou Excel (.xlsx) com os cabeçalhos: nome_completo, telefone, origem, atendido_por, status_funil, data_cadastro.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Arquivo CSV ou Excel</Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        setImportFile(e.target.files?.[0] || null);
                        setIsPreviewReady(false);
                        setPreviewData([]);
                        setValidationResults([]);
                      }}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={handlePreview}
                      disabled={!importFile}
                    >
                      Pré-visualizar
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setImportDialogOpen(false);
                        resetImportDialog();
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>

                  {isPreviewReady && previewData.length > 0 && (() => {
                    const validCount = validationResults.filter((r) => r.valid).length;
                    const invalidResults = validationResults.filter((r) => !r.valid);
                    return (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="rounded-md border p-2">
                            <div className="text-muted-foreground">Total</div>
                            <div className="font-semibold">{validationResults.length}</div>
                          </div>
                          <div className="rounded-md border p-2">
                            <div className="text-muted-foreground">Válidas</div>
                            <div className="font-semibold text-emerald-600">{validCount}</div>
                          </div>
                          <div className="rounded-md border p-2">
                            <div className="text-muted-foreground">Rejeitadas</div>
                            <div className="font-semibold text-destructive">{invalidResults.length}</div>
                          </div>
                        </div>

                        {invalidResults.length > 0 && (
                          <div className="border border-destructive/30 rounded-lg bg-destructive/5">
                            <p className="text-sm font-medium p-3 border-b border-destructive/30">
                              Linhas rejeitadas (não serão importadas)
                            </p>
                            <ScrollArea className="h-[160px]">
                              <ul className="text-xs p-3 space-y-1">
                                {invalidResults.slice(0, 50).map((r) => (
                                  <li key={r.index}>
                                    <span className="font-medium">Linha {r.index}:</span>{' '}
                                    {r.errors.join(' · ')}
                                  </li>
                                ))}
                                {invalidResults.length > 50 && (
                                  <li className="text-muted-foreground">
                                    + {invalidResults.length - 50} outras linhas rejeitadas
                                  </li>
                                )}
                              </ul>
                            </ScrollArea>
                          </div>
                        )}

                        <div className="border rounded-lg">
                          <p className="text-sm text-muted-foreground p-3 border-b">
                            Pré-visualização (primeiras {previewData.length} linhas)
                          </p>
                          <ScrollArea className="h-[300px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>Telefone</TableHead>
                                  <TableHead>Origem</TableHead>
                                  <TableHead>Atendido Por</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Data</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {previewData.map((row, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{row.nome_completo}</TableCell>
                                    <TableCell>{row.telefone || '-'}</TableCell>
                                    <TableCell>{row.origem || '-'}</TableCell>
                                    <TableCell>{row.atendido_por || '-'}</TableCell>
                                    <TableCell>{row.status_funil || '-'}</TableCell>
                                    <TableCell>{row.data_cadastro || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </div>

                        <Button
                          onClick={handleImport}
                          disabled={isImporting || validCount === 0}
                          className="w-full"
                        >
                          {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          <Upload className="w-4 h-4 mr-2" />
                          Importar {validCount} linha{validCount === 1 ? '' : 's'} válida{validCount === 1 ? '' : 's'}
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Lead</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Nome completo do lead"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone *</Label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value.replace(/\D/g, '') })}
                      placeholder="11999999999"
                    />
                    <p className="text-xs text-muted-foreground">Apenas números — DDD + telefone (10 ou 11 dígitos).</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Origem *</Label>
                    <Select
                      value={formData.origem}
                      onValueChange={(value) => setFormData({ ...formData, origem: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a origem" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <ScrollArea className="h-48">
                          {ORIGEM_OPTIONS.map((origem) => (
                            <SelectItem key={origem} value={origem}>
                              {origem}
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cadastrado Por</Label>
                    <Input
                      value={getUserDisplayName()}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status_funil}
                      onValueChange={(v) => setFormData({ ...formData, status_funil: v as StatusFunil })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.status_funil === 'aula_agendada' && (
                    <>
                      <div className="space-y-2">
                        <Label>Data da Experimental *</Label>
                        <Input
                          type="date"
                          value={formData.data_aula_experimental}
                          onChange={(e) => setFormData({ ...formData, data_aula_experimental: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hora da Experimental</Label>
                        <Input
                          type="time"
                          value={formData.hora_aula_experimental}
                          onChange={(e) => setFormData({ ...formData, hora_aula_experimental: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  <Button className="w-full" onClick={handleCreate}>
                    Criar Lead
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{kpis.total}</p>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{kpis.convertidos}</p>
                  <p className="text-xs text-muted-foreground">Convertidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">{kpis.emNegociacao}</p>
                  <p className="text-xs text-muted-foreground">Em Negociação</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{kpis.perdidos}</p>
                  <p className="text-xs text-muted-foreground">Perdidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-sky-500" />
                <div>
                  <p className="text-2xl font-bold text-sky-600">{experimentaisAgendadasPeriodo}</p>
                  <p className="text-xs text-muted-foreground">Exp. Agendadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold text-purple-600">{experimentaisRealizadasPeriodo}</p>
                  <p className="text-xs text-muted-foreground">Exp. Realizadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{kpis.taxaConversao}%</p>
                  <p className="text-xs text-muted-foreground">Taxa Conversão</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{conversasCounts.total}</p>
                  <p className="text-xs text-muted-foreground">Conversas WhatsApp</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-indigo-500" />
                <div>
                  <p className="text-2xl font-bold text-indigo-600">{conversasCounts.naoVinculadas}</p>
                  <p className="text-xs text-muted-foreground">Não vinculadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">{conversasCounts.semResposta}</p>
                  <p className="text-xs text-muted-foreground">Sem resposta</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <ConversasWhatsAppSection
          onCountsChange={setConversasCounts}
          onLeadCreated={fetchLeads}
        />


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  {uniqueOrigens.map((origem) => (
                    <SelectItem key={origem} value={origem}>
                      {origem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCadastradoPor} onValueChange={setFilterCadastradoPor}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por cadastrador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cadastradores</SelectItem>
                  {uniqueCadastradoPor.map((cadastrador) => (
                    <SelectItem key={cadastrador} value={cadastrador}>
                      {cadastrador}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between font-normal">
                    <span className="truncate">
                      {filterStatus.length === 0
                        ? 'Todos os status'
                        : filterStatus.length === 1
                        ? statusOptions.find((o) => o.value === filterStatus[0])?.label ?? filterStatus[0]
                        : `${filterStatus.length} status selecionados`}
                    </span>
                    <Filter className="w-4 h-4 ml-2 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 bg-popover" align="start">
                  <div className="flex items-center justify-between px-2 py-1 mb-1">
                    <span className="text-xs text-muted-foreground">Filtrar status</span>
                    {filterStatus.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setFilterStatus([])}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {statusOptions.map((opt) => {
                      const checked = filterStatus.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setFilterStatus((prev) =>
                                v
                                  ? [...prev, opt.value]
                                  : prev.filter((s) => s !== opt.value)
                              );
                            }}
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">
                Nenhum lead encontrado
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome Completo</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Experimental</TableHead>
                      <TableHead>Hora Experimental</TableHead>
                      <TableHead>Cadastrado Por</TableHead>
                      <TableHead>Data Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow 
                        key={lead.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/lead/${lead.id}`)}
                      >
                        <TableCell className="font-medium">{lead.nome?.toUpperCase()}</TableCell>
                        <TableCell><WhatsAppLink phone={lead.telefone} /></TableCell>
                        <TableCell>{lead.origem || '-'}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                            {statusLabels[lead.status_funil]}
                          </span>
                        </TableCell>
                        <TableCell>
                          {lead.data_aula_experimental 
                            ? format(new Date(lead.data_aula_experimental), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {lead.hora_aula_experimental 
                            ? lead.hora_aula_experimental.slice(0, 5)
                            : '-'}
                        </TableCell>
                        <TableCell>{lead.cadastrado_por?.toUpperCase() || '-'}</TableCell>
                        <TableCell>{formatDate(lead.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/lead/${lead.id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/lead/${lead.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setLeadToDelete(lead.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
              <AlertDialogDescription>
                O lead será arquivado e não aparecerá mais na listagem.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
