import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";

export type AjustarMinimosItem = {
  id: string;
  nome_insumo: string;
  quantidade_minima: number;
  ponto_pedido: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itens: AjustarMinimosItem[];
  isApplying?: boolean;
  onApply: (opts: { onlyIfEmptyOrDifferent: boolean }) => void;
};

export function AjustarMinimosModal({
  open,
  onOpenChange,
  itens,
  isApplying,
  onApply,
}: Props) {
  const [onlyIfEmptyOrDifferent, setOnlyIfEmptyOrDifferent] = useState(true);

  const preview = useMemo(() => {
    const total = itens.length;
    const candidatos = onlyIfEmptyOrDifferent
      ? itens.filter((i) => (i.quantidade_minima ?? 0) !== (i.ponto_pedido ?? 0))
      : itens;

    const comPontoPedido = candidatos.filter((i) => (i.ponto_pedido ?? 0) > 0);
    return { total, candidatos: candidatos.length, comPontoPedido: comPontoPedido.length };
  }, [itens, onlyIfEmptyOrDifferent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Ajustar estoque mínimo automaticamente
          </DialogTitle>
          <DialogDescription>
            Define <strong>Quantidade Mínima</strong> = <strong>Ponto de Pedido</strong> (baseado no consumo/lead time).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">
              Itens no filtro atual: <strong className="text-foreground">{preview.total}</strong>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Itens que serão ajustados: <strong className="text-foreground">{preview.candidatos}</strong>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Observação: itens com ponto de pedido = 0 não trazem ganho (sem histórico suficiente).
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="onlyIfEmptyOrDifferent"
              checked={onlyIfEmptyOrDifferent}
              onCheckedChange={(v) => setOnlyIfEmptyOrDifferent(Boolean(v))}
            />
            <div className="grid gap-1">
              <Label htmlFor="onlyIfEmptyOrDifferent" className="text-sm">
                Ajustar apenas quando estiver diferente do sugerido
              </Label>
              <p className="text-xs text-muted-foreground">
                Evita regravar registros que já estão alinhados.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => onApply({ onlyIfEmptyOrDifferent })}
              disabled={isApplying || preview.candidatos === 0}
              className="gap-2"
            >
              <RefreshCw className={isApplying ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Aplicar agora
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
