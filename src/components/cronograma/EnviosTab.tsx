import { useAllRespostas } from '@/hooks/useFormulariosData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Clock } from 'lucide-react';

export function EnviosTab() {
  const { data: respostas, isLoading } = useAllRespostas();

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  if (!respostas || respostas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma resposta recebida ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">As respostas aparecerão aqui quando os funcionários preencherem os formulários.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Respostas Recebidas</h3>
      {respostas.map((resp: any) => (
        <Card key={resp.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{resp.respondido_por_nome}</span>
                <Badge variant={resp.enviado_grupo ? 'default' : 'secondary'} className="text-xs">
                  {resp.enviado_grupo ? 'Enviado ao grupo' : 'Pendente'}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {format(new Date(resp.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Formulário: <span className="font-medium">{resp.formularios?.titulo || 'N/A'}</span>
            </p>
            {resp.respostas && Object.keys(resp.respostas).length > 0 && (
              <div className="mt-2 text-sm space-y-1">
                {Object.entries(resp.respostas).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
