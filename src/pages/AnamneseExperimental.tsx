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

type Stage = 'intro' | 'wizard' | 'final';

interface LeadInfo {
  id: string;
  nome: string;
  unidade_id: string;
  unidade_nome: string;
}

export default function AnamneseExperimental() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [stage, setStage] = useState<Stage>('intro');
  const [respostas, setRespostas] = useState<AnamneseRespostas>(initialRespostas);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: leadData, error } = await supabase
        .from('leads')
        .select('id, nome, unidade_id')
        .eq('id', id)
        .maybeSingle();

      if (error || !leadData) {
        toast({
          title: 'Lead não encontrado',
          description: 'Não foi possível carregar este lead.',
          variant: 'destructive',
        });
        navigate('/crm');
        return;
      }

      const { data: u } = await supabase
        .from('unidades')
        .select('nome')
        .eq('id', leadData.unidade_id)
        .maybeSingle();

      const { data: existing } = await supabase
        .from('anamneses_experimental')
        .select('*')
        .eq('lead_id', leadData.id)
        .maybeSingle();

      if (existing) {
        setExistingId(existing.id);
        setRespostas({
          nome: existing.nome ?? leadData.nome ?? '',
          data_nascimento: existing.data_nascimento ?? '',
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

      setLead({
        id: leadData.id,
        nome: leadData.nome,
        unidade_id: leadData.unidade_id,
        unidade_nome: u?.nome ?? '—',
      });
      setLoading(false);
    })();
  }, [id, navigate, toast]);

  const handleComplete = (final: AnamneseRespostas) => {
    setRespostas(final);
    setStage('final');
  };

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const payload = {
        lead_id: lead.id,
        unidade_id: lead.unidade_id,
        nome: respostas.nome.trim() || null,
        data_nascimento: respostas.data_nascimento || null,
        objetivo: respostas.objetivo || null,
        historico: respostas.historico || null,
        frequencia_atual: respostas.frequencia_atual || null,
        obstaculo: respostas.obstaculo || null,
        dias_semana: respostas.dias_semana || null,
        preferencia_horario: respostas.preferencia_horario,
        tem_condicao_saude: respostas.tem_condicao_saude,
        condicao_saude_descricao: respostas.condicao_saude_descricao.trim() || null,
        tem_lesao: respostas.tem_lesao,
        lesao_descricao: respostas.lesao_descricao.trim() || null,
        observacoes: respostas.observacoes.trim() || null,
      };

      const { data: saved, error } = await supabase
        .from('anamneses_experimental')
        .upsert(payload, { onConflict: 'lead_id' })
        .select('id')
        .single();

      if (error) throw error;

      // Disparar notificação WhatsApp (não bloqueia)
      supabase.functions
        .invoke('notify-anamnese-experimental', {
          body: { anamnese_id: saved?.id ?? existingId },
        })
        .catch((e) => console.warn('[anamnese] whatsapp falhou', e));

      toast({
        title: 'Anamnese salva!',
        description: 'As respostas foram vinculadas ao lead.',
      });
      navigate(`/lead/${lead.id}`);
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

  if (loading || !lead) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-anamnese-bg">
        <Loader2 className="h-8 w-8 animate-spin text-anamnese-royal" />
      </div>
    );
  }

  if (stage === 'intro') {
    return (
      <AnamneseIntro
        unidadeNome={lead.unidade_nome}
        onStart={() => setStage('wizard')}
        onCancel={() => navigate(`/lead/${lead.id}`)}
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
