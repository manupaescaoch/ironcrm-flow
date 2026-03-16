import { useState, useMemo, useCallback } from 'react';
import { Plus, List, Kanban, Loader2, ClipboardList } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRotinasData, Rotina } from '@/hooks/useRotinasData';
import { RotinasKPIGrid } from '@/components/rotinas/RotinasKPIGrid';
import { RotinasFilters, RotinasFiltersState, filterRotinas } from '@/components/rotinas/RotinasFilters';
import { RotinasLista } from '@/components/rotinas/RotinasLista';
import { RotinasKanban } from '@/components/rotinas/RotinasKanban';
import { RotinaModal } from '@/components/rotinas/RotinaModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Rotinas() {
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  const { isAdmin, userRole } = useAuth();
  const {
    rotinas, atividades, execucoes, loading,
    createRotina, updateRotina, deleteRotina, duplicateRotina,
    toggleExecucao, saveAtividades,
  } = useRotinasData();

  const canEdit = isAdmin || userRole === 'coordenador';

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRotina, setSelectedRotina] = useState<Rotina | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Rotina | null>(null);
  const [filters, setFilters] = useState<RotinasFiltersState>({
    search: '', setor: '', responsavel: '', frequencia: '', prioridade: '', showArchived: false,
  });

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
        await updateRotina(selectedRotina.id, data);
        await saveAtividades(selectedRotina.id, atividadesForm.map(a => ({
          titulo: a.titulo.toUpperCase(),
          responsavel: a.responsavel?.toUpperCase() || null,
          horario: a.horario || null,
          observacao: a.observacao || null,
        })));
      } else {
        await createRotina(data, atividadesForm.map(a => ({
          titulo: a.titulo.toUpperCase(),
          responsavel: a.responsavel?.toUpperCase() || null,
          horario: a.horario || null,
          observacao: a.observacao || null,
        })));
      }
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
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-primary" />
              Rotinas
            </h1>
            <p className="text-sm text-muted-foreground">Checklist e execução das atividades operacionais por setor</p>
          </div>
          {canEdit && (
            <Button onClick={handleNew}><Plus className="w-4 h-4 mr-2" />Nova Rotina</Button>
          )}
        </div>

        {/* KPIs */}
        <RotinasKPIGrid rotinas={rotinas} atividades={atividades} execucoes={execucoes} />

        {/* Filters */}
        <RotinasFilters filters={filters} onChange={setFilters} rotinas={rotinas} />

        {/* Views */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="lista">
            <TabsList>
              <TabsTrigger value="lista"><List className="w-4 h-4 mr-1" />Lista</TabsTrigger>
              <TabsTrigger value="kanban"><Kanban className="w-4 h-4 mr-1" />Kanban</TabsTrigger>
            </TabsList>
            <TabsContent value="lista">
              <RotinasLista
                rotinas={filteredRotinas} atividades={atividades} execucoes={execucoes}
                onEdit={handleEdit} onDuplicate={handleDuplicate} onArchive={handleArchive}
                onDelete={setDeleteTarget} onToggleExecucao={toggleExecucao} canEdit={canEdit}
              />
            </TabsContent>
            <TabsContent value="kanban">
              <RotinasKanban
                rotinas={filteredRotinas} atividades={atividades} execucoes={execucoes}
                onEdit={handleEdit} onDuplicate={handleDuplicate} onArchive={handleArchive}
                onDelete={setDeleteTarget} onToggleExecucao={toggleExecucao} canEdit={canEdit}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Modal */}
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
