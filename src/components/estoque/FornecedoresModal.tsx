import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Truck, Plus, Pencil, Trash2, Clock, Phone, Mail, Loader2 } from "lucide-react";
import { useFornecedores, type Fornecedor } from "@/hooks/useFornecedores";
import { Badge } from "@/components/ui/badge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidadeId: string | undefined;
};

const emptyForm = {
  nome: "",
  lead_time_dias: 3,
  telefone: "",
  email: "",
  observacoes: "",
};

export function FornecedoresModal({ open, onOpenChange, unidadeId }: Props) {
  const { fornecedores, isLoading, criarFornecedor, editarFornecedor, excluirFornecedor } =
    useFornecedores(unidadeId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
  };

  const handleOpenNew = () => {
    resetForm();
    setFormOpen(true);
  };

  const handleEdit = (f: Fornecedor) => {
    setForm({
      nome: f.nome,
      lead_time_dias: f.lead_time_dias,
      telefone: f.telefone || "",
      email: f.email || "",
      observacoes: f.observacoes || "",
    });
    setEditingId(f.id);
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome.trim()) return;

    const data = {
      nome: form.nome,
      lead_time_dias: form.lead_time_dias || 3,
      telefone: form.telefone || null,
      email: form.email || null,
      observacoes: form.observacoes || null,
      ativo: true,
    };

    if (editingId) {
      editarFornecedor.mutate({ id: editingId, ...data }, { onSuccess: resetForm });
    } else {
      criarFornecedor.mutate(data, { onSuccess: resetForm });
    }
  };

  const handleDelete = (id: string) => {
    excluirFornecedor.mutate(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Gestão de Fornecedores
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Botão novo fornecedor */}
          <div className="flex justify-end">
            <Button size="sm" onClick={handleOpenNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fornecedor
            </Button>
          </div>

          {/* Form inline */}
          {formOpen && (
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="text-sm font-medium">
                {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome *</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Ex: DAVISA"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Lead Time (dias) *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.lead_time_dias}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, lead_time_dias: parseInt(e.target.value) || 1 }))
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="vendas@fornecedor.com"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                  placeholder="Notas sobre o fornecedor..."
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={criarFornecedor.isPending || editarFornecedor.isPending}
                >
                  {criarFornecedor.isPending || editarFornecedor.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {editingId ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </div>
          )}

          {/* Tabela de fornecedores */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : fornecedores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Nenhum fornecedor cadastrado.</p>
              <p className="text-sm">Clique em "Novo Fornecedor" para começar.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-[120px] text-center">Lead Time</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fornecedores.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {f.lead_time_dias} dias
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {f.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {f.telefone}
                            </span>
                          )}
                          {f.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {f.email}
                            </span>
                          )}
                          {!f.telefone && !f.email && "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(f)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação irá desativar o fornecedor "{f.nome}". Os insumos associados
                                  não serão afetados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(f.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
