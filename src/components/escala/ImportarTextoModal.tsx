import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { FileText, Trash2, ArrowLeft, Upload } from "lucide-react";

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
  valido: boolean;
}

interface ImportarTextoModalProps {
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

export function ImportarTextoModal({
  open,
  onOpenChange,
  unidades,
  onSuccess,
}: ImportarTextoModalProps) {
  const currentYear = new Date().getFullYear();
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(currentYear);
  const [textoInput, setTextoInput] = useState("");
  const [registrosParsed, setRegistrosParsed] = useState<RegistroParsed[]>([]);
  const [sobrescrever, setSobrescrever] = useState(false);
  const [step, setStep] = useState<"input" | "preview">("input");
  const [isLoading, setIsLoading] = useState(false);

  const anos = useMemo(() => {
    const result = [];
    for (let i = currentYear - 1; i <= currentYear + 2; i++) {
      result.push(i);
    }
    return result;
  }, [currentYear]);

  const findUnidade = (text: string): Unidade | null => {
    const normalizedText = text.toUpperCase().trim();
    
    // Try exact match first
    const exactMatch = unidades.find(
      (u) => u.nome.toUpperCase() === normalizedText || u.slug.toUpperCase() === normalizedText
    );
    if (exactMatch) return exactMatch;

    // Try partial match
    const partialMatch = unidades.find(
      (u) =>
        normalizedText.includes(u.nome.toUpperCase()) ||
        normalizedText.includes(u.slug.toUpperCase().replace("-", " "))
    );
    return partialMatch || null;
  };

  const parseTexto = () => {
    if (!textoInput.trim()) {
      toast.error("Cole o texto da escala no campo");
      return;
    }

    const lines = textoInput.split("\n").map((line) => line.trim()).filter(Boolean);
    const registros: RegistroParsed[] = [];
    let currentUnidade: Unidade | null = null;
    let lineIndex = 0;

    for (const line of lines) {
      lineIndex++;
      
      // Check if line indicates a unit
      const possibleUnidade = findUnidade(line);
      if (possibleUnidade) {
        currentUnidade = possibleUnidade;
        continue;
      }

      // Skip header lines
      const headerPatterns = ["DATA", "TREINADOR", "RECEPCAO", "RECEPÇÃO", "SERVICOS", "SERVIÇOS", "SEGURANCA", "SEGURANÇA"];
      const isHeader = headerPatterns.some((pattern) => 
        line.toUpperCase().includes(pattern)
      );
      if (isHeader) continue;

      // Try to parse data line
      // Split by tabs or multiple spaces
      const parts = line.split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      
      // Check if first part looks like a weekend date (e.g., "07 e 08", "28 e 01")
      const datePattern = /^\d{1,2}\s*e\s*\d{1,2}$/i;
      if (parts.length >= 2 && datePattern.test(parts[0])) {
        // If no unit detected yet, try to infer from context or skip
        if (!currentUnidade) {
          // Try to find unit in the remaining text or use first available
          continue;
        }

        const registro: RegistroParsed = {
          id: `${currentUnidade.id}-${parts[0]}-${lineIndex}`,
          unidade_id: currentUnidade.id,
          unidade_nome: currentUnidade.nome,
          final_de_semana: parts[0].toUpperCase(),
          treinador: (parts[1] || "").toUpperCase(),
          recepcao: (parts[2] || "").toUpperCase(),
          servicos_gerais: (parts[3] || "").toUpperCase(),
          seguranca: (parts[4] || "").toUpperCase(),
          valido: true,
        };

        registros.push(registro);
      }
    }

    if (registros.length === 0) {
      toast.error("Não foi possível detectar registros válidos no texto. Verifique o formato.");
      return;
    }

    setRegistrosParsed(registros);
    setStep("preview");
    toast.success(`${registros.length} registro(s) detectado(s)`);
  };

  const removeRegistro = (id: string) => {
    setRegistrosParsed((prev) => prev.filter((r) => r.id !== id));
  };

  const handleImportar = async () => {
    if (registrosParsed.length === 0) {
      toast.error("Nenhum registro para importar");
      return;
    }

    setIsLoading(true);
    try {
      let inserted = 0;
      let updated = 0;
      let errors = 0;

      for (const registro of registrosParsed) {
        // Check if already exists
        const { data: existing } = await supabase
          .from("escala")
          .select("id")
          .eq("unidade_id", registro.unidade_id)
          .eq("mes", mes)
          .eq("ano", ano)
          .eq("final_de_semana", registro.final_de_semana)
          .maybeSingle();

        if (existing && !sobrescrever) {
          // Skip if exists and not overwriting
          continue;
        }

        const data = {
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
            .update(data)
            .eq("id", existing.id);

          if (error) {
            console.error("Error updating:", error);
            errors++;
          } else {
            updated++;
          }
        } else {
          const { error } = await supabase.from("escala").insert(data);

          if (error) {
            console.error("Error inserting:", error);
            errors++;
          } else {
            inserted++;
          }
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
      console.error("Error importing:", error);
      toast.error("Erro ao importar escalas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTextoInput("");
    setRegistrosParsed([]);
    setStep("input");
    setSobrescrever(false);
    onOpenChange(false);
  };

  const getMesNome = (mesNum: number) => {
    return MESES.find((m) => m.value === mesNum)?.label || "";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Escala por Texto
          </DialogTitle>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select
                  value={mes.toString()}
                  onValueChange={(v) => setMes(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ano</Label>
                <Select
                  value={ano.toString()}
                  onValueChange={(v) => setAno(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => (
                      <SelectItem key={a} value={a.toString()}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cole o texto da escala abaixo</Label>
              <Textarea
                placeholder={`Exemplo:
ZONA SUL
DATA        TREINADOR    RECEPCAO     SERVICOS GERAIS
07 e 08     TARDE        GABRIEL      WASHINGTON
14 e 15     NOITE        DANÚBIA      PAULO

ZONA NORTE
DATA        TREINADOR    RECEPCAO     SERVICOS GERAIS    SEGURANÇA
07 e 08     MANHÃ        GABI         MURILO             JOSIAS
14 e 15     TARDE        NATAN        PATRÍCIA           FELLIPE`}
                value={textoInput}
                onChange={(e) => setTextoInput(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
              <strong>Dicas:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Copie a tabela diretamente do Excel ou planilha</li>
                <li>Inclua o nome da unidade (ZONA SUL, ZONA NORTE) antes das linhas</li>
                <li>A primeira coluna deve ter o formato "DD e DD" (ex: "07 e 08")</li>
                <li>Colunas separadas por TAB ou múltiplos espaços</li>
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
                      <TableCell className="font-medium">
                        {registro.final_de_semana}
                      </TableCell>
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
                id="sobrescrever"
                checked={sobrescrever}
                onCheckedChange={(checked) => setSobrescrever(checked === true)}
              />
              <Label htmlFor="sobrescrever" className="text-sm cursor-pointer">
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
            <Button onClick={parseTexto}>
              <FileText className="h-4 w-4 mr-2" />
              Processar Texto
            </Button>
          ) : (
            <Button
              onClick={handleImportar}
              disabled={registrosParsed.length === 0 || isLoading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isLoading
                ? "Importando..."
                : `Importar ${registrosParsed.length} registro(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
