import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseContaTexto } from '@/lib/parseContaTexto';
import {
  ContaFormFields,
  ContaFormState,
  contaFormToPayload,
  emptyContaForm,
  validateContaForm,
} from './ContaFormFields';
import { DuplicidadeDialog } from './DuplicidadeDialog';
import { SucessoConta } from './SucessoConta';
import { ContaPagar } from './constants';
import type { ContaFormPayload } from '@/hooks/useContasPagar';

const PLACEHOLDER = `EVO BOA VIAGEM
Descrição: CONTA TIM
Vencimento: 15/04/2026
Pix: 00020126940014br.gov.bcb.pix013619bc7b3c-95de-4dc6-8681-4124b912c3b90232VENC. 15/04/26 | FAT. 572953154552040000530398654100000149.995802BR5915TIM BRASIL S.A.6009Sao Paulo62180514B001572953154563043BBA
Valor: R$ 149,99`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidadeId: string | null;
  unidadeNome: string;
  unidadesNomes: string[];
  canManage: boolean;
  onCriar: (payload: ContaFormPayload) => Promise<ContaPagar>;
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

export function ImportarTextoModal({
  open,
  onOpenChange,
  unidadeId,
  unidadeNome,
  unidadesNomes,
  canManage,
  onCriar,
  buscarDuplicidade,
  onVerConta,
}: Props) {
  const { toast } = useToast();
  const [etapa, setEtapa] = useState<'texto' | 'conferencia'>('texto');
  const [texto, setTexto] = useState('');
  const [form, setForm] = useState<ContaFormState>(emptyContaForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alertaUnidade, setAlertaUnidade] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicados, setDuplicados] = useState<ContaPagar[]>([]);
  const [criada, setCriada] = useState<ContaPagar | null>(null);

  useEffect(() => {
    if (!open) return;
    setEtapa('texto');
    setTexto('');
    setForm(emptyContaForm);
    setErrors({});
    setAlertaUnidade(null);
    setDuplicados([]);
    setCriada(null);
    setSaving(false);
  }, [open]);

  const analisar = () => {
    if (!texto.trim()) {
      toast({ title: 'Cole as informações da conta antes de analisar.', variant: 'destructive' });
      return;
    }
    const parsed = parseContaTexto(texto, unidadesNomes);
    setForm({
      ...emptyContaForm,
      descricao: parsed.descricao.toUpperCase(),
      fornecedor: parsed.fornecedor.toUpperCase(),
      categoria: parsed.categoria,
      prioridade: parsed.prioridade,
      valor: parsed.valor ? String(parsed.valor).replace('.', ',') : '',
      data_vencimento: parsed.data_vencimento,
      forma_pagamento: parsed.forma_pagamento,
      chave_pix: parsed.chave_pix,
      codigo_pix: parsed.codigo_pix,
      linha_digitavel: parsed.linha_digitavel,
      codigo_barras: parsed.codigo_barras,
      numero_fatura: parsed.numero_fatura,
      observacoes: parsed.observacoes,
    });

    const mencionada = parsed.unidadeMencionada;
    const atualLimpa = unidadeNome.toUpperCase().replace(/^IRON\s+/, '').trim();
    if (mencionada && mencionada.toUpperCase().replace(/^IRON\s+/, '').trim() !== atualLimpa) {
      setAlertaUnidade('O texto menciona uma unidade diferente da unidade atualmente selecionada.');
    } else {
      setAlertaUnidade(null);
    }

    const validation = validateContaForm({
      ...emptyContaForm,
      descricao: parsed.descricao,
      fornecedor: parsed.fornecedor,
      categoria: parsed.categoria,
      prioridade: parsed.prioridade,
      valor: parsed.valor,
      data_vencimento: parsed.data_vencimento,
      forma_pagamento: parsed.forma_pagamento,
    });
    setErrors(validation);
    setEtapa('conferencia');
  };

  const confirmar = async (ignorarDuplicidade: boolean) => {
    if (saving) return;
    const validation = validateContaForm(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast({ title: 'Confira os campos destacados', variant: 'destructive' });
      return;
    }
    if (!unidadeId) {
      toast({ title: 'Nenhuma unidade selecionada', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = contaFormToPayload(form, null);

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
      toast({ title: 'Conta cadastrada com sucesso.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao cadastrar a conta';
      toast({ title: 'Erro ao cadastrar', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Conta a Pagar</DialogTitle>
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
                setTexto('');
                setForm(emptyContaForm);
                setErrors({});
                setAlertaUnidade(null);
                setEtapa('texto');
              }}
              onFechar={() => onOpenChange(false)}
            />
          ) : etapa === 'texto' ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                <p className="text-sm">
                  Unidade atual: <span className="font-semibold">{unidadeNome || '—'}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Cole abaixo as informações da conta. O sistema identificará automaticamente a descrição, o vencimento,
                  o valor e os dados de pagamento.
                </p>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-3 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={analisar}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analisar dados
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                <h3 className="text-base font-semibold">Confirme os dados da conta</h3>

                {alertaUnidade && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Atenção</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>{alertaUnidade}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => setEtapa('texto')}>
                          Corrigir o texto
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAlertaUnidade(null)}>
                          Continuar com {unidadeNome}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <ContaFormFields form={form} setForm={setForm} errors={errors} unidadeNome={unidadeNome} />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-3 border-t">
                <Button variant="outline" onClick={() => setEtapa('texto')} disabled={saving}>
                  Voltar para o texto
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={() => confirmar(false)} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar cadastro
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
        onCadastrarMesmoAssim={() => confirmar(true)}
      />
    </>
  );
}
