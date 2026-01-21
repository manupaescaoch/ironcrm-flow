import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUnidade } from '@/contexts/UnidadeContext';

type ReplicarInsumosModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ZONA_NORTE_ID = 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6';
const ZONA_SUL_ID = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a';

export function ReplicarInsumosModal({ open, onOpenChange }: ReplicarInsumosModalProps) {
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const [resultado, setResultado] = useState<{ sucesso: number; erros: string[] } | null>(null);

  const replicarMutation = useMutation({
    mutationFn: async () => {
      // Verificar se estamos na Zona Sul
      if (unidadeAtual?.id !== ZONA_SUL_ID) {
        throw new Error('Esta função só pode ser executada na unidade Zona Sul');
      }

      // Buscar insumos ativos da Zona Norte
      const { data: insumosZN, error: fetchError } = await supabase
        .from('insumos')
        .select('*')
        .eq('unidade_id', ZONA_NORTE_ID)
        .eq('ativo', true);

      if (fetchError) throw fetchError;
      if (!insumosZN || insumosZN.length === 0) {
        throw new Error('Nenhum insumo encontrado na Zona Norte para replicar');
      }

      // Verificar quais códigos já existem na Zona Sul
      const { data: insumosExistentes } = await supabase
        .from('insumos')
        .select('codigo_insumo')
        .eq('unidade_id', ZONA_SUL_ID);

      const codigosExistentes = new Set(insumosExistentes?.map(i => i.codigo_insumo) || []);

      const sucesso: string[] = [];
      const erros: string[] = [];

      // Replicar cada insumo
      for (const insumo of insumosZN) {
        // Criar código único para ZS (adicionar sufixo _ZS se não existir)
        let codigoZS = insumo.codigo_insumo;
        if (!codigoZS.endsWith('_ZS')) {
          codigoZS = `${insumo.codigo_insumo}_ZS`;
        }

        // Pular se já existe
        if (codigosExistentes.has(codigoZS)) {
          continue;
        }

        try {
          // Inserir insumo na Zona Sul
          const { data: novoInsumo, error: insertError } = await supabase
            .from('insumos')
            .insert({
              codigo_insumo: codigoZS,
              nome_insumo: insumo.nome_insumo,
              categoria: insumo.categoria,
              unidade_medida: insumo.unidade_medida,
              quantidade_minima: insumo.quantidade_minima,
              custo_unitario: insumo.custo_unitario,
              fornecedor_padrao: insumo.fornecedor_padrao,
              lead_time_dias: insumo.lead_time_dias,
              estoque_seguranca_dias: insumo.estoque_seguranca_dias,
              quantidade_minima_compra: insumo.quantidade_minima_compra,
              ativo: true,
              unidade_id: ZONA_SUL_ID,
            })
            .select('id')
            .single();

          if (insertError) {
            erros.push(`${insumo.nome_insumo}: ${insertError.message}`);
            continue;
          }

          // Criar registro de estoque com quantidade zerada
          if (novoInsumo) {
            const { error: estoqueError } = await supabase
              .from('estoque_interno')
              .insert({
                insumo_id: novoInsumo.id,
                quantidade_atual: 0,
                unidade_id: ZONA_SUL_ID,
              });

            if (estoqueError) {
              erros.push(`Estoque ${insumo.nome_insumo}: ${estoqueError.message}`);
            } else {
              sucesso.push(insumo.nome_insumo);
            }
          }
        } catch (err) {
          erros.push(`${insumo.nome_insumo}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        }
      }

      return { sucesso: sucesso.length, erros };
    },
    onSuccess: (data) => {
      setResultado(data);
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque_interno'] });
      
      if (data.sucesso > 0) {
        toast({
          title: 'Insumos replicados com sucesso!',
          description: `${data.sucesso} insumos foram copiados da Zona Norte para a Zona Sul.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao replicar insumos',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setResultado(null);
    onOpenChange(false);
  };

  const isZonaSul = unidadeAtual?.id === ZONA_SUL_ID;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Replicar Insumos da Zona Norte
          </DialogTitle>
          <DialogDescription>
            Esta ação irá copiar todos os insumos ativos da Zona Norte para a Zona Sul, 
            criando registros com estoque inicial zerado.
          </DialogDescription>
        </DialogHeader>

        {!isZonaSul ? (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              Esta função só pode ser executada quando a unidade Zona Sul está selecionada.
            </p>
          </div>
        ) : resultado ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  {resultado.sucesso} insumos replicados com sucesso!
                </p>
                <p className="text-sm text-muted-foreground">
                  Os códigos foram criados com sufixo _ZS e estoque zerado.
                </p>
              </div>
            </div>

            {resultado.erros.length > 0 && (
              <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-2">Erros encontrados:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {resultado.erros.slice(0, 5).map((erro, idx) => (
                    <li key={idx}>• {erro}</li>
                  ))}
                  {resultado.erros.length > 5 && (
                    <li>... e mais {resultado.erros.length - 5} erros</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">O que será feito:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Copiar todos os insumos ativos da Zona Norte</li>
                <li>• Adicionar sufixo <code className="bg-muted px-1 rounded">_ZS</code> ao código</li>
                <li>• Criar registros de estoque com quantidade 0</li>
                <li>• Manter mesmas configurações (categoria, custo, etc.)</li>
              </ul>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Insumos com códigos já existentes na Zona Sul serão ignorados.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {resultado ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => replicarMutation.mutate()}
                disabled={replicarMutation.isPending || !isZonaSul}
              >
                {replicarMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Replicando...
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Replicar Insumos
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
