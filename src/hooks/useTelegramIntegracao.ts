import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TelegramStatus = 'nao_configurado' | 'conectado' | 'erro';

export interface TelegramHealth {
  status: TelegramStatus;
  configured: boolean;
  checkedAt: string;
  bot: { id?: number; name?: string; username?: string } | null;
  detail?: string | null;
}

export interface TelegramUserRow {
  user_id: string;
  nome: string;
  email: string;
  unidades: string;
  funcao: string;
  turno: string;
  status: 'conectado' | 'nao_conectado' | 'inativo';
  telegram_username: string | null;
  telegram_user_id: string | null;
  connected_at: string | null;
}

export interface TelegramGroupRow {
  id: string;
  group_type: string;
  name: string;
  telegram_chat_id: number | null;
  telegram_title: string | null;
  status: string;
  connected_at: string | null;
}

export interface DetectedChat {
  telegram_chat_id: number;
  title: string | null;
  chat_type: string | null;
  last_seen_at: string;
}

const FUNCAO_LABEL: Record<string, string> = {
  admin: 'Administrador',
  recepcao: 'Recepção',
  comercial: 'Comercial',
  coordenador: 'Gerente de Unidade',
  gerente: 'Gerente Geral',
};

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export function useTelegramIntegracao() {
  const [health, setHealth] = useState<TelegramHealth | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [users, setUsers] = useState<TelegramUserRow[]>([]);
  const [groups, setGroups] = useState<TelegramGroupRow[]>([]);
  const [detected, setDetected] = useState<DetectedChat[]>([]);
  const [falhas24h, setFalhas24h] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadHealth = useCallback(async (): Promise<TelegramHealth | null> => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke<TelegramHealth>('telegram-health');
      if (error) throw error;
      setHealth(data ?? null);
      const { data: row } = await supabase
        .from('integracoes')
        .select('connected_at')
        .eq('provider', 'telegram')
        .maybeSingle();
      setConnectedAt(row?.connected_at ?? null);
      return data ?? null;
    } catch {
      setHealth((prev) => prev ?? { status: 'erro', configured: false, checkedAt: new Date().toISOString(), bot: null });
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [usersRes, linksRes, groupsRes, detectedRes, unidadesRes, unidadesUserRes, logsRes] = await Promise.all([
        supabase.functions.invoke('list-users', headers ? { headers } : undefined),
        supabase.from('telegram_users').select('*'),
        supabase.from('telegram_groups').select('*').order('name'),
        supabase.from('telegram_detected_chats').select('*').order('last_seen_at', { ascending: false }),
        supabase.from('unidades').select('id, nome'),
        supabase.from('user_unidades').select('user_id, unidade_id'),
        supabase.from('telegram_message_logs').select('id', { count: 'exact', head: true }).eq('status', 'erro').gte('created_at', desde),
      ]);

      const unidadeNome = new Map<string, string>(
        (unidadesRes.data ?? []).map((u: { id: string; nome: string }) => [u.id, u.nome]),
      );
      const unidadesPorUser = new Map<string, string[]>();
      (unidadesUserRes.data ?? []).forEach((uu: { user_id: string; unidade_id: string }) => {
        const arr = unidadesPorUser.get(uu.user_id) ?? [];
        arr.push(unidadeNome.get(uu.unidade_id) ?? '—');
        unidadesPorUser.set(uu.user_id, arr);
      });

      const linkMap = new Map<string, any>((linksRes.data ?? []).map((l: any) => [l.user_id, l]));

      const rows: TelegramUserRow[] = ((usersRes.data as any)?.users ?? []).map((u: any) => {
        const link = linkMap.get(u.id);
        const conectado = !!link?.telegram_user_id;
        return {
          user_id: u.id,
          nome: (u.name || u.email?.split('@')[0] || 'Usuário').toUpperCase(),
          email: u.email ?? '',
          unidades: (unidadesPorUser.get(u.id) ?? []).join(' · ') || '—',
          funcao: u.role ? (FUNCAO_LABEL[u.role] ?? u.role) : '—',
          turno: '—',
          status: conectado ? 'conectado' : link?.status === 'inativo' ? 'inativo' : 'nao_conectado',
          telegram_username: link?.telegram_username ?? null,
          telegram_user_id: link?.telegram_user_id ? String(link.telegram_user_id) : null,
          connected_at: link?.connected_at ?? null,
        };
      });

      rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      setUsers(rows);
      setGroups((groupsRes.data ?? []) as TelegramGroupRow[]);
      setDetected((detectedRes.data ?? []) as DetectedChat[]);
      setFalhas24h(logsRes.count ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const callAdmin = useCallback(async (payload: Record<string, unknown>) => {
    const headers = await authHeaders();
    const { data, error } = await supabase.functions.invoke('telegram-admin', {
      body: payload,
      ...(headers ? { headers } : {}),
    });
    if (error) {
      let details = error.message;
      try {
        const ctx = (error as any).context;
        if (ctx?.text) details = await ctx.text();
      } catch { /* ignora */ }
      throw new Error(details);
    }
    if ((data as any)?.error) throw new Error(String((data as any).error));
    return data as any;
  }, []);

  useEffect(() => {
    loadHealth();
    loadData();
  }, [loadHealth, loadData]);

  return {
    health,
    connectedAt,
    users,
    groups,
    detected,
    falhas24h,
    loading,
    checking,
    loadHealth,
    loadData,
    callAdmin,
  };
}
