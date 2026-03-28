import { useState, useMemo, useCallback } from 'react';
import { Plus, List, Kanban, Loader2, ClipboardList, CalendarDays, LayoutDashboard, Users, FileText } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRotinasData, Rotina } from '@/hooks/useRotinasData';
import { RotinasKPIGrid } from '@/components/rotinas/RotinasKPIGrid';
import { RotinasFilters, RotinasFiltersState, filterRotinas } from '@/components/rotinas/RotinasFilters';
import { RotinasCalendario } from '@/components/rotinas/RotinasCalendario';
import { RotinasLista } from '@/components/rotinas/RotinasLista';
import { RotinasKanban } from '@/components/rotinas/RotinasKanban';
import { RotinaModal } from '@/components/rotinas/RotinaModal';
import { CronogramaDashboard } from '@/components/cronograma/CronogramaDashboard';
import { CronogramaTab } from '@/components/cronograma/CronogramaTab';
import { FuncionariosTab } from '@/components/cronograma/FuncionariosTab';
import { FormulariosList } from '@/components/cronograma/FormulariosList';
import { FormularioBuilder } from '@/components/cronograma/FormularioBuilder';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type FormView = 'list' | 'builder';

export default function Operacional() {
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  const { isAdmin, userRole } = useAuth();
  const {
    rotinas, atividades, execucoes, loading,
    createRotina, updateRotina, deleteRotina, duplicateRotina,
    toggleExecucao, saveAtividades,
  } = useRotinasData();

  const canEdit = isAdmin || userRole === 'coordenador' || userRole === 'comercial';

  // Rotinas state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRotina, setSelectedRotina] = useState<Rotina | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Rotina | null>(null);
  const [filters, setFilters] = useState<RotinasFiltersState>({
    search: '', setor: '', responsavel: '', frequencia: '', prioridade: '', showArchived: false,
  });
  const [rotinaView, setRotinaView] = useState<'calendario' | 'lista' | 'kanban'>('calendario');

  // Formulários state
  const [formView, setFormView] = useState<FormView>('list');
  const [editingFormId, setEditingFormId] = useState<string | null>(null);

  const filteredRotinas = useMemo(() => filterRotinas(rotinas, filters), [rotinas, filters]);

  const handleNew = () => { setSelectedRotina(null); setModalOpen(true); };
  const handleEdit = useCallback((r: Rotina) => { setSelectedRotina(r); setModalOpen(true); }, []);
  const handleArchive = useCallback(async (r: Rotina) => {
    await updateRotina(r.id, { arquivada: !r.arquivada } as any);
  }, [updateRotina]);
  const handleDuplicate = useCallback(async (r: Rotina) => { await duplicateRotina(r); }, [duplicateRotina]);
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteRotina(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteRotina]);

  const handleSave = async (data: any, atividadesForm: any[]) => {
    setSaving(true);
    try {
      if (selectedRotina) {
        const rotinaUpdated = await updateRotina(selectedRotina.id, data);
        if (!rotinaUpdated) return false;

        const atividadesSaved = await saveAtividades(selectedRotina.id, atividadesForm.map(a => ({
          titulo: a.titulo.toUpperCase(),
          responsavel: a.responsavel?.toUpperCase() || null,
          horario: a.horario || null,
          observacao: a.observacao || null,
        })));

        return !!atividadesSaved;
      }

      const created = await createRotina(data, atividadesForm.map(a => ({
        titulo: a.titulo.toUpperCase(),
        responsavel: a.responsavel?.toUpperCase() || null,
        horario: a.horario || null,
        observacao: a.observacao || null,
      })));

      return !!created;
    } finally {
      setSaving(false);
    }
  };

  const selectedRotinaAtividades = selectedRotina
    ? atividades.filter(a => a.rotina_id === selectedRotina.id)
    : [];

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
            <p className="text-sm text-muted-foreground">Gestão de rotinas, cronograma e formulários</p>
          </div>
        </div>

        <Tabs defaultValue="rotinas">
          <TabsList className="flex-wrap">
            <TabsTrigger value="rotinas" className="gap-1.5">
              <ClipboardList className="w-4 h-4" />
              Rotinas
            </TabsTrigger>
            <TabsTrigger value="cronograma" className="gap-1.5">
              <CalendarDays className="w-4 h-4" />
              Cronograma
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="equipe" className="gap-1.5">
                  <Users className="w-4 h-4" />
                  Equipe
                </TabsTrigger>
                <TabsTrigger value="formularios" className="gap-1.5">
                  <FileText className="w-4 h-4" />
                  Formulários
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Rotinas Tab */}
          <TabsContent value="rotinas" className="mt-4 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div />
              {canEdit && (
                <Button onClick={handleNew}><Plus className="w-4 h-4 mr-2" />Nova Rotina</Button>
              )}
            </div>

            <RotinasKPIGrid rotinas={rotinas} atividades={atividades} execucoes={execucoes} />
            <RotinasFilters filters={filters} onChange={setFilters} rotinas={rotinas} />

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs value={rotinaView} onValueChange={(v) => setRotinaView(v as any)}>
                <TabsList>
                  <TabsTrigger value="calendario"><CalendarDays className="w-4 h-4 mr-1" />Calendário</TabsTrigger>
                  <TabsTrigger value="lista"><List className="w-4 h-4 mr-1" />Lista</TabsTrigger>
                  <TabsTrigger value="kanban"><Kanban className="w-4 h-4 mr-1" />Kanban</TabsTrigger>
                </TabsList>
                <TabsContent value="calendario">
                  <RotinasCalendario
                    rotinas={filteredRotinas} atividades={atividades}
                    onEdit={handleEdit} onDelete={setDeleteTarget} canEdit={canEdit}
                    isAdmin={isAdmin}
                  />
                </TabsContent>
                <TabsContent value="lista">
                  <RotinasLista
                    rotinas={filteredRotinas} atividades={atividades} execucoes={execucoes}
                    onEdit={handleEdit} onDuplicate={handleDuplicate} onArchive={handleArchive}
                    onDelete={setDeleteTarget} onToggleExecucao={toggleExecucao} canEdit={canEdit}
                    isAdmin={isAdmin}
                  />
                </TabsContent>
                <TabsContent value="kanban">
                  <RotinasKanban
                    rotinas={filteredRotinas} atividades={atividades} execucoes={execucoes}
                    onEdit={handleEdit} onDuplicate={handleDuplicate} onArchive={handleArchive}
                    onDelete={setDeleteTarget} onToggleExecucao={toggleExecucao} canEdit={canEdit}
                    isAdmin={isAdmin}
                  />
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          {/* Cronograma Tab */}
          <TabsContent value="cronograma" className="mt-4">
            <CronogramaTab />
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-4">
            <CronogramaDashboard />
          </TabsContent>

          {/* Equipe Tab */}
          <TabsContent value="equipe" className="mt-4">
            <FuncionariosTab />
          </TabsContent>

          {/* Formulários Tab */}
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
        </Tabs>
      </div>

      {/* Rotina Modal */}
      <RotinaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        rotina={selectedRotina}
        existingAtividades={selectedRotinaAtividades}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rotina?</AlertDialogTitle>
            <AlertDialogDescription>
              A rotina "{deleteTarget?.nome}" e todas as suas atividades e execuções serão excluídas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
