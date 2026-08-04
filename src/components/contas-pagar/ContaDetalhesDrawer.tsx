import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, ExternalLink, CheckCircle2, Pencil, RotateCcw, Ban, Trash2, Send, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useContaEnvios, useContaHistorico } from '@/hooks/useContasPagar';
import { getContaArquivoUrl } from './uploadHelpers';
import {
  ContaPagar,
  ContaStatusView,
  ENVIO_STATUS_LABEL,
  ENVIO_TIPO_LABEL,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  labelFormaPagamento,
  labelPrioridade,
  labelStatus,
  statusBadgeClass,
} from './constants';

interface Props {
  conta: ContaPagar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: ContaStatusView | null;
  canManage: boolean;
  unidadeNome: string;
  onDarBaixa: (conta: ContaPagar) => void;
  onEditar: (conta: ContaPagar) => void;
  onReabrir: (conta: ContaPagar) => void;
  onCancelar: (conta: ContaPagar) => void;
  onExcluir: (conta: ContaPagar) => void;
  onReenviarWhatsapp?: (conta: ContaPagar, tipo: 'CADASTRO' | 'VENCIMENTO') => void;
  reenviando?: boolean;
}

const ACAO_LABEL: Record<string, string> = {
  criacao: 'Criação',
  edicao: 'Edição',
  alteracao_valor: 'Alteração de valor',
  alteracao_vencimento: 'Alteração de vencimento',
  baixa: 'Baixa',
  reabertura: 'Reabertura',
  cancelamento: 'Cancelamento',
  exclusao: 'Exclusão',
};

function Linha({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-words">{value ?? '—'}</span>
    </div>
  );
}

export function ContaDetalhesDrawer({
  conta,
  open,
  onOpenChange,
  status,
  canManage,
  unidadeNome,
  onDarBaixa,
  onEditar,
  onReabrir,
  onCancelar,
  onExcluir,
  onReenviarWhatsapp,
  reenviando,
}: Props) {
  const { toast } = useToast();
  const { data: historico } = useContaHistorico(open ? conta?.id ?? null : null);
  const { data: envios } = useContaEnvios(open ? conta?.id ?? null : null);
  const [abrindo, setAbrindo] = useState(false);

  const copiar = async (value: string | null, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiado.` });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const abrirArquivo = async (path: string | null) => {
    if (!path || abrindo) return;
    setAbrindo(true);
    const url = await getContaArquivoUrl(path);
    setAbrindo(false);
    if (url) window.open(url, '_blank', 'noopener');
    else toast({ title: 'Não foi possível abrir o documento', variant: 'destructive' });
  };

  if (!conta) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="pr-8 text-left">{conta.descricao}</SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            {status && (
              <Badge variant="outline" className={cn('text-xs', statusBadgeClass(status))}>
                {labelStatus(status)}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">{formatCurrency(Number(conta.valor))}</span>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div>
              <Linha label="Fornecedor" value={conta.fornecedor} />
              <Linha label="Categoria" value={conta.categoria} />
              <Linha label="Prioridade" value={labelPrioridade(conta.prioridade)} />
              <Linha label="Unidade" value={unidadeNome} />
              <Linha label="Centro de custo" value={conta.centro_custo} />
              <Linha label="Competência" value={conta.competencia} />
              <Linha label="Valor" value={formatCurrency(Number(conta.valor))} />
              <Linha label="Vencimento" value={formatDateBR(conta.data_vencimento)} />
              <Linha label="Forma de pagamento" value={labelFormaPagamento(conta.forma_pagamento)} />
              <Linha label="Número da fatura" value={conta.numero_fatura} />
              <Linha label="Observações" value={conta.observacoes} />
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Dados de pagamento</h4>
              {conta.chave_pix && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{conta.chave_pix}</span>
                  <Button size="sm" variant="outline" onClick={() => copiar(conta.chave_pix, 'Chave Pix')}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Chave Pix
                  </Button>
                </div>
              )}
              {conta.codigo_pix && (
                <div className="space-y-1">
                  <p className="font-mono text-[11px] break-all text-muted-foreground">{conta.codigo_pix}</p>
                  <Button size="sm" variant="outline" onClick={() => copiar(conta.codigo_pix, 'Código Pix')}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copiar código Pix
                  </Button>
                </div>
              )}
              {conta.linha_digitavel && (
                <div className="space-y-1">
                  <p className="font-mono text-[11px] break-all text-muted-foreground">{conta.linha_digitavel}</p>
                  <Button size="sm" variant="outline" onClick={() => copiar(conta.linha_digitavel, 'Linha digitável')}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copiar linha digitável
                  </Button>
                </div>
              )}
              {conta.codigo_barras && <Linha label="Código de barras" value={conta.codigo_barras} />}
              {!conta.chave_pix && !conta.codigo_pix && !conta.linha_digitavel && !conta.codigo_barras && (
                <p className="text-sm text-muted-foreground">Nenhum dado de pagamento informado.</p>
              )}
            </div>

            {(conta.documento_url || conta.comprovante_url) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Documentos</h4>
                  {conta.documento_url && (
                    <Button size="sm" variant="outline" onClick={() => abrirArquivo(conta.documento_url)}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver documento
                    </Button>
                  )}
                  {conta.comprovante_url && (
                    <Button size="sm" variant="outline" onClick={() => abrirArquivo(conta.comprovante_url)}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver comprovante
                    </Button>
                  )}
                </div>
              </>
            )}

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-1">Registro</h4>
              <Linha label="Cadastrado por" value={conta.created_by_nome} />
              <Linha label="Data do cadastro" value={formatDateTimeBR(conta.created_at)} />
              {conta.status === 'paga' && (
                <>
                  <Linha label="Valor pago" value={formatCurrency(Number(conta.valor_pago))} />
                  <Linha label="Data do pagamento" value={formatDateBR(conta.data_pagamento)} />
                  <Linha label="Juros" value={formatCurrency(Number(conta.juros))} />
                  <Linha label="Multa" value={formatCurrency(Number(conta.multa))} />
                  <Linha label="Desconto" value={formatCurrency(Number(conta.desconto))} />
                  <Linha label="Baixa realizada por" value={conta.baixado_por_nome} />
                  <Linha label="Data da baixa" value={formatDateTimeBR(conta.baixado_em)} />
                  <Linha label="Observações da baixa" value={conta.baixa_observacoes} />
                </>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-2">Envios no WhatsApp</h4>
              <div className="space-y-2">
                {(envios || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>
                )}
                {(envios || []).map((e) => (
                  <div key={e.id} className="rounded-lg border p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium flex items-center gap-1">
                        <Send className="w-3 h-3" /> {ENVIO_TIPO_LABEL[e.tipo_envio] || e.tipo_envio}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          e.status === 'enviado'
                            ? 'border-emerald-500 text-emerald-600'
                            : e.status === 'falhou'
                              ? 'border-destructive text-destructive'
                              : 'text-muted-foreground',
                        )}
                      >
                        {ENVIO_STATUS_LABEL[e.status] || e.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      Tentativas: {e.tentativas} · Última: {formatDateTimeBR(e.ultima_tentativa_em) || '—'}
                    </p>
                    {e.grupo_destino && <p className="text-muted-foreground">Grupo: {e.grupo_destino}</p>}
                    {e.erro_msg && <p className="text-destructive break-words">{e.erro_msg}</p>}
                    {canManage && e.status !== 'enviado' && onReenviarWhatsapp && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reenviando}
                        onClick={() => onReenviarWhatsapp(conta, e.tipo_envio)}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reenviar agora
                      </Button>
                    )}
                  </div>
                ))}
                {canManage && conta.status === 'pendente' && onReenviarWhatsapp && (envios || []).length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reenviando}
                    onClick={() => onReenviarWhatsapp(conta, 'CADASTRO')}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" /> Enviar ao grupo agora
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-2">Histórico</h4>
              <div className="space-y-2">
                {(historico || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum registro de histórico.</p>
                )}
                {(historico || []).map((h) => (
                  <div key={h.id} className="rounded-lg border p-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{ACAO_LABEL[h.acao] || h.acao}</span>
                      <span className="text-muted-foreground">{formatDateTimeBR(h.created_at)}</span>
                    </div>
                    {h.campo && (
                      <p className="text-muted-foreground mt-0.5">
                        {h.campo}: {h.valor_anterior || '—'} → {h.valor_novo || '—'}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-0.5">por {h.user_nome || 'SISTEMA'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {canManage && (
          <div className="p-4 border-t flex flex-wrap gap-2">
            {conta.status === 'pendente' && (
              <Button size="sm" onClick={() => onDarBaixa(conta)}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Dar baixa
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onEditar(conta)}>
              <Pencil className="w-4 h-4 mr-1" /> Editar
            </Button>
            {conta.status === 'paga' && (
              <Button size="sm" variant="outline" onClick={() => onReabrir(conta)}>
                <RotateCcw className="w-4 h-4 mr-1" /> Reabrir
              </Button>
            )}
            {conta.status !== 'cancelada' && (
              <Button size="sm" variant="outline" onClick={() => onCancelar(conta)}>
                <Ban className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => onExcluir(conta)}>
              <Trash2 className="w-4 h-4 mr-1" /> Excluir
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
