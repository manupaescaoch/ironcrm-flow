import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useComissoesData } from '@/hooks/useComissoesData';
import { ComissoesFilters } from '@/components/comissoes/ComissoesFilters';
import { ComissoesKPIGrid } from '@/components/comissoes/ComissoesKPIGrid';
import { ComissaoTable } from '@/components/comissoes/ComissaoTable';
import { TreinadorBonusTable } from '@/components/comissoes/TreinadorBonusTable';
import { MatriculasDetailTable } from '@/components/comissoes/MatriculasDetailTable';
import { LeadsModal } from '@/components/comissoes/LeadsModal';
import { exportComissoesToPDF } from '@/components/comissoes/ComissoesPDFExport';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export default function Comissoes() {
  const [selectedPerson, setSelectedPerson] = useState<{ name: string; type: 'cadastrador' | 'fechador' } | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const { toast } = useToast();
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  const { isAdmin } = useAuth();

  const {
    loading,
    mes,
    setMes,
    ano,
    setAno,
    filterFuncionario,
    setFilterFuncionario,
    filteredInteracoes,
    stats,
    comissoesCadastrador,
    comissoesFechador,
    bonusTreinadores,
    treinadorStats,
    totalComissoes,
    refetch,
  } = useComissoesData();

  const handlePersonClick = (name: string, type: 'cadastrador' | 'fechador') => {
    setSelectedPerson({ name, type });
  };

  const handleExportPDF = () => {
    exportComissoesToPDF({
      mes,
      ano,
      stats,
      treinadorStats,
      totalComissoes,
      comissoesCadastrador,
      comissoesFechador,
      bonusTreinadores,
      filteredInteracoes,
    });
    toast({ title: 'PDF exportado com sucesso!' });
  };

  const handleRecalcular = async () => {
    if (!unidadeAtual) return;
    const mesNum = parseInt(mes);
    const anoNum = parseInt(ano);
    const startDate = format(new Date(anoNum, mesNum - 1, 1), 'yyyy-MM-dd');
    const endDate = format(new Date(anoNum, mesNum, 0), 'yyyy-MM-dd');

    setRecalculando(true);
    try {
      const { data: rows, error: fetchErr } = await supabase
        .from('interacoes')
        .select('id, valor_plano, comissao_comercial, comissao_recepcao')
        .eq('fechou_matricula', true)
        .eq('unidade_id', unidadeAtual.id)
        .gte('data_fechamento', startDate)
        .lte('data_fechamento', endDate);

      if (fetchErr) throw fetchErr;

      const round = (v: number) => Math.round(v * 100) / 100;
      const updates = (rows || [])
        .map((r: any) => {
          const valor = Number(r.valor_plano || 0);
          const novaCadastrador = round(valor * 0.03);
          const novaFechador = round(valor * 0.02);
          if (
            round(Number(r.comissao_comercial || 0)) === novaCadastrador &&
            round(Number(r.comissao_recepcao || 0)) === novaFechador
          ) return null;
          return { id: r.id, comissao_comercial: novaCadastrador, comissao_recepcao: novaFechador };
        })
        .filter(Boolean) as { id: string; comissao_comercial: number; comissao_recepcao: number }[];

      let atualizadas = 0;
      for (const u of updates) {
        const { error } = await supabase
          .from('interacoes')
          .update({ comissao_comercial: u.comissao_comercial, comissao_recepcao: u.comissao_recepcao })
          .eq('id', u.id);
        if (!error) atualizadas++;
      }

      toast({
        title: 'Comissões recalculadas',
        description: `${atualizadas} de ${rows?.length || 0} matrículas atualizadas (3% cadastrador / 2% fechador).`,
      });
      await refetch();
    } catch (e: any) {
      toast({ title: 'Erro ao recalcular', description: e.message, variant: 'destructive' });
    } finally {
      setRecalculando(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Comissões do Mês</h1>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRecalcular}
                disabled={recalculando || loading || filteredInteracoes.length === 0}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${recalculando ? 'animate-spin' : ''}`} />
                {recalculando ? 'Recalculando...' : 'Recalcular Comissões'}
              </Button>
              <Button onClick={handleExportPDF} disabled={loading || filteredInteracoes.length === 0}>
                <FileDown className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          )}
        </div>


        <ComissoesFilters
          mes={mes}
          ano={ano}
          filterFuncionario={filterFuncionario}
          onMesChange={setMes}
          onAnoChange={setAno}
          onFilterFuncionarioChange={setFilterFuncionario}
        />

        {loading || unidadeLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ComissoesKPIGrid
              stats={stats}
              treinadorStats={treinadorStats}
              totalComissoes={totalComissoes}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <ComissaoTable
                title="Comissão do Cadastrador (3%)"
                type="cadastrador"
                data={comissoesCadastrador}
                totalComissao={stats.totalComissaoCadastrador}
                onPersonClick={handlePersonClick}
              />
              <ComissaoTable
                title="Comissão do Fechador (2%)"
                type="fechador"
                data={comissoesFechador}
                totalComissao={stats.totalComissaoFechador}
                onPersonClick={handlePersonClick}
              />
            </div>

            <TreinadorBonusTable
              bonusTreinadores={bonusTreinadores}
              treinadorStats={treinadorStats}
            />

            <MatriculasDetailTable
              interacoes={filteredInteracoes}
              mes={mes}
              ano={ano}
            />

            <LeadsModal
              selectedPerson={selectedPerson}
              interacoes={filteredInteracoes}
              onClose={() => setSelectedPerson(null)}
            />
          </>
        )}
      </div>
    </Layout>
  );
}
