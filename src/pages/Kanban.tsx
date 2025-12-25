import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { Lead, StatusFunil, Interacao } from '@/types/database';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Phone, MapPin, UserCheck, Calendar as CalendarIcon, Clock, Filter, X } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ConversionScoreBadge } from '@/components/ConversionScoreBadge';
import { calcularConversionScore } from '@/hooks/useConversionScore';
import { useUnidade } from '@/contexts/UnidadeContext';

const columns: { status: StatusFunil; label: string; color: string; bgLight: string }[] = [
  { status: 'novo', label: 'Novo', color: 'bg-blue-500', bgLight: 'bg-blue-500/10' },
  { status: 'aula_agendada', label: 'Experimental Agendada', color: 'bg-amber-500', bgLight: 'bg-amber-500/10' },
  { status: 'aula_realizada', label: 'Experimental Realizada', color: 'bg-orange-500', bgLight: 'bg-orange-500/10' },
  { status: 'follow_up', label: 'Follow Up', color: 'bg-indigo-500', bgLight: 'bg-indigo-500/10' },
  { status: 'negociacao', label: 'Negociação', color: 'bg-cyan-500', bgLight: 'bg-cyan-500/10' },
  { status: 'convertido', label: 'Convertido', color: 'bg-green-500', bgLight: 'bg-green-500/10' },
  { status: 'perdido', label: 'Perdido', color: 'bg-red-500', bgLight: 'bg-red-500/10' },
];

interface LeadWithExperimental extends Lead {
  proximaExperimental?: {
    data: string | null;
    hora: string | null;
  };
  interacoes?: Interacao[];
}

export default function Kanban() {
  const [leads, setLeads] = useState<LeadWithExperimental[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<StatusFunil | null>(null);
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();

  // Filters
  const [filterOrigem, setFilterOrigem] = useState<string>('all');
  const [filterAtendidoPor, setFilterAtendidoPor] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchLeads();
    
    // Setup realtime subscription for leads changes
    const channel = supabase
      .channel('kanban-leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as Tables<'leads'>;
            // Only add if matches current unit filter and is active
            if (newLead.ativo && (!unidadeAtual || newLead.unidade_id === unidadeAtual.id)) {
              setLeads(prev => [{ ...newLead as unknown as Lead, proximaExperimental: undefined }, ...prev]);
              toast({ title: 'Novo lead adicionado', description: newLead.nome });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedLead = payload.new as Tables<'leads'>;
            // If lead became inactive, remove from list
            if (!updatedLead.ativo) {
              setLeads(prev => prev.filter(lead => lead.id !== updatedLead.id));
            } else {
              setLeads(prev => prev.map(lead => 
                lead.id === updatedLead.id 
                  ? { ...lead, ...updatedLead as unknown as Lead }
                  : lead
              ));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setLeads(prev => prev.filter(lead => lead.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unidadeAtual]);

  const fetchLeads = async () => {
    setLoading(true);
    
    // Fetch leads
    let query = supabase
      .from('leads')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (unidadeAtual) {
      query = query.eq('unidade_id', unidadeAtual.id);
    }

    const { data: leadsData, error: leadsError } = await query;

    if (leadsError) {
      toast({ title: 'Erro ao carregar leads', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const leadsArray = (leadsData as unknown as Lead[]) || [];

    // Fetch ALL interactions for leads (needed for score calculation)
    const leadIds = leadsArray.map(l => l.id);
    const { data: interacoesData } = await supabase
      .from('interacoes')
      .select('*')
      .in('lead_id', leadIds)
      .order('data_interacao', { ascending: false });

    // Create a map of lead_id to interactions array
    const interacoesMap = new Map<string, Interacao[]>();
    const experimentalMap = new Map<string, { data: string | null; hora: string | null }>();
    
    if (interacoesData) {
      (interacoesData as unknown as Interacao[]).forEach((int) => {
        // Build interactions array per lead
        if (!interacoesMap.has(int.lead_id)) {
          interacoesMap.set(int.lead_id, []);
        }
        interacoesMap.get(int.lead_id)!.push(int);
        
        // Track experimental data (first found = most recent)
        if (!experimentalMap.has(int.lead_id) && int.data_experimental) {
          experimentalMap.set(int.lead_id, {
            data: int.data_experimental,
            hora: int.hora_experimental,
          });
        }
      });
    }

    // Merge leads with experimental data and interactions
    const leadsWithExperimental: LeadWithExperimental[] = leadsArray.map((lead) => ({
      ...lead,
      proximaExperimental: experimentalMap.get(lead.id),
      interacoes: interacoesMap.get(lead.id) || [],
    }));

    setLeads(leadsWithExperimental);
    setLoading(false);
  };

  // Extract unique values for filters
  const uniqueOrigens = useMemo(() => {
    const origens = leads.map((l) => l.origem).filter(Boolean) as string[];
    return [...new Set(origens)];
  }, [leads]);

  const uniqueAtendidoPor = useMemo(() => {
    const atendentes = leads.map((l) => l.atendido_por).filter(Boolean) as string[];
    return [...new Set(atendentes)];
  }, [leads]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Origem filter
      if (filterOrigem !== 'all' && lead.origem !== filterOrigem) return false;

      // Atendido por filter
      if (filterAtendidoPor !== 'all' && lead.atendido_por !== filterAtendidoPor) return false;

      // Date range filter
      if (dateFrom) {
        const leadDate = new Date(lead.created_at);
        if (leadDate < dateFrom) return false;
      }
      if (dateTo) {
        const leadDate = new Date(lead.created_at);
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (leadDate > endOfDay) return false;
      }

      return true;
    });
  }, [leads, filterOrigem, filterAtendidoPor, dateFrom, dateTo]);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: StatusFunil) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: StatusFunil) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (!draggingId) return;

    const lead = leads.find((l) => l.id === draggingId);
    if (!lead || lead.status_funil === newStatus) {
      setDraggingId(null);
      return;
    }

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === draggingId ? { ...l, status_funil: newStatus } : l))
    );

    const { error } = await supabase
      .from('leads')
      .update({ status_funil: newStatus })
      .eq('id', draggingId);

    if (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
      fetchLeads();
    } else {
      toast({ title: 'Status atualizado!' });
    }

    setDraggingId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
  };

  const getLeadsByStatus = (status: StatusFunil) =>
    filteredLeads.filter((lead) => lead.status_funil === status);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const formatExperimental = (data: string | null, hora: string | null) => {
    if (!data) return null;
    const datePart = format(new Date(data), 'dd/MM', { locale: ptBR });
    if (hora) {
      return `${datePart} ${hora.slice(0, 5)}`;
    }
    return datePart;
  };

  const clearFilters = () => {
    setFilterOrigem('all');
    setFilterAtendidoPor('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = filterOrigem !== 'all' || filterAtendidoPor !== 'all' || dateFrom || dateTo;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 lg:p-8 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">Funil de Vendas</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">{filteredLeads.length} leads</span>
            {hasActiveFilters && (
              <span className="text-primary">(filtrado)</span>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-4 flex-shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-2">
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Origem Filter */}
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
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
              </div>

              {/* Atendido Por Filter */}
              <div className="space-y-2">
                <Label>Atendido Por</Label>
                <Select value={filterAtendidoPor} onValueChange={setFilterAtendidoPor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
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
              </div>

              {/* Date From Filter */}
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dateFrom && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To Filter */}
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dateTo && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board - Horizontal Layout */}
        <div className="flex-1 overflow-hidden">
          <div 
            className="flex gap-4 h-full overflow-x-auto pb-4 scrollbar-hide"
            style={{ minHeight: 'calc(100vh - 380px)' }}
          >
            {columns.map((col) => {
              const columnLeads = getLeadsByStatus(col.status);
              const isDropTarget = dragOverColumn === col.status && draggingId;
              
              return (
                <div
                  key={col.status}
                  className={cn(
                    'flex-shrink-0 w-72 md:w-80 rounded-xl flex flex-col transition-all duration-200',
                    col.bgLight,
                    isDropTarget && 'ring-2 ring-primary ring-offset-2 scale-[1.02]'
                  )}
                  onDragOver={(e) => handleDragOver(e, col.status)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.status)}
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-border/50 bg-background/80 backdrop-blur-sm rounded-t-xl sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-3 h-3 rounded-full', col.color)} />
                        <span className="text-sm font-semibold truncate">{col.label}</span>
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-bold',
                        col.color,
                        'text-white'
                      )}>
                        {columnLeads.length}
                      </span>
                    </div>
                  </div>

                  {/* Column Content - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {columnLeads.map((lead) => (
                      <Link
                        key={lead.id}
                        to={`/lead/${lead.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          'block p-3 bg-background rounded-lg cursor-grab active:cursor-grabbing transition-all',
                          'border border-border/50 hover:border-primary/30 hover:shadow-md',
                          draggingId === lead.id && 'opacity-50 scale-95 rotate-2'
                        )}
                      >
                        {/* Header with avatar and name */}
                        <div className="flex items-start gap-2 mb-2">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                            col.bgLight
                          )}>
                            <User className={cn('w-4 h-4', col.color.replace('bg-', 'text-'))} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate">{lead.nome?.toUpperCase()}</p>
                            {lead.telefone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                <WhatsAppLink phone={lead.telefone} className="text-xs" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-1 text-xs">
                          {lead.origem && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{lead.origem}</span>
                            </div>
                          )}
                          {lead.atendido_por && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <UserCheck className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{lead.atendido_por?.toUpperCase()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CalendarIcon className="w-3 h-3 flex-shrink-0" />
                            <span>{formatDate(lead.created_at)}</span>
                          </div>
                          {lead.proximaExperimental?.data && (
                            <div className="flex items-center gap-2 text-primary font-medium">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              <span>
                                Exp: {formatExperimental(lead.proximaExperimental.data, lead.proximaExperimental.hora)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Conversion Score */}
                        {lead.status_funil !== 'convertido' && lead.status_funil !== 'perdido' && (
                          <div className="mt-2 pt-2 border-t border-border/30">
                            <ConversionScoreBadge 
                              scoreData={calcularConversionScore(lead, lead.interacoes || [])} 
                            />
                          </div>
                        )}

                        {/* Plan badge */}
                        {lead.plano_escolhido && (
                          <div className="mt-2">
                            <span className={cn(
                              'inline-block px-2 py-0.5 text-xs rounded-full',
                              col.bgLight,
                              col.color.replace('bg-', 'text-')
                            )}>
                              {lead.plano_escolhido}
                            </span>
                          </div>
                        )}
                      </Link>
                    ))}
                    
                    {/* Empty state */}
                    {columnLeads.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <div className={cn('w-10 h-10 rounded-full opacity-30 mb-2', col.color)} />
                        <p className="text-xs text-center">Nenhum lead<br />nesta etapa</p>
                      </div>
                    )}
                    
                    {/* Drop indicator when dragging */}
                    {isDropTarget && (
                      <div className="border-2 border-dashed border-primary/50 rounded-lg p-4 text-center text-sm text-primary">
                        Solte aqui
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
