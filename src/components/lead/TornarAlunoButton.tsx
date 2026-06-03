import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Loader2 } from 'lucide-react';
import { normalizarTelefone } from '@/lib/crm';
import type { Lead } from '@/types/database';

interface Props {
  lead: Lead;
  onConverted: () => void;
}

const PLANOS = [
  'Mensal',
  'Trimestral',
  'Semestral',
  'Anual',
  'Executivo Mensal',
  'Executivo Anual',
] as const;

const FORMAS_PAGAMENTO = ['PIX', 'Cartão de Crédito', 'Débito', 'Dinheiro', 'Boleto'] as const;

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function planMonths(plano: string): number {
  const p = plano.toLowerCase();
  if (p.includes('anual')) return 12;
  if (p.includes('semestr')) return 6;
  if (p.includes('trimestr')) return 3;
  return 1;
}

function defaultValor(plano: string): number {
  const p = plano.toLowerCase();
  if (p.includes('anual')) return 512;
  if (p.includes('trimestr')) return 566.1;
  if (p.includes('executivo mensal')) return 449.08;
  return 0;
}

export function TornarAlunoButton({ lead, onConverted }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const userName =
    (user?.user_metadata as any)?.full_name?.toString().trim() || user?.email || '';

  const today = new Date().toISOString().slice(0, 10);
  const [plano, setPlano] = useState<string>('Mensal');
  const [dataInicio, setDataInicio] = useState(today);
  const [dataVencimento, setDataVencimento] = useState(
    addMonths(new Date(), 1).toISOString().slice(0, 10),
  );
  const [valor, setValor] = useState<number>(defaultValor('Mensal'));
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX');
  const [responsavel, setResponsavel] = useState<string>(userName);
  const [observacoes, setObservacoes] = useState('');

  function handlePlanoChange(p: string) {
    setPlano(p);
    setDataVencimento(addMonths(new Date(dataInicio + 'T00:00:00'), planMonths(p)).toISOString().slice(0, 10));
    setValor(defaultValor(p));
  }

  function handleDataInicioChange(d: string) {
    setDataInicio(d);
    setDataVencimento(addMonths(new Date(d + 'T00:00:00'), planMonths(plano)).toISOString().slice(0, 10));
  }

  async function handleConfirmar() {
    if (lead.is_matriculado) {
      toast({ title: 'Lead já está matriculado', variant: 'destructive' });
      return;
    }
    if (!responsavel.trim()) {
      toast({ title: 'Informe o responsável pela venda', variant: 'destructive' });
      return;
    }
    if (!plano) {
      toast({ title: 'Selecione o plano', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // 1) Bloqueia duplicidade: outro lead já matriculado com mesmo telefone
      const tel = normalizarTelefone(lead.telefone);
      if (tel) {
        const { data: existente } = await supabase
          .from('leads')
          .select('id, nome')
          .eq('telefone_normalizado', tel)
          .eq('is_matriculado', true)
          .eq('ativo', true)
          .neq('id', lead.id)
          .maybeSingle();

        if (existente) {
          toast({
            title: 'Já existe um aluno cadastrado com esse telefone',
            description: existente.nome ?? '',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
      }

      // 2) Cria interação de matrícula (modelo atual = matrícula)
      const { error: intErr } = await supabase.from('interacoes').insert({
        lead_id: lead.id,
        unidade_id: lead.unidade_id,
        tipo: 'Matrícula',
        descricao: observacoes.trim() || null,
        atendido_por: responsavel.trim(),
        fechou_matricula: true,
        plano_escolhido: plano,
        valor_plano: Number(valor) || 0,
        data_fechamento: dataInicio,
        responsavel_fechamento: responsavel.trim(),
        forma_pagamento: formaPagamento,
        cadastrado_por: lead.cadastrado_por ?? null,
        comissao_comercial: (Number(valor) || 0) * 0.03,
        comissao_recepcao: (Number(valor) || 0) * 0.02,
        comissao_cadastrador: (Number(valor) || 0) * 0.03,
      } as any);

      if (intErr) throw intErr;

      // 3) Atualiza o lead: status convertido, matriculado, data conversão, vencimento
      const { error: upErr } = await supabase
        .from('leads')
        .update({
          status_funil: 'convertido',
          is_matriculado: true,
          convertido_em_aluno_at: new Date().toISOString(),
          plano_escolhido: plano,
          status_conversa: 'encerrado',
        } as any)
        .eq('id', lead.id);

      if (upErr) throw upErr;

      toast({
        title: 'Aluno criado',
        description: `${lead.nome} agora é aluno ativo.`,
      });
      setOpen(false);
      onConverted();
    } catch (e: any) {
      toast({
        title: 'Erro ao converter em aluno',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (lead.is_matriculado) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <GraduationCap className="w-4 h-4" />
        Tornar aluno
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar matrícula</DialogTitle>
            <DialogDescription>
              Converter <strong>{lead.nome}</strong> em aluno ativo da unidade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome completo</Label>
                <Input value={lead.nome} disabled />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={lead.telefone ?? ''} disabled />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Plano</Label>
                <Select value={plano} onValueChange={handlePlanoChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLANOS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor do plano (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valor}
                  onChange={(e) => setValor(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data de início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => handleDataInicioChange(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Responsável pela venda</Label>
                <Input
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value.toUpperCase())}
                placeholder="OPCIONAL"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar matrícula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
