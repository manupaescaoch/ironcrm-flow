import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AnamneseIntro } from '@/components/anamnese/AnamneseIntro';
import { AnamneseFinal } from '@/components/anamnese/AnamneseFinal';
import {
  AnamneseWizard,
  AnamneseRespostas,
  initialRespostas,
} from '@/components/anamnese/AnamneseWizard';

type Stage = 'intro' | 'wizard' | 'final' | 'done';

interface LeadInfo {
  id: string;
  nome: string;
  unidade_id: string;
  unidade_nome: string;
}

export default function AnamnesePublica() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [stage, setStage] = useState<Stage>('intro');
  const [respostas, setRespostas] = useState<AnamneseRespostas>(initialRespostas);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data, error } = await supabase.functions.invoke('anamnese-publica', {
        body: { action: 'get', lead_id: id },
      });
      if (error || !data?.lead) {
        setError('Lead não encontrado ou link inválido.');
        setLoading(false);
        return;
      }
      const leadData = data.lead;
      const existing = data.existing;
      if (existing) {
        setRespostas({
          nome: existing.nome ?? leadData.nome ?? '',
          objetivo: existing.objetivo ?? '',
          historico: existing.historico ?? '',
          frequencia_atual: existing.frequencia_atual ?? '',
          obstaculo: existing.obstaculo ?? '',
          dias_semana: existing.dias_semana ?? '',
          preferencia_horario: existing.preferencia_horario ?? [],
          tem_condicao_saude: existing.tem_condicao_saude,
          condicao_saude_descricao: existing.condicao_saude_descricao ?? '',
          tem_lesao: existing.tem_lesao,
          lesao_descricao: existing.lesao_descricao ?? '',
          observacoes: existing.observacoes ?? '',
        });
      } else {
        setRespostas((prev) => ({ ...prev, nome: leadData.nome ?? '' }));
      }
      setLead(leadData);
      setLoading(false);
    })();
  }, [id]);

  const handleComplete = (final: AnamneseRespostas) => {
    setRespostas(final);
    setStage('final');
  };

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('anamnese-publica', {
        body: { action: 'save', lead_id: lead.id, respostas },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? 'Falha ao salvar');
      toast({
        title: 'Anamnese enviada!',
        description: 'Obrigado, suas respostas foram registradas.',
      });
      setStage('done');
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erro ao salvar',
        description: e?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-anamnese-bg">
        <Loader2 className="h-8 w-8 animate-spin text-anamnese-royal" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-anamnese-bg p-6 text-center">
        <p className="text-anamnese-royal-foreground">{error ?? 'Erro inesperado.'}</p>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-anamnese-bg p-8 text-center">
        <h1 className="font-display text-3xl uppercase tracking-tight">Tudo certo! 🎉</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Suas respostas foram enviadas para a equipe. Você já pode fechar esta página.
        </p>
      </div>
    );
  }

  if (stage === 'intro') {
    return (
      <AnamneseIntro
        unidadeNome={lead.unidade_nome}
        onStart={() => setStage('wizard')}
        onCancel={() => setStage('intro')}
      />
    );
  }

  if (stage === 'wizard') {
    return (
      <AnamneseWizard
        initial={respostas}
        onComplete={handleComplete}
        onBackToIntro={() => setStage('intro')}
      />
    );
  }

  return <AnamneseFinal onSave={handleSave} saving={saving} />;
}
