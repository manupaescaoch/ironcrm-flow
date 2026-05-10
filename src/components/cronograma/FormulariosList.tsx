import { useState } from 'react';
import { useFormularios, useDeleteFormulario, useToggleFormulario } from '@/hooks/useFormulariosData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, FileText, Eye, ClipboardCheck, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface FormulariosListProps {
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  onViewRespostas: (id: string) => void;
}

export function FormulariosList({ onCreateNew, onEdit, onViewRespostas }: FormulariosListProps) {
  const { data: formularios, isLoading } = useFormularios();
  const deleteFormulario = useDeleteFormulario();
  const toggleFormulario = useToggleFormulario();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const encerramentoUrl = `${window.location.origin}/encerramento-turno`;
  const coordenadorUrl = `${window.location.origin}/encerramento-coordenador`;
  const horarioUrl = `${window.location.origin}/encerramento-horario`;

  const FixedCard = ({ title, subtitle, url }: { title: string; subtitle: string; url: string }) => (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
      <CardContent className="py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <ClipboardCheck className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold">{title}</h4>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">Fixo</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copiado'); }}>
            <Copy className="w-4 h-4 mr-1" /> Copiar link
          </Button>
          <Button size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" /> Abrir
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Featured fixed forms */}
      <FixedCard title="Formulário de Encerramento — Estagiário Líder" subtitle="Estagiário Líder · ao final do turno · tablet/celular" url={encerramentoUrl} />
      <FixedCard title="Formulário de Encerramento — Coordenador" subtitle="Coordenador de Unidade · ao final do turno · tablet/celular" url={coordenadorUrl} />
      <FixedCard title="Formulário de Encerramento — Coordenador de Horário" subtitle="Coordenador de Horário · ao final do turno · tablet/celular" url={horarioUrl} />

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Formulários</h3>
        <Button onClick={onCreateNew} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Novo Formulário
        </Button>
      </div>

      {(!formularios || formularios.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum formulário criado ainda.</p>
            <Button onClick={onCreateNew} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Criar primeiro formulário
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {formularios.map(form => (
            <Card key={form.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{form.titulo}</h4>
                    <Badge variant={form.ativo ? 'default' : 'secondary'} className="text-xs">
                      {form.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  {form.descricao && (
                    <p className="text-sm text-muted-foreground truncate mt-1">{form.descricao}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Criado em {format(new Date(form.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(checked) => toggleFormulario.mutate({ id: form.id, ativo: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => onViewRespostas(form.id)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(form.id)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso excluirá o formulário e todas as respostas associadas. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteFormulario.mutate(form.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
