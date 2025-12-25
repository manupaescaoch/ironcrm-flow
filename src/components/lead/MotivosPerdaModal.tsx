import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Loader2 } from 'lucide-react';

export const MOTIVOS_PERDA = [
  { value: 'preco_alto', label: 'Preço alto', emoji: '💰' },
  { value: 'localizacao', label: 'Localização inconveniente', emoji: '📍' },
  { value: 'falta_tempo', label: 'Falta de tempo', emoji: '⏰' },
  { value: 'outro_lugar', label: 'Preferiu outro lugar', emoji: '🏋️' },
  { value: 'desistiu', label: 'Desistiu / Sem interesse', emoji: '🤔' },
  { value: 'sem_contato', label: 'Não conseguimos contato', emoji: '📞' },
  { value: 'vai_pensar', label: 'Vai pensar (follow-up)', emoji: '⏳' },
  { value: 'mudou_cidade', label: 'Mudou de cidade', emoji: '🔄' },
  { value: 'outro', label: 'Outro', emoji: '❓' },
] as const;

export type MotivoPerda = typeof MOTIVOS_PERDA[number]['value'];

interface MotivosPerdaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string, observacao: string) => Promise<void>;
  loading?: boolean;
}

export function MotivosPerdaModal({ open, onOpenChange, onConfirm, loading }: MotivosPerdaModalProps) {
  const [selectedMotivo, setSelectedMotivo] = useState<string>('');
  const [observacao, setObservacao] = useState('');

  const handleConfirm = async () => {
    if (!selectedMotivo) return;
    
    const motivoLabel = MOTIVOS_PERDA.find(m => m.value === selectedMotivo)?.label || selectedMotivo;
    const motivoFinal = selectedMotivo === 'outro' && observacao.trim() 
      ? `Outro: ${observacao.trim()}` 
      : motivoLabel;
    
    await onConfirm(motivoFinal, observacao);
    
    // Reset state after confirm
    setSelectedMotivo('');
    setObservacao('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !loading) {
      // Reset state when closing
      setSelectedMotivo('');
      setObservacao('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Marcar Lead como Perdido
          </DialogTitle>
          <DialogDescription>
            Por favor, selecione o motivo pelo qual este lead foi perdido. Esta informação é importante para análise e melhoria do processo comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Motivo da perda <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={selectedMotivo}
              onValueChange={setSelectedMotivo}
              className="grid gap-2"
            >
              {MOTIVOS_PERDA.map((motivo) => (
                <div key={motivo.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={motivo.value} id={motivo.value} />
                  <Label 
                    htmlFor={motivo.value} 
                    className="flex items-center gap-2 cursor-pointer font-normal"
                  >
                    <span>{motivo.emoji}</span>
                    <span>{motivo.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">
              Observação {selectedMotivo === 'outro' && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="observacao"
              placeholder={selectedMotivo === 'outro' 
                ? "Descreva o motivo..." 
                : "Adicione detalhes adicionais (opcional)..."}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedMotivo || (selectedMotivo === 'outro' && !observacao.trim()) || loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
