import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface RelatorioMes {
  id: string;
  mes_ano: string;
  ativos: number;
  adimplentes: number;
  inadimplentes: number;
  vip: number;
  suspensos: number;
  cancelamentos: number;
  renovacoes: number;
  total_a_vencer: number | null;
  churn_percentual: number;
  tempo_medio_vida: number;
  ticket_medio: number;
  observacoes: string | null;
  capacidade_zn: number;
}

interface AdicionarMesModalProps {
  open: boolean;
  onClose: () => void;
  editingRecord: RelatorioMes | null;
  existingMonths: string[];
  unidadeId?: string;
}

const CAPACIDADE_ZN = 450; // Fixed capacity for ZN

export function AdicionarMesModal({ open, onClose, editingRecord, existingMonths, unidadeId }: AdicionarMesModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    mes_ano: '',
    ativos: 0,
    adimplentes: 0,
    inadimplentes: 0,
    vip: 0,
    suspensos: 0,
    cancelamentos: 0,
    renovacoes: 0,
    total_a_vencer: 0,
    churn_percentual: 0,
    tempo_medio_vida: 0,
    ticket_medio: 0,
    observacoes: ''
  });

  useEffect(() => {
    if (editingRecord) {
      setFormData({
        mes_ano: editingRecord.mes_ano,
        ativos: editingRecord.ativos,
        adimplentes: editingRecord.adimplentes,
        inadimplentes: editingRecord.inadimplentes,
        vip: editingRecord.vip,
        suspensos: editingRecord.suspensos,
        cancelamentos: editingRecord.cancelamentos,
        renovacoes: editingRecord.renovacoes,
        total_a_vencer: editingRecord.total_a_vencer || 0,
        churn_percentual: editingRecord.churn_percentual,
        tempo_medio_vida: editingRecord.tempo_medio_vida,
        ticket_medio: editingRecord.ticket_medio,
        observacoes: editingRecord.observacoes || ''
      });
    } else {
      // Reset form for new entry
      const now = new Date();
      setFormData({
        mes_ano: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        ativos: 0,
        adimplentes: 0,
        inadimplentes: 0,
        vip: 0,
        suspensos: 0,
        cancelamentos: 0,
        renovacoes: 0,
        total_a_vencer: 0,
        churn_percentual: 0,
        tempo_medio_vida: 0,
        ticket_medio: 0,
        observacoes: ''
      });
    }
  }, [editingRecord, open]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingRecord) {
        const { error } = await supabase
          .from('relatorio_gerencial_zn')
          .update({
            ...data,
            capacidade_zn: CAPACIDADE_ZN,
            total_a_vencer: data.total_a_vencer || null
          })
          .eq('id', editingRecord.id);
        if (error) throw error;
      } else {
        if (!unidadeId) throw new Error('Nenhuma unidade selecionada');
        const { error } = await supabase
          .from('relatorio_gerencial_zn')
          .insert({
            ...data,
            capacidade_zn: CAPACIDADE_ZN,
            total_a_vencer: data.total_a_vencer || null,
            unidade_id: unidadeId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatorio-gerencial-zn'] });
      toast({ title: editingRecord ? 'Registro atualizado com sucesso' : 'Mês adicionado com sucesso' });
      onClose();
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast({ title: 'Este mês já foi cadastrado', variant: 'destructive' });
      } else if (error.code === '23514') {
        toast({ title: 'Valores inválidos. Verifique se Adimplentes + Inadimplentes + Suspensos ≤ Ativos', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao salvar dados', description: error.message, variant: 'destructive' });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!formData.mes_ano) {
      toast({ title: 'Mês/Ano é obrigatório', variant: 'destructive' });
      return;
    }
    
    if (!editingRecord && existingMonths.includes(formData.mes_ano)) {
      toast({ title: 'Este mês já foi cadastrado', variant: 'destructive' });
      return;
    }
    
    const sum = formData.adimplentes + formData.inadimplentes + formData.suspensos;
    if (sum > formData.ativos) {
      toast({ 
        title: 'Valores inválidos', 
        description: 'Adimplentes + Inadimplentes + Suspensos não pode ser maior que Ativos',
        variant: 'destructive' 
      });
      return;
    }
    
    mutation.mutate(formData);
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calculate automatic fields
  const totalOcupacao = formData.ativos + formData.vip;
  const ocupacao = totalOcupacao > 0 ? ((totalOcupacao / CAPACIDADE_ZN) * 100).toFixed(1) : '0.0';
  const vagasDisponiveis = CAPACIDADE_ZN - totalOcupacao;
  const percentualVip = formData.ativos > 0 ? ((formData.vip / formData.ativos) * 100).toFixed(1) : '0.0';
  const percentualInadimplencia = formData.ativos > 0 ? ((formData.inadimplentes / formData.ativos) * 100).toFixed(1) : '0.0';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? 'Editar Lançamento' : 'Adicionar Mês – ZN'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identification */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Identificação</h3>
            <div>
              <Label htmlFor="mes_ano">Mês/Ano</Label>
              <Input
                id="mes_ano"
                type="month"
                value={formData.mes_ano}
                onChange={(e) => handleChange('mes_ano', e.target.value)}
                disabled={!!editingRecord}
                required
              />
            </div>
          </div>

          {/* Customer Base */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Base de Clientes</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ativos">Ativos</Label>
                <Input
                  id="ativos"
                  type="number"
                  min="0"
                  value={formData.ativos}
                  onChange={(e) => handleChange('ativos', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="adimplentes">Adimplentes</Label>
                <Input
                  id="adimplentes"
                  type="number"
                  min="0"
                  value={formData.adimplentes}
                  onChange={(e) => handleChange('adimplentes', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="inadimplentes">Inadimplentes</Label>
                <Input
                  id="inadimplentes"
                  type="number"
                  min="0"
                  value={formData.inadimplentes}
                  onChange={(e) => handleChange('inadimplentes', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="vip">VIP</Label>
                <Input
                  id="vip"
                  type="number"
                  min="0"
                  value={formData.vip}
                  onChange={(e) => handleChange('vip', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="suspensos">Suspensos</Label>
                <Input
                  id="suspensos"
                  type="number"
                  min="0"
                  value={formData.suspensos}
                  onChange={(e) => handleChange('suspensos', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Monthly Movement */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Movimento do Mês</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cancelamentos">Cancelamentos</Label>
                <Input
                  id="cancelamentos"
                  type="number"
                  min="0"
                  value={formData.cancelamentos}
                  onChange={(e) => handleChange('cancelamentos', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="renovacoes">Renovações</Label>
                <Input
                  id="renovacoes"
                  type="number"
                  min="0"
                  value={formData.renovacoes}
                  onChange={(e) => handleChange('renovacoes', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="total_a_vencer">Total a Vencer (opcional)</Label>
                <Input
                  id="total_a_vencer"
                  type="number"
                  min="0"
                  value={formData.total_a_vencer}
                  onChange={(e) => handleChange('total_a_vencer', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Quality */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Qualidade e Financeiro</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="churn_percentual">Churn (%)</Label>
                <Input
                  id="churn_percentual"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.churn_percentual}
                  onChange={(e) => handleChange('churn_percentual', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="tempo_medio_vida">Tempo Médio de Vida (meses)</Label>
                <Input
                  id="tempo_medio_vida"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tempo_medio_vida}
                  onChange={(e) => handleChange('tempo_medio_vida', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ticket_medio">Ticket Médio (R$)</Label>
                <Input
                  id="ticket_medio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.ticket_medio}
                  onChange={(e) => handleChange('ticket_medio', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Automatic Calculations */}
          <div className="space-y-4 bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold text-sm text-muted-foreground">Cálculos Automáticos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Capacidade ZN:</span>
                <p className="font-medium">{CAPACIDADE_ZN}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Ocupação:</span>
                <p className="font-medium">{ocupacao}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Vagas Disponíveis:</span>
                <p className="font-medium">{vagasDisponiveis} de {CAPACIDADE_ZN}</p>
              </div>
              <div>
                <span className="text-muted-foreground">% VIP:</span>
                <p className="font-medium">{percentualVip}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Inadimplência:</span>
                <p className="font-medium">{percentualInadimplencia}%</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Observações</h3>
            <div>
              <Label htmlFor="observacoes">Notas do Mês</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                placeholder="Observações sobre o mês..."
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRecord ? 'Salvar Alterações' : 'Adicionar Mês'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
