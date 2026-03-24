import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormulariosList } from '@/components/cronograma/FormulariosList';
import { FormularioBuilder } from '@/components/cronograma/FormularioBuilder';
import { CronogramaDashboard } from '@/components/cronograma/CronogramaDashboard';
import { CronogramaTab } from '@/components/cronograma/CronogramaTab';
import { FuncionariosTab } from '@/components/cronograma/FuncionariosTab';
import { FileCheck, LayoutDashboard, CalendarDays, Users, FileText } from 'lucide-react';

type View = 'list' | 'builder';

export default function CronogramaOperacional() {
  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('cronograma');

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

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <FileCheck className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Cronograma Operacional</h1>
            <p className="text-sm text-muted-foreground">Dashboard, cronograma, funcionários e formulários</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="cronograma" className="gap-1.5">
              <CalendarDays className="w-4 h-4" />
              Cronograma
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="funcionarios" className="gap-1.5">
              <Users className="w-4 h-4" />
              Funcionários
            </TabsTrigger>
            <TabsTrigger value="formularios" className="gap-1.5">
              <FileText className="w-4 h-4" />
              Formulários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <CronogramaDashboard />
          </TabsContent>

          <TabsContent value="cronograma" className="mt-4">
            <CronogramaTab />
          </TabsContent>

          <TabsContent value="funcionarios" className="mt-4">
            <FuncionariosTab />
          </TabsContent>

          <TabsContent value="formularios" className="mt-4">
            {view === 'list' ? (
              <FormulariosList
                onCreateNew={handleCreateNew}
                onEdit={handleEdit}
                onViewRespostas={() => {}}
              />
            ) : (
              <FormularioBuilder formularioId={editingId} onBack={handleBack} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
