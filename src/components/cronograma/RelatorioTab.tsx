import { useFormularios, useAllRespostas } from '@/hooks/useFormulariosData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, CheckCircle, Clock, BarChart3 } from 'lucide-react';

export function RelatorioTab() {
  const { data: formularios, isLoading: loadingForms } = useFormularios();
  const { data: respostas, isLoading: loadingResp } = useAllRespostas();

  if (loadingForms || loadingResp) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const totalFormularios = formularios?.length || 0;
  const totalRespostas = respostas?.length || 0;
  const enviadosGrupo = respostas?.filter((r: any) => r.enviado_grupo).length || 0;
  const pendentes = totalRespostas - enviadosGrupo;

  const kpis = [
    { label: 'Formulários', value: totalFormularios, icon: FileText, color: 'text-primary' },
    { label: 'Respostas', value: totalRespostas, icon: CheckCircle, color: 'text-emerald-500' },
    { label: 'Enviados ao Grupo', value: enviadosGrupo, icon: BarChart3, color: 'text-blue-500' },
    { label: 'Pendentes', value: pendentes, icon: Clock, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Relatório</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <kpi.icon className={`w-8 h-8 ${kpi.color}`} />
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {formularios && formularios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Respostas por Formulário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {formularios.map(form => {
                const count = respostas?.filter((r: any) => r.formulario_id === form.id).length || 0;
                return (
                  <div key={form.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{form.titulo}</span>
                    <span className="text-sm text-muted-foreground">{count} respostas</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
