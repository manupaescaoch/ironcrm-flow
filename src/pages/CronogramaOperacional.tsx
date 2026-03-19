import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormulariosList } from '@/components/cronograma/FormulariosList';
import { FormularioBuilder } from '@/components/cronograma/FormularioBuilder';
import { EnviosTab } from '@/components/cronograma/EnviosTab';
import { RelatorioTab } from '@/components/cronograma/RelatorioTab';
import { FileCheck } from 'lucide-react';

type View = 'list' | 'builder';

export default function CronogramaOperacional() {
  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('formularios');

  const handleCreateNew = () => {
    setEditingId(null);
    setView('builder');
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setView('builder');
  };

  const handleBack = () => {
    setView('list');
    setEditingId(null);
  };

  const handleViewRespostas = (id: string) => {
    setActiveTab('envios');
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <FileCheck className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Cronograma Operacional</h1>
            <p className="text-sm text-muted-foreground">Formulários, envios e relatórios</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="formularios">Formulários</TabsTrigger>
            <TabsTrigger value="envios">Envios</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          </TabsList>

          <TabsContent value="formularios" className="mt-4">
            {view === 'list' ? (
              <FormulariosList
                onCreateNew={handleCreateNew}
                onEdit={handleEdit}
                onViewRespostas={handleViewRespostas}
              />
            ) : (
              <FormularioBuilder formularioId={editingId} onBack={handleBack} />
            )}
          </TabsContent>

          <TabsContent value="envios" className="mt-4">
            <EnviosTab />
          </TabsContent>

          <TabsContent value="relatorio" className="mt-4">
            <RelatorioTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
