import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { VencimentoItem } from '@/hooks/useVencimentosData';
import { useAuth } from '@/contexts/AuthContext';

const formSchema = z.object({
  dataConfirmacao: z.string().min(1, 'Data de confirmação é obrigatória'),
  observacao: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ConfirmarPagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vencimento: VencimentoItem | null;
  onSuccess?: () => void;
}

export function ConfirmarPagamentoModal({
  open,
  onOpenChange,
  vencimento,
  onSuccess,
}: ConfirmarPagamentoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dataConfirmacao: format(new Date(), 'yyyy-MM-dd'),
      observacao: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!vencimento) return;

    setIsSubmitting(true);
    try {
      // Inserir confirmação de pagamento
      const { error } = await supabase.from('pagamentos_mensais').insert({
        interacao_id: vencimento.id,
        lead_id: vencimento.leadId,
        unidade_id: vencimento.unidadeId,
        data_vencimento: format(vencimento.dataVencimento, 'yyyy-MM-dd'),
        data_confirmacao: data.dataConfirmacao,
        confirmado_por: user?.email?.split('@')[0]?.toUpperCase() || 'SISTEMA',
        observacao: data.observacao || null,
      });

      if (error) throw error;

      toast({
        title: 'Pagamento confirmado',
        description: `Pagamento de ${vencimento.nome} registrado com sucesso.`,
      });

      form.reset({
        dataConfirmacao: format(new Date(), 'yyyy-MM-dd'),
        observacao: '',
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao confirmar pagamento:', error);
      toast({
        title: 'Erro ao confirmar',
        description: error.message || 'Não foi possível registrar o pagamento.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vencimento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Confirmar Pagamento
          </DialogTitle>
          <DialogDescription>
            Registrar pagamento de <strong>{vencimento.nome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plano:</span>
            <span className="font-medium">{vencimento.planoEscolhido}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vencimento:</span>
            <span className="font-medium">
              {format(vencimento.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="dataConfirmacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do Pagamento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Pagamento via PIX, referência EVO #123..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirmar Pagamento
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
