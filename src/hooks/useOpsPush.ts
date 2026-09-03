import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SW_URL = '/ops-push-sw.js';

export type OpsPushEstado =
  | 'carregando'
  | 'nao_suportado'
  | 'abrir_em_nova_aba'
  | 'bloqueado'
  | 'nao_configurado'
  | 'desativado'
  | 'ativado';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function suportado() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Web Push do EVO OPS. As chaves VAPID ficam apenas no backend. */
export function useOpsPush() {
  const [estado, setEstado] = useState<OpsPushEstado>('carregando');
  const [processando, setProcessando] = useState(false);

  const sincronizar = useCallback(async () => {
    if (!suportado()) {
      setEstado('nao_suportado');
      return;
    }
    if (Notification.permission === 'denied') {
      setEstado('bloqueado');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? 'ativado' : 'desativado');
    } catch {
      setEstado('desativado');
    }
  }, []);

  useEffect(() => {
    void sincronizar();
  }, [sincronizar]);

  const ativar = useCallback(async () => {
    if (!suportado()) {
      setEstado('nao_suportado');
      return;
    }
    if (window.top !== window.self) {
      setEstado('abrir_em_nova_aba');
      toast.info('Abra o EVO OPS em uma aba própria (ou no app instalado) para ativar as notificações.');
      return;
    }

    setProcessando(true);
    try {
      const { data: keyData, error: keyError } = await supabase.functions.invoke('ops-push-subscribe', {
        body: { action: 'key' },
      });
      if (keyError || !keyData?.publicKey) {
        setEstado('nao_configurado');
        toast.error('Notificações push ainda não estão configuradas.');
        return;
      }

      const permissao =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permissao !== 'granted') {
        setEstado('bloqueado');
        toast.error('Permissão de notificações negada. Libere nas configurações do navegador.');
        return;
      }

      const reg = await navigator.serviceWorker.register(SW_URL);
      await navigator.serviceWorker.ready;
      const existente = await reg.pushManager.getSubscription();
      const sub =
        existente ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        }));

      const { error } = await supabase.functions.invoke('ops-push-subscribe', {
        body: {
          action: 'subscribe',
          subscription: sub.toJSON(),
          device_info: navigator.userAgent,
        },
      });
      if (error) throw error;

      setEstado('ativado');
      toast.success('Notificações ativadas neste aparelho.');
    } catch (e) {
      console.error('ativar push:', e);
      toast.error('Não foi possível ativar as notificações.');
      await sincronizar();
    } finally {
      setProcessando(false);
    }
  }, [sincronizar]);

  const desativar = useCallback(async () => {
    setProcessando(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.functions.invoke('ops-push-subscribe', {
          body: { action: 'unsubscribe', endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
      }
      setEstado('desativado');
      toast.success('Notificações desativadas neste aparelho.');
    } catch (e) {
      console.error('desativar push:', e);
      toast.error('Não foi possível desativar as notificações.');
    } finally {
      setProcessando(false);
    }
  }, []);

  const enviarTeste = useCallback(async () => {
    setProcessando(true);
    try {
      const { data, error } = await supabase.functions.invoke('ops-push-send', {
        body: { action: 'test' },
      });
      if (error) throw error;
      if (data?.enviados > 0) toast.success('Notificação de teste enviada.');
      else toast.info('Nenhum aparelho inscrito para receber a notificação.');
    } catch (e) {
      console.error('teste push:', e);
      toast.error('Falha ao enviar a notificação de teste.');
    } finally {
      setProcessando(false);
    }
  }, []);

  return { estado, processando, ativar, desativar, enviarTeste, recarregar: sincronizar };
}
