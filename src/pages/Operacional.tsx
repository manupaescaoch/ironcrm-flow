import { useState } from 'react';
import { Loader2, ClipboardList, CalendarDays, LayoutDashboard, FileText, ListChecks } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { CronogramaDashboard } from '@/components/cronograma/CronogramaDashboard';
import { OperacionalDashboard } from '@/components/operacional/OperacionalDashboard';
import { GestaoDiaTab } from '@/components/operacional/GestaoDiaTab';
import { CronogramaTab } from '@/components/cronograma/CronogramaTab';
import { FormulariosList } from '@/components/cronograma/FormulariosList';
import { FormularioBuilder } from '@/components/cronograma/FormularioBuilder';

type FormView = 'list' | 'builder';

export default function Operacional() {
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  const { isAdmin } = useAuth();

  // Formulários state
  const [formView, setFormView] = useState<FormView>('list');
  const [editingFormId, setEditingFormId] = useState<string | null>(null);

  if (unidadeLoading || !unidadeAtual) {
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
        {/* Header */}
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Operacional</h1>
            <p className="text-sm text-muted-foreground">Cronograma, rotinas, equipe e formulários</p>
          </div>
        </div>

        <Tabs defaultValue="cronograma">
          <TabsList className="flex-wrap">
            <TabsTrigger value="cronograma" className="gap-1.5">
              <CalendarDays className="w-4 h-4" />
              Cronograma
            </TabsTrigger>
            <TabsTrigger value="gestao-dia" className="gap-1.5">
              <ListChecks className="w-4 h-4" />
              Gestão do dia
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="dashboard" className="gap-1.5">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="formularios" className="gap-1.5">
                  <FileText className="w-4 h-4" />
                  Formulários
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Cronograma Tab (includes rotinas) */}
          <TabsContent value="cronograma" className="mt-4">
            <CronogramaTab />
          </TabsContent>

          {/* Gestão do dia — status, responsável, prioridade, atraso e conclusão */}
          <TabsContent value="gestao-dia" className="mt-4">
            <GestaoDiaTab />
          </TabsContent>


          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-4">
            <OperacionalDashboard />
          </TabsContent>



          {/* Formulários Tab - admin only */}
          {isAdmin && (
            <TabsContent value="formularios" className="mt-4">
              {formView === 'list' ? (
                <FormulariosList
                  onCreateNew={() => { setEditingFormId(null); setFormView('builder'); }}
                  onEdit={(id) => { setEditingFormId(id); setFormView('builder'); }}
                  onViewRespostas={() => {}}
                />
              ) : (
                <FormularioBuilder formularioId={editingFormId} onBack={() => { setFormView('list'); setEditingFormId(null); }} />
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
