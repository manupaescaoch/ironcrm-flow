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
  usar_media_manual?: boolean;
  media_diaria_manual?: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itens: AjustarMinimosItem[];
  canApplyAllUnidades?: boolean;
  unidadesCount?: number;
  isApplying?: boolean;
  onApply: (opts: { onlyIfEmptyOrDifferent: boolean; applyAllUnidades: boolean }) => void;
};

export function AjustarMinimosModal({
  open,
  onOpenChange,
  itens,
  canApplyAllUnidades,
  unidadesCount,
  isApplying,
  onApply,
}: Props) {
  const [onlyIfEmptyOrDifferent, setOnlyIfEmptyOrDifferent] = useState(true);
  const [applyAllUnidades, setApplyAllUnidades] = useState(false);

  const preview = useMemo(() => {
    const total = itens.length;
    const candidatos = onlyIfEmptyOrDifferent
      ? itens.filter((i) => (i.quantidade_minima ?? 0) !== (i.ponto_pedido ?? 0))
      : itens;

    const comPontoPedido = candidatos.filter((i) => (i.ponto_pedido ?? 0) > 0);
    const comMediaManual = candidatos.filter((i) => i.usar_media_manual && (i.media_diaria_manual ?? 0) > 0);
    return { total, candidatos: candidatos.length, comPontoPedido: comPontoPedido.length, comMediaManual: comMediaManual.length };
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
            {preview.comMediaManual > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                <span className="text-primary">●</span> Usando média manual: <strong className="text-foreground">{preview.comMediaManual}</strong>
              </div>
            )}
            {canApplyAllUnidades && (unidadesCount ?? 0) > 1 ? (
              <div className="text-xs text-muted-foreground mt-2">
                Opcional: você pode aplicar também nas outras unidades (repete o processo por unidade).
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground mt-2">
              Observação: itens com ponto de pedido = 0 não trazem ganho (sem histórico suficiente ou média manual não configurada).
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

          {canApplyAllUnidades && (unidadesCount ?? 0) > 1 ? (
            <div className="flex items-start gap-2">
              <Checkbox
                id="applyAllUnidades"
                checked={applyAllUnidades}
                onCheckedChange={(v) => setApplyAllUnidades(Boolean(v))}
              />
              <div className="grid gap-1">
                <Label htmlFor="applyAllUnidades" className="text-sm">
                  Aplicar nas {unidadesCount} unidades
                </Label>
                <p className="text-xs text-muted-foreground">
                  Vai buscar os itens de cada unidade e ajustar o mínimo conforme o consumo daquela unidade.
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => onApply({ onlyIfEmptyOrDifferent, applyAllUnidades })}
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
