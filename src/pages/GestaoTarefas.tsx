import { useState, useCallback, useMemo } from 'react';
import { Plus, Kanban, Calendar, List, Loader2, Archive, ArchiveRestore } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useTarefasData, Task, TaskInsert } from '@/hooks/useTarefasData';
import { TarefasKanban } from '@/components/tarefas/TarefasKanban';
import { TarefasLista } from '@/components/tarefas/TarefasLista';
import { TarefasCalendario } from '@/components/tarefas/TarefasCalendario';
import { TarefaModal } from '@/components/tarefas/TarefaModal';
import { TarefasKPIGrid } from '@/components/tarefas/TarefasKPIGrid';
import { TarefasFilters, TarefasFiltersState, filterTasks } from '@/components/tarefas/TarefasFilters';
import { TarefasExport } from '@/components/tarefas/TarefasExport';

export default function GestaoTarefas() {
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  const { tasks, loading, createTask, updateTask, deleteTask, updateTaskStatus } =
    useTarefasData();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filters, setFilters] = useState<TarefasFiltersState>({
    search: '',
    responsavel: '',
    prioridade: '',
    setor: '',
  });

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;
    
    // Filter by archived status
    if (!showArchived) {
      result = result.filter((t) => !t.arquivada);
    }
    
    // Apply other filters
    return filterTasks(result, filters);
  }, [tasks, filters, showArchived]);

  const handleNewTask = () => {
    setSelectedTask(null);
    setModalOpen(true);
  };

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
  }, []);

  const handleSaveTask = async (data: TaskInsert) => {
    setIsSaving(true);
    try {
      if (selectedTask) {
        await updateTask(selectedTask.id, data);
      } else {
        await createTask(data);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = useCallback(
    async (taskId: string, newStatus: Task['status']) => {
      await updateTaskStatus(taskId, newStatus);
    },
    [updateTaskStatus]
  );

  const handleArchiveTask = useCallback(
    async (taskId: string) => {
      await updateTask(taskId, { arquivada: true });
    },
    [updateTask]
  );

  const handleUnarchiveTask = useCallback(
    async (taskId: string) => {
      await updateTask(taskId, { arquivada: false });
    },
    [updateTask]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      // Instead of deleting, archive the task
      await handleArchiveTask(taskId);
    },
    [handleArchiveTask]
  );

  if (unidadeLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!unidadeAtual) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center text-muted-foreground py-12">
            Nenhuma unidade selecionada
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Gestão de Tarefas</h1>
            <Badge variant="outline" className="text-xs">
              {unidadeAtual.nome}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <TarefasExport tasks={filteredTasks} unidadeNome={unidadeAtual.nome} />
            <Button onClick={handleNewTask} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Nova Tarefa
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPIs + Archive Toggle Row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <TarefasKPIGrid tasks={tasks} />
              
              {/* Show archived toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                />
                <Label htmlFor="show-archived" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                  <Archive className="w-3.5 h-3.5" />
                  Arquivadas
                </Label>
              </div>
            </div>

            {/* Filters */}
            <TarefasFilters
              tasks={tasks}
              filters={filters}
              onFiltersChange={setFilters}
            />

            {/* Tabs with Views */}
            <Tabs defaultValue="kanban" className="space-y-3">
              <TabsList className="h-9">
                <TabsTrigger value="kanban" className="gap-1.5 text-xs px-3">
                  <Kanban className="w-3.5 h-3.5" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="calendario" className="gap-1.5 text-xs px-3">
                  <Calendar className="w-3.5 h-3.5" />
                  Calendário
                </TabsTrigger>
                <TabsTrigger value="lista" className="gap-1.5 text-xs px-3">
                  <List className="w-3.5 h-3.5" />
                  Lista
                </TabsTrigger>
              </TabsList>

              <TabsContent value="kanban" className="mt-0">
                <TarefasKanban
                  tasks={filteredTasks}
                  onTaskClick={handleTaskClick}
                  onStatusChange={handleStatusChange}
                />
              </TabsContent>

              <TabsContent value="calendario" className="mt-0">
                <TarefasCalendario tasks={filteredTasks} onTaskClick={handleTaskClick} />
              </TabsContent>

              <TabsContent value="lista" className="mt-0">
                <TarefasLista
                  tasks={filteredTasks}
                  onTaskClick={handleTaskClick}
                  onDeleteTask={handleDeleteTask}
                  showArchived={showArchived}
                  onUnarchiveTask={handleUnarchiveTask}
                />
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Task Modal */}
        <TarefaModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          task={selectedTask}
          onSave={handleSaveTask}
          isLoading={isSaving}
        />
      </div>
    </Layout>
  );
}
