import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, StatusFunil, PlanoEscolhido } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Eye, Trash2, Loader2, Pencil, Filter, Upload, FileSpreadsheet } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const statusOptions: { value: StatusFunil; label: string }[] = [
  { value: 'novo', label: 'Novo' },
  { value: 'contato_inicial', label: 'Contato Inicial' },
  { value: 'aula_agendada', label: 'Aula Agendada' },
  { value: 'aula_realizada', label: 'Aula Realizada' },
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

const statusLabels: Record<StatusFunil, string> = {
  novo: 'Novo',
  contato_inicial: 'Contato Inicial',
  aula_agendada: 'Aula Agendada',
  aula_realizada: 'Aula Realizada',
  negociacao: 'Negociação',
  convertido: 'Convertido',
  perdido: 'Perdido',
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

export default function CRM() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOrigem, setFilterOrigem] = useState<string>('all');
  const [filterCadastradoPor, setFilterCadastradoPor] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    origem: '',
    status_funil: 'novo' as StatusFunil,
  });

  // Get user display name for "Cadastrado Por" field
  const getUserDisplayName = () => {
    if (!user) return '';
    // Try to get name from user metadata, fallback to email
    const metadata = user.user_metadata as Record<string, unknown> | undefined;
    const name = metadata?.full_name || metadata?.name || metadata?.display_name;
    return typeof name === 'string' && name.trim() ? name.trim() : (user.email || 'Usuário');
  };
  const { toast } = useToast();

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar leads', variant: 'destructive' });
    } else {
      setLeads((data as unknown as Lead[]) || []);
    }
    setLoading(false);
  };

  const uniqueOrigens = useMemo(() => {
    const origens = leads.map(l => l.origem).filter(Boolean) as string[];
    return [...new Set(origens)];
  }, [leads]);

  const uniqueCadastradoPor = useMemo(() => {
    const cadastradores = leads.map(l => l.cadastrado_por).filter(Boolean) as string[];
    return [...new Set(cadastradores)];
  }, [leads]);

  const handleCreate = async () => {
    if (!formData.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('leads').insert({
      nome: formData.nome.trim(),
      email: formData.email.trim() || null,
      telefone: formData.telefone.trim() || null,
      origem: formData.origem.trim() || null,
      status_funil: formData.status_funil,
      cadastrado_por: getUserDisplayName(),
      ativo: true,
      user_id: user?.id || null,
      created_by: user?.id || null,
    });

    if (error) {
      toast({ title: 'Erro ao criar lead', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lead criado com sucesso!' });
      setDialogOpen(false);
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        origem: '',
        status_funil: 'novo',
      });
      fetchLeads();
    }
  };

  const handleDelete = async () => {
    if (!leadToDelete) return;

    const { error } = await supabase
      .from('leads')
      .update({ ativo: false })
      .eq('id', leadToDelete);

    if (error) {
      toast({ title: 'Erro ao excluir lead', variant: 'destructive' });
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

      setPreviewData(mappedRows.slice(0, 20));
      setIsPreviewReady(true);
    };
    
    if (isExcel) {
      reader.readAsArrayBuffer(importFile);
    } else {
      reader.readAsText(importFile, 'UTF-8');
    }
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString();
    
    // Handle Excel serial date numbers
    const num = Number(dateStr);
    if (!isNaN(num) && num > 10000) {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
      return date.toISOString();
    }
    
    const formats = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{2})-(\d{2})-(\d{4})$/,
    ];
    
    for (const fmt of formats) {
      const match = dateStr.match(fmt);
      if (match) {
        if (fmt === formats[0]) {
          return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1])).toISOString();
        } else if (fmt === formats[1]) {
          return new Date(dateStr).toISOString();
        } else if (fmt === formats[2]) {
          return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1])).toISOString();
        }
      }
    }
    
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
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

      let successCount = 0;
      let failCount = 0;

      const chunkSize = 100;
      for (let i = 0; i < allRows.length; i += chunkSize) {
        const chunk = allRows.slice(i, i + chunkSize);
        const leadsToInsert = chunk
          .filter(row => row.nome_completo?.trim())
          .map(row => ({
            nome: row.nome_completo.trim(),
            telefone: row.telefone?.trim() || null,
            origem: row.origem?.trim() || null,
            atendido_por: row.atendido_por?.trim() || null,
            status_funil: validateStatusFunil(row.status_funil),
            created_at: parseDate(row.data_cadastro),
            user_id: user?.id || null,
            created_by: user?.id || null,
            ativo: true,
          }));

        if (leadsToInsert.length > 0) {
          const { data, error } = await supabase.from('leads').insert(leadsToInsert).select();
          if (error) {
            failCount += leadsToInsert.length;
          } else {
            successCount += data?.length || 0;
          }
        }
      }

      setIsImporting(false);
      
      if (failCount > 0) {
        toast({ 
          title: 'Algumas linhas não puderam ser importadas. Verifique o arquivo.',
          description: `${successCount} importados, ${failCount} falharam`,
          variant: 'destructive'
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
      const matchesStatus = filterStatus === 'all' || lead.status_funil === filterStatus;
      return matchesSearch && matchesOrigem && matchesCadastradoPor && matchesStatus;
    });
  }, [leads, search, filterOrigem, filterCadastradoPor, filterStatus]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">CRM - Leads</h1>
          <div className="flex items-center gap-2">
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

                  {isPreviewReady && previewData.length > 0 && (
                    <>
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
                        disabled={isImporting}
                        className="w-full"
                      >
                        {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <Upload className="w-4 h-4 mr-2" />
                        Importar agora
                      </Button>
                    </>
                  )}
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
              <DialogContent className="max-w-md">
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
                    <Label>Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Origem</Label>
                    <Input
                      value={formData.origem}
                      onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                      placeholder="Instagram, Indicação, etc."
                    />
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
                  <Button className="w-full" onClick={handleCreate}>
                    Criar Lead
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

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
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                        onClick={() => window.location.href = `/lead/${lead.id}`}
                      >
                        <TableCell className="font-medium">{lead.nome}</TableCell>
                        <TableCell><WhatsAppLink phone={lead.telefone} /></TableCell>
                        <TableCell>{lead.origem || '-'}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                            {statusLabels[lead.status_funil]}
                          </span>
                        </TableCell>
                        <TableCell>{lead.cadastrado_por || '-'}</TableCell>
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
