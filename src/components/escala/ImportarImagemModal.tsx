import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, Trash2, ArrowLeft, Upload, Loader2 } from "lucide-react";

interface Unidade {
  id: string;
  nome: string;
  slug: string;
}

interface RegistroParsed {
  id: string;
  unidade_id: string;
  unidade_nome: string;
  final_de_semana: string;
  treinador: string;
  recepcao: string;
  servicos_gerais: string;
  seguranca: string;
}

interface ImportarImagemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidades: Unidade[];
  onSuccess: () => void;
}

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export function ImportarImagemModal({
  open,
  onOpenChange,
  unidades,
  onSuccess,
}: ImportarImagemModalProps) {
  const currentYear = new Date().getFullYear();
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(currentYear);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [registrosParsed, setRegistrosParsed] = useState<RegistroParsed[]>([]);
  const [sobrescrever, setSobrescrever] = useState(false);
  const [step, setStep] = useState<"input" | "preview">("input");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const anos = useMemo(() => {
    const result = [];
    for (let i = currentYear - 1; i <= currentYear + 2; i++) {
      result.push(i);
    }
    return result;
  }, [currentYear]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
      toast.error("Apenas imagens PNG e JPEG são aceitas");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 10MB)");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleProcessar = async () => {
    if (!imageFile || !imagePreview) {
      toast.error("Selecione uma imagem");
      return;
    }

    if (!unidadeSelecionada) {
      toast.error("Selecione uma unidade");
      return;
    }

    const unidade = unidades.find((u) => u.id === unidadeSelecionada);
    if (!unidade) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-escala-image", {
        body: {
          image_base64: imagePreview,
          unidade_id: unidadeSelecionada,
          unidade_nome: unidade.nome,
        },
      });

      if (error) {
        toast.error("Erro ao processar imagem");
        console.error(error);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const registros: RegistroParsed[] = (data?.registros || []).map(
        (r: any, i: number) => ({
          id: `img-${unidadeSelecionada}-${i}`,
          unidade_id: unidadeSelecionada,
          unidade_nome: unidade.nome,
          final_de_semana: r.final_de_semana || "",
          treinador: r.treinador || "",
          recepcao: r.recepcao || "",
          servicos_gerais: r.servicos_gerais || "",
          seguranca: r.seguranca || "",
        })
      );

      if (registros.length === 0) {
        toast.error("Nenhum registro detectado na imagem. Tente com uma imagem mais nítida.");
        return;
      }

      setRegistrosParsed(registros);
      setStep("preview");
      toast.success(`${registros.length} registro(s) detectado(s)`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar imagem");
    } finally {
      setIsProcessing(false);
    }
  };

  const removeRegistro = (id: string) => {
    setRegistrosParsed((prev) => prev.filter((r) => r.id !== id));
  };

  const handleImportar = async () => {
    if (registrosParsed.length === 0) {
      toast.error("Nenhum registro para importar");
      return;
    }

    setIsImporting(true);
    try {
      let inserted = 0;
      let updated = 0;
      let errors = 0;

      for (const registro of registrosParsed) {
        const { data: existing } = await supabase
          .from("escala")
          .select("id")
          .eq("unidade_id", registro.unidade_id)
          .eq("mes", mes)
          .eq("ano", ano)
          .eq("final_de_semana", registro.final_de_semana)
          .maybeSingle();

        if (existing && !sobrescrever) continue;

        const payload = {
          unidade_id: registro.unidade_id,
          mes,
          ano,
          final_de_semana: registro.final_de_semana,
          treinador: registro.treinador || null,
          recepcao: registro.recepcao || null,
          servicos_gerais: registro.servicos_gerais || null,
          seguranca: registro.seguranca || null,
          feriado: false,
          observacoes: null,
        };

        if (existing && sobrescrever) {
          const { error } = await supabase
            .from("escala")
            .update(payload)
            .eq("id", existing.id);
          if (error) { errors++; } else { updated++; }
        } else {
          const { error } = await supabase.from("escala").insert(payload);
          if (error) { errors++; } else { inserted++; }
        }
      }

      if (errors > 0) {
        toast.warning(`Importação parcial: ${inserted} criados, ${updated} atualizados, ${errors} erros`);
      } else {
        toast.success(`${inserted + updated} escala(s) importada(s) com sucesso`);
      }

      handleClose();
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao importar escalas");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setImageFile(null);
    setImagePreview("");
    setUnidadeSelecionada("");
    setRegistrosParsed([]);
    setStep("input");
    setSobrescrever(false);
    onOpenChange(false);
  };

  const getMesNome = (mesNum: number) =>
    MESES.find((m) => m.value === mesNum)?.label || "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5" />
            Importar Escala por Imagem
          </DialogTitle>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => (
                      <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={unidadeSelecionada} onValueChange={setUnidadeSelecionada}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Selecione a imagem da escala</Label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>

            {imagePreview && (
              <div className="border rounded-lg p-2 bg-muted/30">
                <img
                  src={imagePreview}
                  alt="Preview da escala"
                  className="max-h-[300px] mx-auto object-contain rounded"
                />
              </div>
            )}

            <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
              <strong>Dicas:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Use fotos nítidas e bem iluminadas da tabela</li>
                <li>A IA vai tentar extrair: Final de Semana, Treinador, Recepção, Serviços Gerais e Segurança</li>
                <li>Revise os dados na próxima etapa antes de importar</li>
                <li>Formatos aceitos: PNG e JPEG (máx. 10MB)</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("input")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <Badge variant="outline">
                {getMesNome(mes)} {ano}
              </Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Fim de Semana</TableHead>
                    <TableHead>Treinador</TableHead>
                    <TableHead>Recepção</TableHead>
                    <TableHead>Serv. Gerais</TableHead>
                    <TableHead>Segurança</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosParsed.map((registro) => (
                    <TableRow key={registro.id}>
                      <TableCell>
                        <Badge variant="secondary">{registro.unidade_nome}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{registro.final_de_semana}</TableCell>
                      <TableCell>{registro.treinador || "-"}</TableCell>
                      <TableCell>{registro.recepcao || "-"}</TableCell>
                      <TableCell>{registro.servicos_gerais || "-"}</TableCell>
                      <TableCell>{registro.seguranca || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeRegistro(registro.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sobrescrever-img"
                checked={sobrescrever}
                onCheckedChange={(checked) => setSobrescrever(checked === true)}
              />
              <Label htmlFor="sobrescrever-img" className="text-sm cursor-pointer">
                Sobrescrever escalas existentes para o mesmo mês/unidade/data
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {step === "input" ? (
            <Button onClick={handleProcessar} disabled={!imageFile || !unidadeSelecionada || isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando com IA...
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  Processar Imagem
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleImportar}
              disabled={registrosParsed.length === 0 || isImporting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting
                ? "Importando..."
                : `Importar ${registrosParsed.length} registro(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
