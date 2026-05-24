-- Garante RLS habilitado em realtime.messages (Broadcast/Presence authorization)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores, se existirem
DROP POLICY IF EXISTS "deny_all_realtime_broadcast_select" ON realtime.messages;
DROP POLICY IF EXISTS "deny_all_realtime_broadcast_insert" ON realtime.messages;

-- Bloqueio padrão: o app não usa canais Broadcast/Presence.
-- postgres_changes continua funcionando normalmente, pois usa o RLS das tabelas de origem.
CREATE POLICY "deny_all_realtime_broadcast_select"
ON realtime.messages
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "deny_all_realtime_broadcast_insert"
ON realtime.messages
FOR INSERT
TO anon, authenticated
WITH CHECK (false);