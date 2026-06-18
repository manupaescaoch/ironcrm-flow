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
import { Lead, Interacao, StatusFunil, PlanoEscolhido, StatusAvaliacao } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/errorMessages';
import { ArrowLeft, Save, Plus, Loader2, MessageSquare, User, Pencil, CheckCircle, XCircle, AlertCircle, Trash2, Clock } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConversionScoreCard } from '@/components/ConversionScoreCard';
import { useConversionScore } from '@/hooks/useConversionScore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InteractionTimeline } from '@/components/lead/InteractionTimeline';
import { FollowUpHistoryTimeline } from '@/components/lead/FollowUpHistoryTimeline';
import { MotivosPerdaModal } from '@/components/lead/MotivosPerdaModal';
import { AnamneseSection } from '@/components/lead/AnamneseSection';
import { formatDateOnly, formatTimeValue, formatTimestampInBrasilia } from '@/lib/brasilia';

const statusOptions: { value: StatusFunil; label: string }[] = [
  { value: 'novo', label: 'Novo' },
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

// Opções de tipo de interação
const TIPO_INTERACAO_OPTIONS = [
  'Ligação',
  'WhatsApp',
  'Presencial',
  'Avaliação Física',
  'Outro',
] as const;

// Opções de status de avaliação física
const STATUS_AVALIACAO_OPTIONS: { value: StatusAvaliacao; label: string; emoji: string }[] = [
  { value: 'agendada', label: 'Avaliação Agendada', emoji: '📅' },
  { value: 'realizada', label: 'Avaliação Realizada', emoji: '✅' },
  { value: 'faltou', label: 'Faltou', emoji: '❌' },
  { value: 'reagendada', label: 'Reagendada', emoji: '🔄' },
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
  quem_indicou: string;
  // Avaliação Física fields
  data_avaliacao: string;
  hora_avaliacao: string;
  status_avaliacao: StatusAvaliacao | null;
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
  quem_indicou: '',
  // Avaliação Física fields
  data_avaliacao: '',
  hora_avaliacao: '',
  status_avaliacao: null,
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
  const [originalLead, setOriginalLead] = useState<Lead | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [canEditCurrentInteracao, setCanEditCurrentInteracao] = useState(true);
  const [formData, setFormData] = useState<InteracaoForm>(initialFormState);
  const [deletingInteracao, setDeletingInteracao] = useState<string | null>(null);
  const [showMotivosPerdaModal, setShowMotivosPerdaModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<StatusFunil | null>(null);
  const [savingMotivo, setSavingMotivo] = useState(false);
  // Conversion score calculation
  const conversionScore = useConversionScore(lead, interacoes);

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
    setOriginalLead(data as unknown as Lead);
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

    // Normalize phone: only digits, 10-11 chars
    const telefoneNormalizado = (lead.telefone || '').replace(/\D/g, '');
    if (!telefoneNormalizado || telefoneNormalizado.length < 10 || telefoneNormalizado.length > 11) {
      toast({
        title: 'Telefone inválido',
        description: 'Informe um telefone válido com DDD (10 ou 11 dígitos, apenas números).',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const leadParaSalvar = { ...lead, telefone: telefoneNormalizado };

    // Build a diff: only send fields that actually changed vs the loaded state.
    const candidateFields = {
      nome: leadParaSalvar.nome,
      email: leadParaSalvar.email,
      telefone: leadParaSalvar.telefone,
      origem: leadParaSalvar.origem,
      status_funil: leadParaSalvar.status_funil,
      cadastrado_por: leadParaSalvar.cadastrado_por,
      data_aula_experimental: leadParaSalvar.data_aula_experimental,
      observacoes: leadParaSalvar.observacoes,
    } as Record<string, any>;

    const changedFields: Record<string, any> = {};
    if (originalLead) {
      for (const key of Object.keys(candidateFields)) {
        const oldVal = (originalLead as any)[key] ?? null;
        const newVal = candidateFields[key] ?? null;
        if (oldVal !== newVal) changedFields[key] = candidateFields[key];
      }
    } else {
      Object.assign(changedFields, candidateFields);
    }

    if (Object.keys(changedFields).length === 0) {
      setSaving(false);
      toast({ title: 'Nenhuma alteração para salvar' });
      return;
    }

    const { error } = await supabase
      .from('leads')
      .update(changedFields)
      .eq('id', id);

    setSaving(false);

    if (error) {
      // Detectar duplicidade de telefone (trigger check_duplicate_lead)
      const msg = getErrorMessage(error) || '';
      const isDuplicate =
        (error as any)?.code === '23505' ||
        /duplicate|duplicado|unique_violation|já existe/i.test(msg);

      if (isDuplicate) {
        toast({
          title: 'Telefone já cadastrado',
          description: 'Já existe um lead ativo com este telefone. Verifique antes de salvar.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' });
      }
    } else {
      setLead(leadParaSalvar);
      setOriginalLead(leadParaSalvar);
      toast({ title: 'Lead atualizado!' });
    }
  };

  const handleConfirmPerda = async (motivo: string, observacao: string) => {
    if (!lead || !pendingStatus) return;
    setSavingMotivo(true);

    const observacaoFinal = observacao.trim()
      ? `${lead.observacoes || ''}\n\n[Motivo da Perda - ${formatTimestampInBrasilia(new Date(), { dateOnly: true })}]: ${observacao}`.trim()
      : lead.observacoes;

    const { error } = await supabase
      .from('leads')
      .update({
        status_funil: pendingStatus,
        motivo_perda: motivo,
        data_perda: new Date().toISOString(),
        observacoes: observacaoFinal,
      })
      .eq('id', id);

    setSavingMotivo(false);

    if (error) {
      toast({ title: 'Erro ao atualizar lead', description: getErrorMessage(error), variant: 'destructive' });
    } else {
      setLead({ 
        ...lead, 
        status_funil: pendingStatus, 
        motivo_perda: motivo, 
        data_perda: new Date().toISOString(),
        observacoes: observacaoFinal 
      });
      toast({ title: 'Lead marcado como perdido' });
      setShowMotivosPerdaModal(false);
      setPendingStatus(null);
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
      quem_indicou: (interacao as any).quem_indicou || '',
      // Avaliação Física fields
      data_avaliacao: interacao.data_avaliacao || '',
      hora_avaliacao: interacao.hora_avaliacao || '',
      status_avaliacao: interacao.status_avaliacao || null,
    });
    setIsEditing(true);
    setSheetOpen(true);
  };

  const handleSaveInteracao = async () => {
    if (!formData.tipo.trim()) {
      toast({ title: 'Tipo da interação é obrigatório', variant: 'destructive' });
      return;
    }

    // Validate hora_experimental when agendou_experimental or data_experimental is set
    if ((formData.agendou_experimental || formData.data_experimental) && !formData.hora_experimental) {
      toast({ title: 'Horário da aula experimental é obrigatório', variant: 'destructive' });
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

    // Se data_experimental está preenchida, garantir que agendou_experimental = true
    const hasExperimental = !!formData.data_experimental;
    const agendouExperimental = hasExperimental || formData.agendou_experimental;

    const interacaoData = {
      tipo: formData.tipo.trim(),
      descricao: formData.descricao.trim() || null,
      atendido_por: formData.atendido_por || null,
      atendido_por_tipo: formData.atendido_por_tipo,
      agendou_experimental: agendouExperimental,
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
      quem_indicou: formData.fechou_matricula ? (formData.quem_indicou.trim() || null) : null,
      // Avaliação Física fields
      data_avaliacao: formData.tipo === 'Avaliação Física' ? (formData.data_avaliacao || null) : null,
      hora_avaliacao: formData.tipo === 'Avaliação Física' ? (formData.hora_avaliacao || null) : null,
      status_avaliacao: formData.tipo === 'Avaliação Física' ? formData.status_avaliacao : null,
    };

    // Sincronizar data/hora da experimental no lead ANTES de salvar a interação,
    // pois o trigger sync_hora_experimental_from_lead puxa o horário do lead e sobrescreveria
    // o valor da interação caso o lead esteja desatualizado.
    if (agendouExperimental && (formData.data_experimental || formData.hora_experimental)) {
      const leadSyncPayload: Record<string, any> = {};
      if (formData.data_experimental && formData.data_experimental !== lead?.data_aula_experimental) {
        leadSyncPayload.data_aula_experimental = formData.data_experimental;
      }
      if (formData.hora_experimental && formData.hora_experimental !== (lead?.hora_aula_experimental?.slice(0, 5) ?? '')) {
        leadSyncPayload.hora_aula_experimental = formData.hora_experimental;
      }
      if (Object.keys(leadSyncPayload).length > 0) {
        await supabase.from('leads').update(leadSyncPayload).eq('id', id);
      }
    }

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
      toast({ title: 'Erro ao salvar interação', description: getErrorMessage(interacaoError), variant: 'destructive' });
      setSavingInteracao(false);
      return;
    }

    // Update lead status (skip if status is already the target — trigger update_lead_status_on_matricula
    // may have already set it to 'convertido', and re-updating with the same value would trip the
    // enforce_leads_update_permissions trigger for non-owner users)
    let leadError: any = null;
    if (lead?.status_funil !== newStatus) {
      const { error } = await supabase
        .from('leads')
        .update({ status_funil: newStatus })
        .eq('id', id);
      leadError = error;
    }

    if (leadError) {
      toast({ title: 'Erro ao atualizar status do lead', description: getErrorMessage(leadError), variant: 'destructive' });
    } else {
      // Se fechou matrícula (convertido), cancelar todos os follow-ups pendentes
      if (formData.fechou_matricula) {
        await supabase
          .from('follow_ups')
          .update({ status: 'cancelado' })
          .eq('lead_id', id)
          .eq('status', 'pendente');
      }
      
      toast({ title: isEditing ? 'Interação atualizada!' : 'Interação adicionada!' });
      setFormData(initialFormState);
      setSheetOpen(false);
      // Reload data
      fetchInteracoes();
      fetchLead();
    }

    setSavingInteracao(false);
  };

  const handleDeleteInteracao = async (interacaoId: string) => {
    if (!isAdmin) return;
    
    setDeletingInteracao(interacaoId);
    
    const { error } = await supabase
      .from('interacoes')
      .delete()
      .eq('id', interacaoId);
    
    setDeletingInteracao(null);
    
    if (error) {
      toast({ title: 'Erro ao excluir interação', description: getErrorMessage(error), variant: 'destructive' });
    } else {
      toast({ title: 'Interação excluída!' });
      fetchInteracoes();
      fetchLead();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    return formatDateOnly(dateString);
  };

  const formatDateTime = (dateString: string | null, timeString: string | null) => {
    const datePart = formatDateOnly(dateString);
    if (datePart === '-') return '-';
    return timeString ? `${datePart} às ${formatTimeValue(timeString)}` : datePart;
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
              <h1 className="text-3xl font-bold">{lead.nome?.toUpperCase()}</h1>
              <p className="text-muted-foreground">
                Cadastrado em {formatTimestampInBrasilia(lead.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Lead Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Nome Completo</p>
              <p className="font-semibold truncate">{lead.nome?.toUpperCase()}</p>
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
              <p className="font-semibold">{lead.cadastrado_por?.toUpperCase() || '-'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Data Cadastro</p>
              <p className="font-semibold">{formatDate(lead.created_at)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <AnamneseSection leadId={lead.id} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Lead Edit Form */}
          <div className="lg:col-span-1 space-y-6">
            {/* Conversion Score Card - only show for active leads not yet converted/lost */}
            {lead.status_funil !== 'convertido' && lead.status_funil !== 'perdido' && conversionScore && (
              <ConversionScoreCard scoreData={conversionScore} />
            )}
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
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    value={lead.telefone || ''}
                    onChange={(e) => setLead({ ...lead, telefone: e.target.value.replace(/\D/g, '') })}
                    disabled={!canEditLead}
                    placeholder="11999999999"
                  />
                  <p className="text-xs text-muted-foreground">Apenas números — 10 ou 11 dígitos.</p>
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select
                    value={lead.origem || ''}
                    onValueChange={(value) => setLead({ ...lead, origem: value })}
                    disabled={!canEditLead}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {ORIGEM_OPTIONS.map((origem) => (
                        <SelectItem key={origem} value={origem}>
                          {origem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    onValueChange={(v) => {
                      const newStatus = v as StatusFunil;
                      if (newStatus === 'perdido' && lead.status_funil !== 'perdido') {
                        setPendingStatus(newStatus);
                        setShowMotivosPerdaModal(true);
                      } else {
                        setLead({ ...lead, status_funil: newStatus });
                      }
                    }}
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
                  {lead.motivo_perda && lead.status_funil === 'perdido' && (
                    <div className="mt-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                      <p className="text-xs text-muted-foreground mb-1">Motivo da perda:</p>
                      <p className="text-sm font-medium text-destructive">{lead.motivo_perda}</p>
                      {lead.data_perda && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Perdido em: {formatTimestampInBrasilia(lead.data_perda, { dateOnly: true })}
                        </p>
                      )}
                    </div>
                  )}
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
                              {formatTimestampInBrasilia(int.data_interacao)}
                            </TableCell>
                            <TableCell>{int.tipo}</TableCell>
                            <TableCell>
                              {int.atendido_por_tipo === 'comercial' ? 'Comercial' : 
                               int.atendido_por_tipo === 'espontaneo_recepcao' ? 'Espontâneo' : 
                               int.atendido_por?.toUpperCase() || '-'}
                            </TableCell>
                            <TableCell>
                              {int.tipo === 'Avaliação Física' ? (
                                <div className="flex flex-col gap-1 text-xs">
                                  <span className={`font-medium ${
                                    int.status_avaliacao === 'realizada' ? 'text-green-600' :
                                    int.status_avaliacao === 'agendada' ? 'text-blue-600' :
                                    int.status_avaliacao === 'faltou' ? 'text-red-600' :
                                    int.status_avaliacao === 'reagendada' ? 'text-amber-600' : ''
                                  }`}>
                                    {int.status_avaliacao === 'agendada' && '📅 Agendada'}
                                    {int.status_avaliacao === 'realizada' && '✅ Realizada'}
                                    {int.status_avaliacao === 'faltou' && '❌ Faltou'}
                                    {int.status_avaliacao === 'reagendada' && '🔄 Reagendada'}
                                    {!int.status_avaliacao && '- Pendente'}
                                  </span>
                                  {int.data_avaliacao && (
                                    <span className="text-muted-foreground">
                                      {formatDate(int.data_avaliacao)}
                                    </span>
                                  )}
                                </div>
                              ) : (
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
                              )}
                            </TableCell>
                            <TableCell>{int.plano_escolhido || '-'}</TableCell>
                            <TableCell>{int.valor_plano > 0 ? formatCurrency(int.valor_plano) : '-'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditInteracao(int); }}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                {isAdmin && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-destructive hover:text-destructive"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (confirm('Tem certeza que deseja excluir esta interação?')) {
                                        handleDeleteInteracao(int.id);
                                      }
                                    }}
                                    disabled={deletingInteracao === int.id}
                                  >
                                    {deletingInteracao === int.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
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

            {/* Visual Interaction Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Linha do Tempo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InteractionTimeline 
                  interacoes={interacoes} 
                  onInteractionClick={openEditInteracao} 
                />
              </CardContent>
            </Card>

            {/* Follow-up History Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Histórico de Follow-up
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lead && <FollowUpHistoryTimeline leadId={lead.id} lead={lead as any} />}
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
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_INTERACAO_OPTIONS.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Bloco Avaliação Física - só aparece quando tipo = Avaliação Física */}
              {formData.tipo === 'Avaliação Física' && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    📋 Avaliação Física
                  </h4>
                  
                  {/* Data e Hora */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data da Avaliação</Label>
                      <Input
                        type="date"
                        value={formData.data_avaliacao}
                        onChange={(e) => setFormData({ ...formData, data_avaliacao: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora da Avaliação</Label>
                      <Input
                        type="time"
                        value={formData.hora_avaliacao}
                        onChange={(e) => setFormData({ ...formData, hora_avaliacao: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Status Toggles */}
                  <div className="space-y-2">
                    <Label>Status da Avaliação</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_AVALIACAO_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, status_avaliacao: option.value })}
                          className={`p-3 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 justify-center ${
                            formData.status_avaliacao === option.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted border-border'
                          }`}
                        >
                          <span>{option.emoji}</span>
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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

              {/* Treinador Experimental - aparece quando Compareceu está ativo */}
              {formData.compareceu && (
                <div className="space-y-2">
                  <Label>Treinador da Aula Experimental</Label>
                  <Input
                    value={formData.treinador_responsavel}
                    onChange={(e) => setFormData({ ...formData, treinador_responsavel: e.target.value })}
                    placeholder="NOME DO TREINADOR"
                    list="treinadores-list"
                  />
                  <datalist id="treinadores-list">
                    <option value="Guilherme" />
                    <option value="Diogo" />
                    <option value="Luiz" />
                    <option value="Ivan" />
                    <option value="Andrey" />
                    <option value="Lucas" />
                    <option value="Rafael" />
                  </datalist>
                </div>
              )}

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
                  <div className="space-y-2">
                    <Label>Quem Indicou</Label>
                    <Input
                      value={formData.quem_indicou}
                      onChange={(e) => setFormData({ ...formData, quem_indicou: e.target.value })}
                      placeholder="Nome de quem indicou o aluno"
                    />
                    <p className="text-xs text-muted-foreground">
                      Preencha com o nome de quem indicou o aluno (aluno, embaixador, parceiro ou outro).
                    </p>
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

        {/* Modal de Motivo de Perda */}
        <MotivosPerdaModal
          open={showMotivosPerdaModal}
          onOpenChange={(open) => {
            if (!open) {
              setPendingStatus(null);
            }
            setShowMotivosPerdaModal(open);
          }}
          onConfirm={handleConfirmPerda}
          loading={savingMotivo}
        />
      </div>
    </Layout>
  );
}