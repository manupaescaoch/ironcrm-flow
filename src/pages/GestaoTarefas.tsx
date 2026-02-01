import { useState, useCallback } from 'react';
import { Plus, Kanban, Calendar, List, Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useTarefasData, Task, TaskInsert } from '@/hooks/useTarefasData';
import { TarefasKanban } from '@/components/tarefas/TarefasKanban';
import { TarefasLista } from '@/components/tarefas/TarefasLista';
import { TarefasCalendario } from '@/components/tarefas/TarefasCalendario';
import { TarefaModal } from '@/components/tarefas/TarefaModal';

export default function GestaoTarefas() {
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  const { tasks, loading, createTask, updateTask, deleteTask, updateTaskStatus } =
    useTarefasData();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      await deleteTask(taskId);
    },
    [deleteTask]
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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Gestão de Tarefas</h1>
            <Badge variant="outline" className="text-xs">
              {unidadeAtual.nome}
            </Badge>
          </div>
          <Button onClick={handleNewTask} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Tarefa
          </Button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          /* Tabs with Views */
          <Tabs defaultValue="kanban" className="space-y-4">
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <Kanban className="w-4 h-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="calendario" className="gap-2">
                <Calendar className="w-4 h-4" />
                Calendário
              </TabsTrigger>
              <TabsTrigger value="lista" className="gap-2">
                <List className="w-4 h-4" />
                Lista
              </TabsTrigger>
            </TabsList>

            <TabsContent value="kanban">
              <TarefasKanban
                tasks={tasks}
                onTaskClick={handleTaskClick}
                onStatusChange={handleStatusChange}
              />
            </TabsContent>

            <TabsContent value="calendario">
              <TarefasCalendario tasks={tasks} onTaskClick={handleTaskClick} />
            </TabsContent>

            <TabsContent value="lista">
              <TarefasLista
                tasks={tasks}
                onTaskClick={handleTaskClick}
                onDeleteTask={handleDeleteTask}
              />
            </TabsContent>
          </Tabs>
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
