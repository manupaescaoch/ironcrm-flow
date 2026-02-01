import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Fornecedor = {
  id: string;
  unidade_id: string;
  nome: string;
  lead_time_dias: number;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type FornecedorInsert = Omit<Fornecedor, "id" | "created_at" | "updated_at">;
export type FornecedorUpdate = Partial<FornecedorInsert> & { id: string };

export function useFornecedores(unidadeId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["fornecedores", unidadeId];

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!unidadeId) return [];
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .eq("unidade_id", unidadeId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
    enabled: !!unidadeId,
  });

  const criarFornecedor = useMutation({
    mutationFn: async (data: Omit<FornecedorInsert, "unidade_id">) => {
      if (!unidadeId) throw new Error("Nenhuma unidade selecionada");
      const { error } = await supabase.from("fornecedores").insert({
        ...data,
        nome: data.nome.toUpperCase(),
        unidade_id: unidadeId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Fornecedor cadastrado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao cadastrar fornecedor", description: error.message, variant: "destructive" });
    },
  });

  const editarFornecedor = useMutation({
    mutationFn: async (data: FornecedorUpdate) => {
      const { id, ...rest } = data;
      const updateData = {
        ...rest,
        nome: rest.nome?.toUpperCase(),
      };
      const { error } = await supabase.from("fornecedores").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Fornecedor atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar fornecedor", description: error.message, variant: "destructive" });
    },
  });

  const excluirFornecedor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Fornecedor excluído com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir fornecedor", description: error.message, variant: "destructive" });
    },
  });

  return {
    fornecedores,
    isLoading,
    criarFornecedor,
    editarFornecedor,
    excluirFornecedor,
  };
}
