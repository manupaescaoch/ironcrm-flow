import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Building2, ExternalLink, RefreshCw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface StatusBtg { credenciais: boolean; cnpj: string; conectado: boolean; conectado_em?: string; consulta_disponivel: boolean; callback: string }
async function chamar(action: string, unidade_id: string) {
  const { data, error } = await supabase.functions.invoke('btg-dda', { body: { action, unidade_id } });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(details?.error ?? error.message);
  }
  return data;
}
export function BtgDdaPanel() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const [ocupado, setOcupado] = useState(false);
  const { data, isLoading, error, refetch } = useQuery<StatusBtg>({ queryKey: ['btg-dda-status', unidadeAtual?.id], enabled: !!unidadeAtual, queryFn: () => chamar('status', unidadeAtual?.id ?? '') });
  const autorizar = async () => {
    if (!unidadeAtual) return;
    setOcupado(true);
    try {
      const r = await chamar('autorizar', unidadeAtual.id);
      window.location.assign(r.url);
    } catch (e) { toast({ title: 'Não foi possível autorizar', description: (e as Error).message, variant: 'destructive' }); }
    finally { setOcupado(false); }
  };
  return <section className="space-y-5 py-3">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h2 className="font-semibold text-lg flex items-center gap-2"><Building2 className="h-5 w-5" /> DDA · BTG Empresas</h2>
      <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar status</Button>
    </div>
    {isLoading && <p className="text-muted-foreground">Carregando…</p>}
    {error && <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>}
    {data && <>
      <dl className="grid sm:grid-cols-3 gap-4 border-y py-4 text-sm">
        <div><dt className="text-muted-foreground">Unidade</dt><dd className="font-medium">{unidadeAtual?.nome}</dd></div>
        <div><dt className="text-muted-foreground">CNPJ</dt><dd>{data.cnpj || 'Não cadastrado'}</dd></div>
        <div><dt className="text-muted-foreground mb-1">Consentimento</dt><dd><Badge variant="outline">{data.conectado ? 'Recebido' : 'Não autorizado'}</Badge></dd></div>
      </dl>
      <div className="space-y-2 text-sm">
        <h3 className="font-medium">Cadastro do aplicativo BTG</h3>
        <p className="text-muted-foreground">{data.credenciais ? 'Credenciais cadastradas.' : 'Aguardando Client ID e Client Secret fornecidos pelo BTG.'}</p>
        <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(data.callback); toast({ title: 'Endereço de retorno copiado para cadastrar no BTG' }); } catch { toast({ title: 'Não foi possível copiar', variant: 'destructive' }); } }}><Copy className="h-4 w-4 mr-2" /> Copiar retorno para o BTG</Button>
      </div>
      <div className="flex gap-3 flex-wrap">
        <Button onClick={autorizar} disabled={ocupado || !data.credenciais || data.cnpj.length !== 14}><ExternalLink className="h-4 w-4 mr-2" /> {data.conectado ? 'Renovar consentimento no BTG' : 'Autorizar consulta no BTG'}</Button>
        <Button variant="outline" disabled={!data.consulta_disponivel}>Consultar boletos</Button>
      </div>
      <Alert><AlertDescription>Aguardando confirmação do BTG sobre a listagem e paginação dos boletos. Nenhum boleto foi importado.</AlertDescription></Alert>
    </>}
  </section>;
}