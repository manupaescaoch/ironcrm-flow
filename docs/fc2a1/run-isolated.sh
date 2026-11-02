#!/usr/bin/env bash
set -euo pipefail
# Explicit socket only; never falls back to project PG* environment.
socket="${1:?provide disposable Unix socket directory}"; port="${2:?provide disposable port}"; user="${3:?provide local owner}"
[[ "$socket" == /tmp/* && -S "$socket/.s.PGSQL.$port" ]] || { echo 'Local disposable socket required'; exit 1; }
psql -h "$socket" -p "$port" -U "$user" -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE fc2a1_test;'
psql -h "$socket" -p "$port" -U "$user" -d fc2a1_test -v ON_ERROR_STOP=1 \
 -f docs/fc2a1/bootstrap.fixture.sql \
 -f docs/fc2a1/installed-trigger-functions.fixture.sql \
 -f docs/fc2a1/installed-triggers.fixture.sql \
 -f docs/fc2a1/migration-candidate.sql \
 -f docs/fc2a1/operations-candidate.sql \
 -f docs/fc2a1/cycles.tests.sql \
 -f docs/fc2a1/atomicity.tests.sql \
 -f docs/fc2a1/operations.tests.sql
python3 docs/fc2a1/concurrency.tests.py "$socket" "$port" "$user"