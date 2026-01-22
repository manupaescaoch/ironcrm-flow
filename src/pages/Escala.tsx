import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Edit, Trash2, Copy, Clock, Calendar, FileDown, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ImportarTextoModal } from '@/components/escala/ImportarTextoModal';

interface Escala {
  id: string;
  unidade_id: string;
  mes: number;
  ano: number;
  final_de_semana: string;
  treinador: string | null;
  recepcao: string | null;
  servicos_gerais: string | null;
  seguranca: string | null;
  feriado: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

interface Unidade {
  id: string;
  nome: string;
}

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const ANOS = Array.from({ length: 7 }, (_, i) => 2024 + i);

const EscalaPage = () => {
  const { isAdmin } = useAuth();
  const { unidadeAtual, unidadesPermitidas } = useUnidade();
  
  // Filters
  const [filterUnidade, setFilterUnidade] = useState<string>('all');
  const [filterMes, setFilterMes] = useState<string>('all');
  const [filterAno, setFilterAno] = useState<string>(new Date().getFullYear().toString());
  const [filterFeriado, setFilterFeriado] = useState<string>('all');
  
  // Data
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importarTextoOpen, setImportarTextoOpen] = useState(false);
  const [editingEscala, setEditingEscala] = useState<Escala | null>(null);
  const [deletingEscala, setDeletingEscala] = useState<Escala | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    unidade_id: '',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    final_de_semana: '',
    treinador: '',
    recepcao: '',
    servicos_gerais: '',
    seguranca: '',
    feriado: false,
    observacoes: '',
  });

  useEffect(() => {
    fetchUnidades();
  }, []);

  useEffect(() => {
    if (unidadeAtual) {
      setFilterUnidade(unidadeAtual.id);
      setFormData(prev => ({ ...prev, unidade_id: unidadeAtual.id }));
    }
  }, [unidadeAtual]);

  useEffect(() => {
    fetchEscalas();
  }, [filterUnidade, filterMes, filterAno, filterFeriado]);

  const fetchUnidades = async () => {
    const { data, error } = await supabase
      .from('unidades')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');
    
    if (!error && data) {
      setUnidades(data);
    }
  };

  const fetchEscalas = async () => {
    setLoading(true);
    let query = supabase
      .from('escala')
      .select('*')
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .order('final_de_semana');

    if (filterUnidade && filterUnidade !== 'all') {
      query = query.eq('unidade_id', filterUnidade);
    }
    if (filterMes && filterMes !== 'all') {
      query = query.eq('mes', parseInt(filterMes));
    }
    if (filterAno && filterAno !== 'all') {
      query = query.eq('ano', parseInt(filterAno));
    }
    if (filterFeriado && filterFeriado !== 'all') {
      query = query.eq('feriado', filterFeriado === 'sim');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching escalas:', error);
      toast.error('Erro ao carregar escalas');
    } else {
      setEscalas(data || []);
    }
    setLoading(false);
  };

  const handleOpenDialog = (escala?: Escala) => {
    if (escala) {
      setEditingEscala(escala);
      setFormData({
        unidade_id: escala.unidade_id,
        mes: escala.mes,
        ano: escala.ano,
        final_de_semana: escala.final_de_semana,
        treinador: escala.treinador || '',
        recepcao: escala.recepcao || '',
        servicos_gerais: escala.servicos_gerais || '',
        seguranca: escala.seguranca || '',
        feriado: escala.feriado,
        observacoes: escala.observacoes || '',
      });
    } else {
      setEditingEscala(null);
      setFormData({
        unidade_id: unidadeAtual?.id || '',
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear(),
        final_de_semana: '',
        treinador: '',
        recepcao: '',
        servicos_gerais: '',
        seguranca: '',
        feriado: false,
        observacoes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleDuplicate = (escala: Escala) => {
    setEditingEscala(null);
    setFormData({
      unidade_id: escala.unidade_id,
      mes: escala.mes,
      ano: escala.ano,
      final_de_semana: '',
      treinador: escala.treinador || '',
      recepcao: escala.recepcao || '',
      servicos_gerais: escala.servicos_gerais || '',
      seguranca: escala.seguranca || '',
      feriado: false,
      observacoes: '',
    });
    setDialogOpen(true);
  };

  const handleFeriadoChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      feriado: checked,
      observacoes: checked && !prev.observacoes ? 'FERIADO' : prev.observacoes,
    }));
  };

  const handleSave = async () => {
    if (!formData.unidade_id || !formData.final_de_semana) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const payload = {
      unidade_id: formData.unidade_id,
      mes: formData.mes,
      ano: formData.ano,
      final_de_semana: formData.final_de_semana,
      treinador: formData.treinador || null,
      recepcao: formData.recepcao || null,
      servicos_gerais: formData.servicos_gerais || null,
      seguranca: formData.seguranca || null,
      feriado: formData.feriado,
      observacoes: formData.observacoes || null,
    };

    if (editingEscala) {
      const { error } = await supabase
        .from('escala')
        .update(payload)
        .eq('id', editingEscala.id);

      if (error) {
        toast.error('Erro ao atualizar escala');
        console.error(error);
      } else {
        toast.success('Escala atualizada com sucesso');
        setDialogOpen(false);
        fetchEscalas();
      }
    } else {
      const { error } = await supabase
        .from('escala')
        .insert(payload);

      if (error) {
        toast.error('Erro ao criar escala');
        console.error(error);
      } else {
        toast.success('Escala criada com sucesso');
        setDialogOpen(false);
        fetchEscalas();
      }
    }
  };

  const handleDelete = async () => {
    if (!deletingEscala) return;

    const { error } = await supabase
      .from('escala')
      .delete()
      .eq('id', deletingEscala.id);

    if (error) {
      toast.error('Erro ao excluir escala');
      console.error(error);
    } else {
      toast.success('Escala excluída com sucesso');
      setDeleteDialogOpen(false);
      setDeletingEscala(null);
      fetchEscalas();
    }
  };

  const getUnidadeNome = (unidadeId: string) => {
    return unidades.find(u => u.id === unidadeId)?.nome || 'N/A';
  };

  const getMesNome = (mes: number) => {
    return MESES.find(m => m.value === mes)?.label || 'N/A';
  };

  const handleExportPDF = () => {
    if (escalas.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Title
    const unidadeNome = filterUnidade !== 'all' ? getUnidadeNome(filterUnidade) : 'Todas as Unidades';
    const mesNome = filterMes !== 'all' ? getMesNome(parseInt(filterMes)) : 'Todos os Meses';
    const anoTexto = filterAno !== 'all' ? filterAno : 'Todos os Anos';
    
    doc.setFontSize(18);
    doc.text('ESCALA DE TRABALHO', 148, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`${unidadeNome} - ${mesNome}/${anoTexto}`, 148, 23, { align: 'center' });
    
    // Horários info
    doc.setFontSize(9);
    doc.text('Horários: Treinador 08h-14h | Recepção 08h-12h | Serviços Gerais 10h-14h | Segurança 10h-14h', 148, 30, { align: 'center' });

    // Table data
    const tableData = escalas.map(escala => [
      getUnidadeNome(escala.unidade_id),
      `${getMesNome(escala.mes)}/${escala.ano}`,
      escala.final_de_semana,
      escala.treinador || '-',
      escala.recepcao || '-',
      escala.servicos_gerais || '-',
      escala.seguranca || '-',
      escala.feriado ? 'Sim' : 'Não',
      escala.observacoes || '-',
    ]);

    autoTable(doc, {
      head: [['Unidade', 'Mês/Ano', 'Final de Semana', 'Treinador', 'Recepção', 'Serv. Gerais', 'Segurança', 'Feriado', 'Observações']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      bodyStyles: { textColor: 50 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data) => {
        // Highlight holiday rows
        if (data.section === 'body') {
          const rowIndex = data.row.index;
          if (escalas[rowIndex]?.feriado) {
            data.cell.styles.fillColor = [255, 237, 213];
          }
        }
      },
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 35;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('A escala exibida é a referência oficial da unidade. Alterações só têm validade quando atualizadas no sistema.', 148, finalY + 10, { align: 'center' });
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 148, finalY + 15, { align: 'center' });

    // Save
    const fileName = `escala_${unidadeNome.replace(/\s+/g, '_')}_${mesNome}_${anoTexto}.pdf`;
    doc.save(fileName);
    toast.success('PDF exportado com sucesso!');
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Escala</h1>
            {unidadeAtual && (
              <Badge variant="outline" className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary border-primary/20">
                {unidadeAtual.nome}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPDF} disabled={escalas.length === 0}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => setImportarTextoOpen(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Importar Texto
                </Button>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Escala
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Info Block */}
        <Card className="mb-6 bg-muted/50 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Horários Padrão - Final de Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Treinador:</span>
                <span className="text-muted-foreground">08h às 14h</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Recepção:</span>
                <span className="text-muted-foreground">08h às 12h</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Serviços Gerais:</span>
                <span className="text-muted-foreground">10h às 14h</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Segurança:</span>
                <span className="text-muted-foreground">10h às 14h</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Unidade</label>
                <Select value={filterUnidade} onValueChange={setFilterUnidade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {unidadesPermitidas.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Mês</label>
                <Select value={filterMes} onValueChange={setFilterMes}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {MESES.map(m => (
                      <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Ano</label>
                <Select value={filterAno} onValueChange={setFilterAno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ANOS.map(a => (
                      <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Feriado</label>
                <Select value={filterFeriado} onValueChange={setFilterFeriado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Mês/Ano</TableHead>
                    <TableHead>Final de Semana</TableHead>
                    <TableHead>Treinador</TableHead>
                    <TableHead>Recepção</TableHead>
                    <TableHead>Serviços Gerais</TableHead>
                    <TableHead>Segurança</TableHead>
                    <TableHead>Feriado</TableHead>
                    <TableHead>Observações</TableHead>
                    {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : escalas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-muted-foreground">
                        Nenhuma escala encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    escalas.map((escala) => (
                      <TableRow 
                        key={escala.id}
                        className={escala.feriado ? 'bg-amber-500/10 hover:bg-amber-500/20' : ''}
                      >
                        <TableCell className="font-medium">{getUnidadeNome(escala.unidade_id)}</TableCell>
                        <TableCell>{getMesNome(escala.mes)}/{escala.ano}</TableCell>
                        <TableCell>{escala.final_de_semana}</TableCell>
                        <TableCell>{escala.treinador || '-'}</TableCell>
                        <TableCell>{escala.recepcao || '-'}</TableCell>
                        <TableCell>{escala.servicos_gerais || '-'}</TableCell>
                        <TableCell>{escala.seguranca || '-'}</TableCell>
                        <TableCell>
                          {escala.feriado ? (
                            <Badge className="bg-amber-500 text-white">Sim</Badge>
                          ) : (
                            <Badge variant="secondary">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{escala.observacoes || '-'}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDuplicate(escala)}
                                title="Duplicar"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(escala)}
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeletingEscala(escala);
                                  setDeleteDialogOpen(true);
                                }}
                                title="Excluir"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border text-center text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 inline-block mr-2" />
          A escala exibida nesta página é a referência oficial da unidade.
          Alterações só têm validade quando atualizadas aqui.
        </div>

        {/* Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEscala ? 'Editar Escala' : 'Nova Escala'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Unidade *</label>
                  <Select 
                    value={formData.unidade_id} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, unidade_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Final de Semana *</label>
                  <Input 
                    placeholder="Ex: 03 e 04" 
                    value={formData.final_de_semana}
                    onChange={(e) => setFormData(prev => ({ ...prev, final_de_semana: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Mês</label>
                  <Select 
                    value={formData.mes.toString()} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, mes: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map(m => (
                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Ano</label>
                  <Select 
                    value={formData.ano.toString()} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, ano: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANOS.map(a => (
                        <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Treinador</label>
                  <Input 
                    placeholder="Nome do treinador"
                    value={formData.treinador}
                    onChange={(e) => setFormData(prev => ({ ...prev, treinador: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Recepção</label>
                  <Input 
                    placeholder="Nome do responsável"
                    value={formData.recepcao}
                    onChange={(e) => setFormData(prev => ({ ...prev, recepcao: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Serviços Gerais</label>
                  <Input 
                    placeholder="Nome do responsável"
                    value={formData.servicos_gerais}
                    onChange={(e) => setFormData(prev => ({ ...prev, servicos_gerais: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Segurança</label>
                  <Input 
                    placeholder="Nome do responsável"
                    value={formData.seguranca}
                    onChange={(e) => setFormData(prev => ({ ...prev, seguranca: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="feriado" 
                  checked={formData.feriado}
                  onCheckedChange={handleFeriadoChange}
                />
                <label htmlFor="feriado" className="text-sm font-medium cursor-pointer">
                  Feriado
                </label>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Observações</label>
                <Textarea 
                  placeholder="Ex: FERIADO, ESCALA REDUZIDA, FUNCIONAMENTO ESPECIAL"
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingEscala ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta escala? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Importar Texto Modal */}
        <ImportarTextoModal
          open={importarTextoOpen}
          onOpenChange={setImportarTextoOpen}
          unidades={unidades.map(u => ({ ...u, slug: u.nome.toLowerCase().replace(/\s+/g, '-') }))}
          onSuccess={fetchEscalas}
        />
      </div>
    </Layout>
  );
};

export default EscalaPage;
