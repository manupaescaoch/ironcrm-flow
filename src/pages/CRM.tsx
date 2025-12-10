import { useEffect, useState, useMemo } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, StatusFunil, PlanoEscolhido } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Eye, Trash2, Loader2, Pencil, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function CRM() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOrigem, setFilterOrigem] = useState<string>('all');
  const [filterAtendidoPor, setFilterAtendidoPor] = useState<string>('all');
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
    plano_escolhido: '' as PlanoEscolhido | '',
    atendido_por: '',
  });
  const { toast } = useToast();

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

  // Extract unique values for filters
  const uniqueOrigens = useMemo(() => {
    const origens = leads.map(l => l.origem).filter(Boolean) as string[];
    return [...new Set(origens)];
  }, [leads]);

  const uniqueAtendidoPor = useMemo(() => {
    const atendentes = leads.map(l => l.atendido_por).filter(Boolean) as string[];
    return [...new Set(atendentes)];
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
      plano_escolhido: formData.plano_escolhido || null,
      atendido_por: formData.atendido_por.trim() || null,
      ativo: true,
      user_id: user?.id || null,
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
        plano_escolhido: '',
        atendido_por: '',
      });
      fetchLeads();
    }
  };

  const handleDelete = async () => {
    if (!leadToDelete) return;

    // Soft delete
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

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        lead.nome.toLowerCase().includes(searchLower) ||
        lead.telefone?.includes(search);

      // Origem filter
      const matchesOrigem = filterOrigem === 'all' || lead.origem === filterOrigem;

      // Atendido por filter
      const matchesAtendidoPor = filterAtendidoPor === 'all' || lead.atendido_por === filterAtendidoPor;

      // Status filter
      const matchesStatus = filterStatus === 'all' || lead.status_funil === filterStatus;

      return matchesSearch && matchesOrigem && matchesAtendidoPor && matchesStatus;
    });
  }, [leads, search, filterOrigem, filterAtendidoPor, filterStatus]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">CRM - Leads</h1>
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
                  <Label>Atendido Por</Label>
                  <Input
                    value={formData.atendido_por}
                    onChange={(e) => setFormData({ ...formData, atendido_por: e.target.value })}
                    placeholder="Nome do atendente"
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
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select
                    value={formData.plano_escolhido}
                    onValueChange={(v) => setFormData({ ...formData, plano_escolhido: v as PlanoEscolhido })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {planoOptions.map((plano) => (
                        <SelectItem key={plano} value={plano}>
                          {plano}
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
              <Select value={filterAtendidoPor} onValueChange={setFilterAtendidoPor}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por atendente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os atendentes</SelectItem>
                  {uniqueAtendidoPor.map((atendente) => (
                    <SelectItem key={atendente} value={atendente}>
                      {atendente}
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
                      <TableHead>Atendido Por</TableHead>
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
                        <TableCell>{lead.telefone || '-'}</TableCell>
                        <TableCell>{lead.origem || '-'}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                            {statusLabels[lead.status_funil]}
                          </span>
                        </TableCell>
                        <TableCell>{lead.atendido_por || '-'}</TableCell>
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