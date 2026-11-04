import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { contactKey, contactMatches, type ContactIdentity } from '@/lib/fuContactIdentity';

export function useFuContact(identity: ContactIdentity, makeMessage: (name: string) => string) {
  const key = contactKey(identity);
  const [loaded, setLoaded] = useState<{ key: string; aluno: { nome: string; telefone: string | null }; mensagem: string } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  useEffect(() => {
    let active = true;
    setLoaded(null);
    setFailure(null);
    if (!identity.taskId || !identity.leadId || !identity.enrollmentId || !identity.unitId || !identity.stage) {
      setFailure({ key, message: 'Contato indisponível para esta seleção.' });
      return;
    }
    (async () => {
      try {
        const [lead, enrollment] = await Promise.all([
          supabase.from('leads').select('nome,telefone').eq('id', identity.leadId).eq('unidade_id', identity.unitId).maybeSingle(),
          supabase.from('interacoes').select('id').eq('id', identity.enrollmentId).eq('lead_id', identity.leadId).eq('unidade_id', identity.unitId).maybeSingle(),
        ]);
        if (!active) return;
        if (lead.error || enrollment.error) throw new Error('Não foi possível carregar este contato.');
        if (!lead.data || !enrollment.data) throw new Error('Aluno ou matrícula indisponível nesta unidade.');
        setLoaded({ key, aluno: lead.data, mensagem: makeMessage(lead.data.nome) });
      } catch (error) {
        if (active) setFailure({ key, message: error instanceof Error ? error.message : 'Não foi possível carregar este contato.' });
      }
    })();
    return () => { active = false; };
  }, [key, makeMessage]);
  const matching = contactMatches(key, loaded?.key);
  return {
    aluno: matching ? loaded?.aluno ?? null : null,
    mensagem: matching ? loaded?.mensagem ?? '' : '',
    ready: matching,
    error: failure?.key === key ? failure.message : null,
    setMensagem: (mensagem: string) => setLoaded(previous => previous?.key === key ? { ...previous, mensagem } : previous),
  };
}