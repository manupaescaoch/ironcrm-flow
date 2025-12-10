import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Lead, StatusFunil } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User } from 'lucide-react';

const columns: { status: StatusFunil; label: string; color: string }[] = [
  { status: 'novo', label: 'Novo', color: 'bg-blue-500' },
  { status: 'contato_inicial', label: 'Contato Inicial', color: 'bg-purple-500' },
  { status: 'aula_agendada', label: 'Aula Agendada', color: 'bg-amber-500' },
  { status: 'aula_realizada', label: 'Aula Realizada', color: 'bg-orange-500' },
  { status: 'negociacao', label: 'Negociação', color: 'bg-cyan-500' },
  { status: 'convertido', label: 'Convertido', color: 'bg-green-500' },
  { status: 'perdido', label: 'Perdido', color: 'bg-red-500' },
];

export default function Kanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
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
    leads.filter((lead) => lead.status_funil === status);

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
        <h1 className="text-3xl font-bold mb-8">Funil de Vendas</h1>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const columnLeads = getLeadsByStatus(col.status);
            return (
              <div
                key={col.status}
                className="flex-shrink-0 w-72"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${col.color}`} />
                        {col.label}
                      </div>
                      <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
                        {columnLeads.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 min-h-[400px]">
                    {columnLeads.map((lead) => (
                      <Link
                        key={lead.id}
                        to={`/lead/${lead.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        className={`block p-3 bg-muted/50 hover:bg-muted rounded-lg cursor-grab active:cursor-grabbing transition-colors ${
                          draggingId === lead.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{lead.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {lead.telefone || lead.email || 'Sem contato'}
                            </p>
                            {lead.plano_escolhido && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                                {lead.plano_escolhido}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                    {columnLeads.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        Nenhum lead
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
