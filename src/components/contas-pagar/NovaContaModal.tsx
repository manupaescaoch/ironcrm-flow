import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { parseContaTexto } from '@/lib/parseContaTexto';
import { useToast } from '@/hooks/use-toast';
import {
  ContaFormFields,
  ContaFormState,
  contaFormToPayload,
  emptyContaForm,
  gerarDatasRecorrencia,
  validateContaForm,
} from './ContaFormFields';
import { DuplicidadeDialog } from './DuplicidadeDialog';
import { SucessoConta } from './SucessoConta';
import { ContaPagar } from './constants';
import { descreverErroConta, descreverPendencias } from './erros';
import type { ContaFormPayload } from '@/hooks/useContasPagar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidadeId: string | null;
  unidadeNome: string;
  unidadesNomes?: string[];
  canManage: boolean;
  contaEdicao?: ContaPagar | null;
  onCriar: (payload: ContaFormPayload) => Promise<ContaPagar>;
  onCriarParcelas?: (payload: ContaFormPayload, datas: string[]) => Promise<number>;
  onAtualizar: (id: string, payload: Partial<ContaFormPayload>) => Promise<void>;
  buscarDuplicidade: (p: {
    descricao: string;
    valor: number;
    data_vencimento: string;
    codigo_pix?: string | null;
    linha_digitavel?: string | null;
    numero_fatura?: string | null;
  }) => Promise<ContaPagar[]>;
  onVerConta: (conta: ContaPagar) => void;
}

function contaToForm(conta: ContaPagar): ContaFormState {
  return {
    recorrente: false,
    recorrencia_freq: 'mensal',
    recorrencia_qtd: '12',
    descricao: conta.descricao || '',
    fornecedor: conta.fornecedor || '',
    categoria: conta.categoria || '',
    prioridade: conta.prioridade || 'normal',
    centro_custo: conta.centro_custo || '',
    competencia: conta.competencia || '',
    observacoes: conta.observacoes || '',
    valor: String(conta.valor).replace('.', ','),
    data_vencimento: conta.data_vencimento?.slice(0, 10) || '',
    numero_fatura: conta.numero_fatura || '',
    codigo_barras: conta.codigo_barras || '',
    linha_digitavel: conta.linha_digitavel || '',
    chave_pix: conta.chave_pix || '',
    codigo_pix: conta.codigo_pix || '',
    link_pagamento: conta.link_pagamento || '',
    banco: conta.banco || '',
    agencia: conta.agencia || '',
    conta_bancaria: conta.conta_bancaria || '',
    favorecido: conta.favorecido || '',
  };

}

export function NovaContaModal({
  open,
  onOpenChange,
  unidadeId,
  unidadeNome,
  unidadesNomes = [],
  canManage,
  contaEdicao,
  onCriar,
  onCriarParcelas,
  onAtualizar,
  buscarDuplicidade,
  onVerConta,
}: Props) {
  const { toast } = useToast();
  const isEdicao = !!contaEdicao;
  const [form, setForm] = useState<ContaFormState>(emptyContaForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [duplicados, setDuplicados] = useState<ContaPagar[]>([]);
  const [criada, setCriada] = useState<ContaPagar | null>(null);
  const [aba, setAba] = useState<'manual' | 'texto'>('manual');
  const [texto, setTexto] = useState('');
  const [avisoUnidade, setAvisoUnidade] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(contaEdicao ? contaToForm(contaEdicao) : emptyContaForm);
    setErrors({});
    setDuplicados([]);
    setCriada(null);
    setSaving(false);
    setAba('manual');
    setTexto('');
    setAvisoUnidade(null);
  }, [open, contaEdicao]);

  const analisarTexto = async () => {
    if (!texto.trim()) {
      toast({ title: 'Cole o texto da conta antes de analisar', variant: 'destructive' });
      return;
    }
    const parsed = parseContaTexto(texto, unidadesNomes);
    const next: ContaFormState = {
      ...emptyContaForm,
      descricao: parsed.descricao.toUpperCase(),
      valor: parsed.valor ? parsed.valor.replace('.', ',') : '',
      data_vencimento: parsed.data_vencimento,
      codigo_barras: parsed.codigo_barras,
      linha_digitavel: parsed.linha_digitavel,
      chave_pix: parsed.chave_pix,
      codigo_pix: parsed.codigo_pix,
      link_pagamento: parsed.link_pagamento,
    };
    setForm(next);

    // Destaca em vermelho apenas os campos obrigatórios que não foram identificados
    const faltando = validateContaForm(next);
    setErrors(faltando);

    const mencionada = parsed.unidadeMencionada;
    const divergente =
      mencionada &&
      unidadeNome &&
      mencionada.toUpperCase().replace(/^(EVO|IRON)\s+/, '').trim() !==
        unidadeNome.toUpperCase().replace(/^(EVO|IRON)\s+/, '').trim();
    setAvisoUnidade(divergente ? mencionada : null);

    const qtdFaltando = Object.keys(faltando).length;

    // Texto completo e unidade compatível: cadastra automaticamente
    if (qtdFaltando === 0 && !divergente) {
      await salvar(false, next);
      return;
    }

    setAba('manual');
    toast({
      title: qtdFaltando ? 'Texto analisado com pendências' : 'Confirme a unidade',
      description: qtdFaltando
        ? 'Revise e preencha os campos destacados antes de cadastrar.'
        : 'O texto menciona outra unidade. Confirme antes de cadastrar.',
      variant: qtdFaltando ? 'destructive' : undefined,
    });
  };

  const salvar = async (ignorarDuplicidade: boolean, formOverride?: ContaFormState) => {
    if (saving) return;
    const formAtual = formOverride ?? form;
    const validation = validateContaForm(formAtual);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    if (!unidadeId) {
      toast({ title: 'Nenhuma unidade selecionada', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const documentoUrl = contaEdicao?.documento_url ?? null;
      const payload = contaFormToPayload(formAtual, documentoUrl);

      if (isEdicao && contaEdicao) {
        await onAtualizar(contaEdicao.id, payload);
        toast({ title: 'Conta atualizada com sucesso.' });
        onOpenChange(false);
        return;
      }

      if (!ignorarDuplicidade) {
        const encontrados = await buscarDuplicidade({
          descricao: payload.descricao,
          valor: payload.valor,
          data_vencimento: payload.data_vencimento,
          codigo_pix: payload.codigo_pix,
          linha_digitavel: payload.linha_digitavel,
          numero_fatura: payload.numero_fatura,
        });
        if (encontrados.length > 0) {
          setDuplicados(encontrados);
          setSaving(false);
          return;
        }
      }

      const conta = await onCriar(payload);
      setDuplicados([]);
      setCriada(conta);

      // Recorrência: cadastra as parcelas seguintes (a primeira é a conta já criada).
      if (formAtual.recorrente && onCriarParcelas) {
        const datas = gerarDatasRecorrencia(
          payload.data_vencimento,
          formAtual.recorrencia_freq,
          Number(formAtual.recorrencia_qtd),
        ).slice(1);
        try {
          const qtd = await onCriarParcelas(payload, datas);
          toast({ title: `Conta cadastrada com ${qtd + 1} parcelas.` });
        } catch {
          toast({
            title: 'Conta cadastrada, mas as parcelas futuras falharam',
            description: 'Cadastre as próximas parcelas manualmente.',
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: 'Conta cadastrada com sucesso.' });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar a conta';
      toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isEdicao ? 'Editar conta' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>

          {criada ? (
            <SucessoConta
              conta={criada}
              unidadeNome={unidadeNome}
              onVerConta={() => {
                onOpenChange(false);
                onVerConta(criada);
              }}
              onCadastrarOutra={() => {
                setCriada(null);
                setForm(emptyContaForm);
                setTexto('');
                setAvisoUnidade(null);
                setAba('manual');
                setErrors({});
              }}
              onFechar={() => onOpenChange(false)}
            />
          ) : (
            <>
              {!isEdicao && (
                <Tabs value={aba} onValueChange={(v) => setAba(v as 'manual' | 'texto')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual">Preencher manualmente</TabsTrigger>
                    <TabsTrigger value="texto">Importar por texto</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {aba === 'texto' && !isEdicao ? (
                <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Cole abaixo as informações da conta. Se todos os dados forem identificados, a conta é cadastrada
                    automaticamente.
                  </p>
                  <Textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={12}
                    className="font-mono text-xs"
                    placeholder={`EVO BOA VIAGEM\nDescrição: CONTA TIM\nVencimento: 15/04/2026\nValor: R$ 149,99\nPix:\n\n00020126940014br.gov.bcb.pix...`}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={analisarTexto}
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {saving ? 'Cadastrando...' : 'Analisar e cadastrar'}
                  </Button>

                </div>
              ) : (
              <div className="flex-1 overflow-y-auto pr-1">
                {avisoUnidade && (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      O texto menciona a unidade <strong>{avisoUnidade}</strong>, mas a conta será cadastrada em{' '}
                      <strong>{unidadeNome}</strong>.
                    </span>
                  </div>
                )}
                <ContaFormFields
                  form={form}
                  setForm={setForm}
                  errors={errors}
                  unidadeNome={unidadeNome}
                  permitirRecorrencia={!isEdicao}
                />

              </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-3 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => (aba === 'texto' && !isEdicao ? analisarTexto() : salvar(false))}
                  disabled={saving}
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isEdicao ? 'Salvar alterações' : 'Cadastrar conta'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <DuplicidadeDialog
        open={duplicados.length > 0}
        duplicados={duplicados}
        canForce={canManage}
        saving={saving}
        onVerExistente={(conta) => {
          setDuplicados([]);
          onOpenChange(false);
          onVerConta(conta);
        }}
        onCancelar={() => setDuplicados([])}
        onCadastrarMesmoAssim={() => salvar(true)}
      />
    </>
  );
}
