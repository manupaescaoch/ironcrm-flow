import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Phone, MapPin, UserCheck, Calendar as CalendarIcon, Clock, Filter, X } from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const columns: { status: StatusFunil; label: string; color: string }[] = [
  { status: 'novo', label: 'Novo', color: 'bg-blue-500' },
  { status: 'aula_agendada', label: 'Aula Agendada', color: 'bg-amber-500' },
  { status: 'aula_realizada', label: 'Aula Realizada', color: 'bg-orange-500' },
  { status: 'negociacao', label: 'Negociação', color: 'bg-cyan-500' },
  { status: 'convertido', label: 'Convertido', color: 'bg-green-500' },
  { status: 'perdido', label: 'Perdido', color: 'bg-red-500' },
];

interface LeadWithExperimental extends Lead {
  proximaExperimental?: {
    data: string | null;
    hora: string | null;
  };
}

export default function Kanban() {
  const [leads, setLeads] = useState<LeadWithExperimental[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { toast } = useToast();

  // Filters
  const [filterOrigem, setFilterOrigem] = useState<string>('all');
  const [filterAtendidoPor, setFilterAtendidoPor] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    
    // Fetch leads
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (leadsError) {
      toast({ title: 'Erro ao carregar leads', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const leadsArray = (leadsData as unknown as Lead[]) || [];

    // Fetch the most recent interaction with experimental date for each lead
    const { data: interacoesData } = await supabase
      .from('interacoes')
      .select('lead_id, data_experimental, hora_experimental')
      .not('data_experimental', 'is', null)
      .order('data_interacao', { ascending: false });

    // Create a map of lead_id to the most recent experimental data
    const experimentalMap = new Map<string, { data: string | null; hora: string | null }>();
    if (interacoesData) {
      (interacoesData as unknown as Interacao[]).forEach((int) => {
        if (!experimentalMap.has(int.lead_id) && int.data_experimental) {
          experimentalMap.set(int.lead_id, {
            data: int.data_experimental,
            hora: int.hora_experimental,
          });
        }
      });
    }

    // Merge leads with experimental data
    const leadsWithExperimental: LeadWithExperimental[] = leadsArray.map((lead) => ({
      ...lead,
      proximaExperimental: experimentalMap.get(lead.id),
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: StatusFunil) => {
    e.preventDefault();
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
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Funil de Vendas</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{filteredLeads.length} leads</span>
            {hasActiveFilters && (
              <span className="text-primary">(filtrado)</span>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
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

        {/* Kanban Board - Vertical Layout */}
        <div className="flex flex-col gap-6">
          {columns.map((col) => {
            const columnLeads = getLeadsByStatus(col.status);
            return (
              <Card
                key={col.status}
                className="w-full"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                {/* Stage Header - Fixed */}
                <CardHeader className="pb-3 border-b bg-card sticky top-0 z-10">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${col.color}`} />
                      <span className="text-base font-semibold">{col.label}</span>
                    </div>
                    <span className="bg-muted px-3 py-1 rounded-full text-sm font-bold">
                      {columnLeads.length}
                    </span>
                  </CardTitle>
                </CardHeader>

                {/* Scrollable Card List */}
                <CardContent className="p-4">
                  <div className="max-h-[400px] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {columnLeads.map((lead) => (
                        <Link
                          key={lead.id}
                          to={`/lead/${lead.id}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead.id)}
                          className={cn(
                            'block p-4 bg-muted/50 hover:bg-muted rounded-lg cursor-grab active:cursor-grabbing transition-all border border-transparent hover:border-primary/20 shadow-sm',
                            draggingId === lead.id && 'opacity-50 scale-95'
                          )}
                        >
                          {/* Header with avatar and name */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{lead.nome}</p>
                              {lead.telefone && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3" />
                                  <WhatsAppLink phone={lead.telefone} className="text-xs" />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-1.5 text-xs">
                            {lead.origem && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{lead.origem}</span>
                              </div>
                            )}
                            {lead.atendido_por && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <UserCheck className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{lead.atendido_por}</span>
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

                          {/* Plan badge */}
                          {lead.plano_escolhido && (
                            <div className="mt-3">
                              <span className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                                {lead.plano_escolhido}
                              </span>
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                    {columnLeads.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <div className={`w-12 h-12 ${col.color} opacity-20 rounded-full mb-3`} />
                        <p className="text-sm">Nenhum lead nesta etapa</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}