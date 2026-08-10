import { Loader2, Users } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useUnidade } from '@/contexts/UnidadeContext';
import { FuncionariosTab } from '@/components/cronograma/FuncionariosTab';

export default function Equipe() {
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();

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
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Equipe</h1>
            <p className="text-sm text-muted-foreground">Funcionários, cargos, setores e turnos</p>
          </div>
        </div>

        <FuncionariosTab />
      </div>
    </Layout>
  );
}
