import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Lead, StatusFunil } from '@/types/database';
import { Users, UserPlus, CalendarCheck, TrendingUp, Loader2 } from 'lucide-react';

interface Stats {
  total: number;
  novos: number;
  aulasAgendadas: number;
  convertidos: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, novos: 0, aulasAgendadas: 0, convertidos: 0 });
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (leads) {
      const typedLeads = leads as unknown as Lead[];
      setStats({
        total: typedLeads.length,
        novos: typedLeads.filter(l => l.status_funil === 'novo').length,
        aulasAgendadas: typedLeads.filter(l => l.status_funil === 'aula_agendada').length,
        convertidos: typedLeads.filter(l => l.status_funil === 'convertido').length,
      });
      setRecentLeads(typedLeads.slice(0, 5));
    }
    
    setLoading(false);
  };

  const statusLabels: Record<StatusFunil, string> = {
    novo: 'Novo',
    contato_inicial: 'Contato Inicial',
    aula_agendada: 'Aula Agendada',
    aula_realizada: 'Aula Realizada',
    negociacao: 'Negociação',
    convertido: 'Convertido',
    perdido: 'Perdido',
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

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Leads
              </CardTitle>
              <Users className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leads Novos
              </CardTitle>
              <UserPlus className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{stats.novos}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aulas Agendadas
              </CardTitle>
              <CalendarCheck className="w-5 h-5 text-sky-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-sky-600">{stats.aulasAgendadas}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Convertidos
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.convertidos}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Leads Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum lead cadastrado ainda
              </p>
            ) : (
              <div className="space-y-4">
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{lead.nome}</p>
                      <p className="text-sm text-muted-foreground">{lead.email || lead.telefone}</p>
                    </div>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                      {statusLabels[lead.status_funil]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
