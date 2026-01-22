import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Loader2, CreditCard, Calendar, FileText, User, Sparkles } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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
        title: '✅ Pagamento confirmado!',
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

  const isOverdue = vencimento.diasRestantes < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <CreditCard className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-center text-xl">
            Confirmar Pagamento
          </DialogTitle>
          <DialogDescription className="text-center">
            Registrar pagamento para o aluno abaixo
          </DialogDescription>
        </DialogHeader>

        {/* Card do Aluno */}
        <div className={cn(
          "rounded-xl border-2 p-4 space-y-3 transition-colors",
          isOverdue 
            ? "bg-destructive/5 border-destructive/30" 
            : "bg-muted/30 border-border"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
              isOverdue 
                ? "bg-destructive/20 text-destructive" 
                : "bg-primary/10 text-primary"
            )}>
              {vencimento.nome.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{vencimento.nome}</p>
              {vencimento.telefone && (
                <p className="text-sm text-muted-foreground">{vencimento.telefone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Plano</p>
                <p className="text-sm font-medium">{vencimento.planoEscolhido}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Vencimento</p>
                <p className={cn(
                  "text-sm font-medium",
                  isOverdue && "text-destructive"
                )}>
                  {format(vencimento.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          {isOverdue && (
            <div className="flex items-center gap-2 pt-2 border-t text-destructive">
              <span className="text-sm font-medium">
                ⚠️ {Math.abs(vencimento.diasRestantes)} dias em atraso
              </span>
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="dataConfirmacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data do Pagamento
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      className="bg-background"
                    />
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
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Observação
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Pagamento via PIX, referência EVO #123..."
                      className="resize-none bg-background"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25"
              >
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
