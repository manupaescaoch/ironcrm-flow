#!/usr/bin/env bash
set -euo pipefail
ROOT="$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")"
TMP=/tmp/fu-phase1e
mkdir -p "$TMP/socket"
if [ ! -f "$TMP/pgdata/PG_VERSION" ]; then
  chown -R 1000:1000 "$TMP"
  setpriv --reuid=1000 --regid=1000 --clear-groups initdb -D "$TMP/pgdata" -A trust > "$TMP/init.log"
fi
if ! psql -h "$TMP/socket" -p 55441 -U lovable -d postgres -At -c 'SELECT 1' >/dev/null 2>&1; then
  chown 1000:1000 "$TMP/socket"
  setpriv --reuid=1000 --regid=1000 --clear-groups pg_ctl -D "$TMP/pgdata" -l "$TMP/server.log" -o "-k $TMP/socket -p 55441 -h 127.0.0.1" start
fi
PSQL=(psql -h "$TMP/socket" -p 55441 -U lovable -d postgres -X -v ON_ERROR_STOP=1)
if [ "$("${PSQL[@]}" -At -c "SELECT count(*) FROM pg_namespace WHERE nspname='auth'")" = 0 ]; then
  "${PSQL[@]}" <<'SQL'
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE authenticator;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE SCHEMA net;
CREATE FUNCTION net.http_post(url text,body jsonb DEFAULT '{}',params jsonb DEFAULT '{}',headers jsonb DEFAULT '{}',timeout_milliseconds integer DEFAULT 1000) RETURNS bigint LANGUAGE sql AS $$SELECT 0::bigint$$;
SQL
fi
# Every write uses the explicit local socket; inherited PG* applies only to pg_dump SELECT/schema export.
"${PSQL[@]}" -c 'TRUNCATE auth.users CASCADE;' > "$TMP/reset.log" 2>&1
python3 "$ROOT/docs/fu-phase1e/prepare.py"
python3 "$ROOT/docs/fu-phase1e/structural.py" | tee "$TMP/structural.log"
python3 "$ROOT/docs/fu-phase1e/persistence.py" | tee "$TMP/persistence.log"
deno test --config "$ROOT/docs/fu-phase1d/deno.json" --allow-env=FU_E2E_SERVE --allow-net=127.0.0.1:55442 --allow-run "$ROOT/docs/fu-phase1e/integration_test.ts"