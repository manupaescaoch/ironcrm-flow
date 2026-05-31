import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Handshake, History, PlusCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useUnidade } from '@/contexts/UnidadeContext';
import { ReunioesHistorico } from '@/components/reunioes/ReunioesHistorico';
import { NovaReuniao } from '@/components/reunioes/NovaReuniao';
import { PendentesEncaminhamentos } from '@/components/reunioes/PendentesEncaminhamentos';

export default function Reunioes() {
  const { unidadeAtual, loading } = useUnidade();
  const [tab, setTab] = useState('historico');

  if (loading || !unidadeAtual) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Handshake className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Reuniões</h1>
            <p className="text-sm text-muted-foreground">Atas, decisões e encaminhamentos</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="historico" className="gap-1.5">
              <History className="w-4 h-4" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="nova" className="gap-1.5">
              <PlusCircle className="w-4 h-4" /> Nova Reunião
            </TabsTrigger>
            <TabsTrigger value="pendentes" className="gap-1.5">
              <AlertCircle className="w-4 h-4" /> Pendentes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="mt-4">
            <ReunioesHistorico />
          </TabsContent>
          <TabsContent value="nova" className="mt-4">
            <NovaReuniao onSaved={() => setTab('historico')} />
          </TabsContent>
          <TabsContent value="pendentes" className="mt-4">
            <PendentesEncaminhamentos />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
