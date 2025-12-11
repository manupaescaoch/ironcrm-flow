import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, Interacao, StatusFunil, PlanoEscolhido } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, Loader2, MessageSquare, User, Pencil, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

interface InteracaoForm {
  id?: string;
  tipo: string;
  descricao: string;
  atendido_por: string;
  atendido_por_tipo: string;
  agendou_experimental: boolean;
  data_experimental: string;
  hora_experimental: string;
  compareceu: boolean;
  reagendou: boolean;
  fechou_matricula: boolean;
  plano_escolhido: string;
  valor_plano: number;
  data_fechamento: string;
  responsavel_fechamento: string;
  treinador_responsavel: string;
}

const initialFormState: InteracaoForm = {
  tipo: '',
  descricao: '',
  atendido_por: '',
  atendido_por_tipo: 'espontaneo_recepcao',
  agendou_experimental: false,
  data_experimental: '',
  hora_experimental: '',
  compareceu: false,
  reagendou: false,
  fechou_matricula: false,
  plano_escolhido: '',
  valor_plano: 0,
  data_fechamento: '',
  responsavel_fechamento: '',
  treinador_responsavel: '',
};

const atendidoPorOptions = [
  { value: 'comercial', label: 'Comercial (agendamento)' },
  { value: 'espontaneo_recepcao', label: 'Espontâneo Recepção' },
];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin, canEditLead: canEditLeadAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingInteracao, setSavingInteracao] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [canEditCurrentInteracao, setCanEditCurrentInteracao] = useState(true);
  const [formData, setFormData] = useState<InteracaoForm>(initialFormState);

  // Permission check: admin can edit any lead, others can only edit leads they created
  const canEditLead = lead ? canEditLeadAuth(lead.created_by) : false;

  // Permission check for interacao: admin can edit any, others can only edit their own
  const canEditInteracao = (interacao: Interacao): boolean => {
    if (isAdmin) return true;
    if (!user || !interacao.created_by) return false;
    return interacao.created_by === user.id;
  };

  // Calculate commissions based on new rules:
  // Cadastrador (who registered the lead) gets 3%
  // Fechador (responsavel_fechamento) gets 2%
  const calculateCommissions = () => {
    if (!formData.fechou_matricula) {
      return { cadastrador: 0, fechador: 0 };
    }
    const V = formData.valor_plano;
    // Cadastrador gets 3% (from lead.cadastrado_por)
    const cadastrador = V * 0.03;
    // Fechador gets 2% (responsavel_fechamento)
    const fechador = V * 0.02;
    return { cadastrador, fechador };
  };
  const { cadastrador: comissaoCadastrador, fechador: comissaoFechador } = calculateCommissions();

  useEffect(() => {
    if (id) {
      fetchLead();
      fetchInteracoes();
    }
  }, [id]);

  const fetchLead = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      toast({ title: 'Lead não encontrado', variant: 'destructive' });
      navigate('/crm');
      return;
    }
    setLead(data as unknown as Lead);
    setLoading(false);
  };

  const fetchInteracoes = async () => {
    const { data } = await supabase
      .from('interacoes')
      .select('*')
      .eq('lead_id', id)
      .order('data_interacao', { ascending: false });

    setInteracoes((data as unknown as Interacao[]) || []);
  };

  const determineNewStatus = (form: InteracaoForm): StatusFunil => {
    if (form.fechou_matricula) return 'convertido';
    if (form.compareceu) return 'aula_realizada';
    if (form.agendou_experimental || form.reagendou) return 'aula_agendada';
    return lead?.status_funil || 'novo';
  };

  const handleSaveLead = async () => {
    if (!lead) return;
    setSaving(true);

    const { error } = await supabase
      .from('leads')
      .update({
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        origem: lead.origem,
        status_funil: lead.status_funil,
        cadastrado_por: lead.cadastrado_por,
        data_aula_experimental: lead.data_aula_experimental,
        observacoes: lead.observacoes,
      })
      .eq('id', id);

    setSaving(false);

    if (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } else {
      toast({ title: 'Lead atualizado!' });
    }
  };

  // Get user display name for forms
  const getUserDisplayName = () => {
    if (!user) return '';
    const metadata = user.user_metadata as Record<string, unknown> | undefined;
    const name = metadata?.full_name || metadata?.name || metadata?.display_name;
    return typeof name === 'string' && name.trim() ? name.trim() : (user.email || 'Usuário');
  };

  const openNewInteracao = () => {
    setFormData({
      ...initialFormState,
      atendido_por: getUserDisplayName(),
    });
    setIsEditing(false);
    setCanEditCurrentInteracao(true); // New interacoes can always be edited
    setSheetOpen(true);
  };

  const openEditInteracao = (interacao: Interacao) => {
    // Check if user can edit this interaction
    const canEdit = canEditInteracao(interacao);
    setCanEditCurrentInteracao(canEdit);
    
    setFormData({
      id: interacao.id,
      tipo: interacao.tipo || '',
      descricao: interacao.descricao || '',
      atendido_por: interacao.atendido_por || '',
      atendido_por_tipo: interacao.atendido_por_tipo || 'espontaneo_recepcao',
      agendou_experimental: interacao.agendou_experimental || false,
      data_experimental: interacao.data_experimental || '',
      hora_experimental: interacao.hora_experimental || '',
      compareceu: interacao.compareceu || false,
      reagendou: interacao.reagendou || false,
      fechou_matricula: interacao.fechou_matricula || false,
      plano_escolhido: interacao.plano_escolhido || '',
      valor_plano: interacao.valor_plano || 0,
      data_fechamento: interacao.data_fechamento || '',
      responsavel_fechamento: interacao.responsavel_fechamento || '',
      treinador_responsavel: interacao.treinador_responsavel || '',
    });
    setIsEditing(true);
    setSheetOpen(true);
  };

  const handleSaveInteracao = async () => {
    if (!formData.tipo.trim()) {
      toast({ title: 'Tipo da interação é obrigatório', variant: 'destructive' });
      return;
    }


    // Validate required fields when fechou_matricula = true
    if (formData.fechou_matricula) {
      if (!formData.responsavel_fechamento.trim()) {
        toast({ title: 'Responsável pelo Fechamento é obrigatório para matrículas', variant: 'destructive' });
        return;
      }
    }

    setSavingInteracao(true);

    const newStatus = determineNewStatus(formData);

    const interacaoData = {
      tipo: formData.tipo.trim(),
      descricao: formData.descricao.trim() || null,
      atendido_por: formData.atendido_por || null,
      atendido_por_tipo: formData.atendido_por_tipo,
      agendou_experimental: formData.agendou_experimental,
      data_experimental: formData.data_experimental || null,
      hora_experimental: formData.hora_experimental || null,
      compareceu: formData.compareceu,
      reagendou: formData.reagendou,
      fechou_matricula: formData.fechou_matricula,
      plano_escolhido: formData.plano_escolhido || null,
      valor_plano: formData.valor_plano || 0,
      // New commission logic: cadastrador (3%) from lead, fechador (2%) from responsavel_fechamento
      comissao_comercial: comissaoCadastrador,
      comissao_recepcao: comissaoFechador,
      comissao_cadastrador: comissaoCadastrador,
      cadastrado_por: lead?.cadastrado_por || null,
      data_fechamento: formData.data_fechamento || null,
      responsavel_fechamento: formData.responsavel_fechamento.trim() || null,
      treinador_responsavel: formData.treinador_responsavel.trim() || null,
    };

    let interacaoError;

    if (isEditing && formData.id) {
      // Update existing interaction
      const { error } = await supabase
        .from('interacoes')
        .update(interacaoData)
        .eq('id', formData.id);
      interacaoError = error;
    } else {
      // Create new interaction
      const { error } = await supabase.from('interacoes').insert({
        ...interacaoData,
        lead_id: id,
        data_interacao: new Date().toISOString(),
        created_by: user?.id || null,
      });
      interacaoError = error;
    }

    if (interacaoError) {
      toast({ title: 'Erro ao salvar interação', variant: 'destructive' });
      setSavingInteracao(false);
      return;
    }

    // Update lead status
    const { error: leadError } = await supabase
      .from('leads')
      .update({ status_funil: newStatus })
      .eq('id', id);

    if (leadError) {
      toast({ title: 'Erro ao atualizar status do lead', variant: 'destructive' });
    } else {
      toast({ title: isEditing ? 'Interação atualizada!' : 'Interação adicionada!' });
      setFormData(initialFormState);
      setSheetOpen(false);
      // Reload data
      fetchInteracoes();
      fetchLead();
    }

    setSavingInteracao(false);
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

  const formatDateTime = (dateString: string | null, timeString: string | null) => {
    if (!dateString) return '-';
    const datePart = format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    if (timeString) {
      return `${datePart} às ${timeString}`;
    }
    return datePart;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!lead) return null;

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/crm')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{lead.nome}</h1>
              <p className="text-muted-foreground">
                Cadastrado em {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>

        {/* Lead Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Nome Completo</p>
              <p className="font-semibold truncate">{lead.nome}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Telefone</p>
              <div className="font-semibold">
                <WhatsAppLink phone={lead.telefone} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Origem</p>
              <p className="font-semibold">{lead.origem || '-'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-semibold">{statusOptions.find(s => s.value === lead.status_funil)?.label}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Cadastrado Por</p>
              <p className="font-semibold">{lead.cadastrado_por || '-'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Data Cadastro</p>
              <p className="font-semibold">{formatDate(lead.created_at)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Lead Edit Form */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {canEditLead ? 'Editar Lead' : 'Detalhes do Lead'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canEditLead && (
                  <Alert variant="default" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Você não pode editar este lead. Ele foi criado por outro usuário.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={lead.nome}
                    onChange={(e) => setLead({ ...lead, nome: e.target.value })}
                    disabled={!canEditLead}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={lead.email || ''}
                    onChange={(e) => setLead({ ...lead, email: e.target.value })}
                    disabled={!canEditLead}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={lead.telefone || ''}
                    onChange={(e) => setLead({ ...lead, telefone: e.target.value })}
                    disabled={!canEditLead}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Input
                    value={lead.origem || ''}
                    onChange={(e) => setLead({ ...lead, origem: e.target.value })}
                    disabled={!canEditLead}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cadastrado Por</Label>
                  <Input
                    value={lead.cadastrado_por || ''}
                    onChange={(e) => setLead({ ...lead, cadastrado_por: e.target.value })}
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status do Funil</Label>
                  <Select
                    value={lead.status_funil}
                    onValueChange={(v) => setLead({ ...lead, status_funil: v as StatusFunil })}
                    disabled={!canEditLead}
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
                  <Label>Observações</Label>
                  <Textarea
                    rows={3}
                    value={lead.observacoes || ''}
                    onChange={(e) => setLead({ ...lead, observacoes: e.target.value })}
                    disabled={!canEditLead}
                  />
                </div>
                {canEditLead && (
                  <Button onClick={handleSaveLead} disabled={saving} className="w-full">
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Lead
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Interactions Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Interações ({interacoes.length})
                </CardTitle>
                <Button onClick={openNewInteracao}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Interação
                </Button>
              </CardHeader>
              <CardContent>
                {interacoes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhuma interação registrada
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Atendente</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {interacoes.map((int) => (
                          <TableRow key={int.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditInteracao(int)}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(int.data_interacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </TableCell>
                            <TableCell>{int.tipo}</TableCell>
                            <TableCell>
                              {int.atendido_por_tipo === 'comercial' ? 'Comercial' : 
                               int.atendido_por_tipo === 'espontaneo_recepcao' ? 'Espontâneo' : 
                               int.atendido_por || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 text-xs">
                                <span className="flex items-center gap-1">
                                  {int.agendou_experimental ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-muted-foreground" />}
                                  Agendou
                                </span>
                                <span className="flex items-center gap-1">
                                  {int.compareceu ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-muted-foreground" />}
                                  Compareceu
                                </span>
                                <span className="flex items-center gap-1">
                                  {int.fechou_matricula ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-muted-foreground" />}
                                  Matriculou
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{int.plano_escolhido || '-'}</TableCell>
                            <TableCell>{int.valor_plano > 0 ? formatCurrency(int.valor_plano) : '-'}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditInteracao(int); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detailed Interactions History */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico Detalhado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {interacoes.map((int) => (
                    <div
                      key={int.id}
                      className="p-4 bg-muted/30 rounded-lg space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openEditInteracao(int)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{int.tipo}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(int.data_interacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {int.descricao && (
                        <p className="text-sm text-muted-foreground">{int.descricao}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Atendido por: </span>
                          <span className="font-medium">
                            {int.atendido_por_tipo === 'comercial' ? 'Comercial (agendamento)' : 
                             int.atendido_por_tipo === 'espontaneo_recepcao' ? 'Espontâneo Recepção' : 
                             int.atendido_por || '-'}
                          </span>
                        </div>
                        {int.data_experimental && (
                          <div>
                            <span className="text-muted-foreground">Data Exp: </span>
                            <span className="font-medium">{formatDateTime(int.data_experimental, int.hora_experimental)}</span>
                          </div>
                        )}
                        {int.treinador_responsavel && (
                          <div>
                            <span className="text-muted-foreground">Treinador Resp.: </span>
                            <span className="font-medium">{int.treinador_responsavel}</span>
                          </div>
                        )}
                        {int.responsavel_fechamento && (
                          <div>
                            <span className="text-muted-foreground">Resp. Fechamento: </span>
                            <span className="font-medium">{int.responsavel_fechamento}</span>
                          </div>
                        )}
                        {int.data_fechamento && (
                          <div>
                            <span className="text-muted-foreground">Data Fech.: </span>
                            <span className="font-medium">{formatDate(int.data_fechamento)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sheet for New/Edit Interaction */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{isEditing ? 'Editar Interação' : 'Nova Interação'}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Input
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  placeholder="Ex: Ligação, WhatsApp, Presencial"
                />
              </div>
              <div className="space-y-2">
                <Label>Atendido Por</Label>
                <Input
                  value={formData.atendido_por}
                  readOnly
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Detalhes da interação..."
                  rows={2}
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label className="text-sm">Agendou Experimental</Label>
                  <Switch
                    checked={formData.agendou_experimental}
                    onCheckedChange={(checked) => setFormData({ ...formData, agendou_experimental: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label className="text-sm">Compareceu</Label>
                  <Switch
                    checked={formData.compareceu}
                    onCheckedChange={(checked) => setFormData({ ...formData, compareceu: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label className="text-sm">Reagendou</Label>
                  <Switch
                    checked={formData.reagendou}
                    onCheckedChange={(checked) => setFormData({ ...formData, reagendou: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label className="text-sm">Fechou Matrícula</Label>
                  <Switch
                    checked={formData.fechou_matricula}
                    onCheckedChange={(checked) => setFormData({ ...formData, fechou_matricula: checked })}
                  />
                </div>
              </div>

              {/* Experimental Date/Time - always visible when agendou_experimental or for editing */}
              {(formData.agendou_experimental || isEditing) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Experimental</Label>
                    <Input
                      type="date"
                      value={formData.data_experimental}
                      onChange={(e) => setFormData({ ...formData, data_experimental: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora Experimental</Label>
                    <Input
                      type="time"
                      value={formData.hora_experimental}
                      onChange={(e) => setFormData({ ...formData, hora_experimental: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Matricula fields - only visible when fechou_matricula */}
              {formData.fechou_matricula && (
                <>
                  <div className="space-y-2">
                    <Label>Responsável pelo Fechamento *</Label>
                    <Input
                      value={formData.responsavel_fechamento}
                      onChange={(e) => setFormData({ ...formData, responsavel_fechamento: e.target.value })}
                      placeholder="Nome do responsável pelo fechamento"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plano Escolhido</Label>
                    <Select
                      value={formData.plano_escolhido}
                      onValueChange={(v) => setFormData({ ...formData, plano_escolhido: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o plano" />
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
                  <div className="space-y-2">
                    <Label>Valor do Plano (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.valor_plano}
                      onChange={(e) => setFormData({ ...formData, valor_plano: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fechamento</Label>
                    <Input
                      type="date"
                      value={formData.data_fechamento}
                      onChange={(e) => setFormData({ ...formData, data_fechamento: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Treinador Responsável</Label>
                    <Input
                      value={formData.treinador_responsavel}
                      onChange={(e) => setFormData({ ...formData, treinador_responsavel: e.target.value })}
                      placeholder="Nome do treinador"
                    />
                  </div>
                </>
              )}

              <Button onClick={handleSaveInteracao} disabled={savingInteracao} className="w-full">
                {savingInteracao && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Salvar Alterações' : 'Criar Interação'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}