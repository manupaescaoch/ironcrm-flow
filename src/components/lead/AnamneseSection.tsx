import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Pencil, Plus, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Anamnese {
  id: string;
  nome: string | null;
  data_nascimento: string | null;
  objetivo: string | null;
  historico: string | null;
  frequencia_atual: string | null;
  obstaculo: string | null;
  dias_semana: string | null;
  preferencia_horario: string[] | null;
  tem_condicao_saude: boolean | null;
  condicao_saude_descricao: string | null;
  tem_lesao: boolean | null;
  lesao_descricao: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

interface AnamneseSectionProps {
  leadId: string;
}

const NA = 'Não informado';

function fmt(v: string | null | undefined) {
  return v && v.trim().length > 0 ? v : NA;
}

function fmtBoolDescricao(b: boolean | null, descr: string | null) {
  if (b === null) return NA;
  if (!b) return 'Não';
  return `Sim — ${descr && descr.trim().length > 0 ? descr : 'sem descrição'}`;
}

export function AnamneseSection({ leadId }: AnamneseSectionProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [anamnese, setAnamnese] = useState<Anamnese | null>(null);
  const [loading, setLoading] = useState(true);

  const publicUrl = `${window.location.origin}/anamnese`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: 'Link copiado!', description: 'Envie ao lead via WhatsApp.' });
    } catch {
      toast({ title: 'Não foi possível copiar', description: publicUrl, variant: 'destructive' });
    }
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('anamneses_experimental')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();
      setAnamnese(data as Anamnese | null);
      setLoading(false);
    })();
  }, [leadId]);

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Anamnese da Aula Experimental
          {anamnese && (
            <Badge variant="secondary" className="ml-2">
              Preenchida
            </Badge>
          )}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar link da anamnese
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(`/lead/${leadId}/anamnese`)}
            className="bg-anamnese-royal text-anamnese-royal-foreground hover:bg-anamnese-royal-dark"
          >
            {anamnese ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Preencher na recepção
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-xs">
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-anamnese-royal" />
          <span className="break-all font-mono text-muted-foreground">{publicUrl}</span>
        </div>
        {!anamnese ? (
          <p className="text-sm text-muted-foreground">
            Envie o link acima para o lead responder pelo próprio celular, ou use "Preencher na
            recepção" para fazer no aparelho do CRM.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nome" value={fmt(anamnese.nome)} />
            <Field label="Objetivo" value={fmt(anamnese.objetivo)} />
            <Field label="Histórico" value={fmt(anamnese.historico)} />
            <Field label="Frequência atual" value={fmt(anamnese.frequencia_atual)} />
            <Field label="Maior obstáculo" value={fmt(anamnese.obstaculo)} />
            <Field label="Disponibilidade" value={fmt(anamnese.dias_semana)} />
            <Field
              label="Preferência de horário"
              value={
                anamnese.preferencia_horario && anamnese.preferencia_horario.length > 0
                  ? anamnese.preferencia_horario.join(', ')
                  : NA
              }
            />
            <Field
              label="Condição de saúde"
              value={fmtBoolDescricao(anamnese.tem_condicao_saude, anamnese.condicao_saude_descricao)}
            />
            <Field
              label="Lesão / limitação"
              value={fmtBoolDescricao(anamnese.tem_lesao, anamnese.lesao_descricao)}
            />
            <Field label="Observações" value={fmt(anamnese.observacoes)} className="md:col-span-2" />
            <p className="text-xs text-muted-foreground md:col-span-2">
              Atualizada em {format(new Date(anamnese.updated_at), "dd/MM/yyyy 'às' HH:mm")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
