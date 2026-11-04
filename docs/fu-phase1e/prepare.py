"""Read-only schema export; all restores/writes explicitly target a disposable socket."""
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TMP = Path('/tmp/fu-phase1e')
BASE = ['psql', '-h', str(TMP / 'socket'), '-p', '55441', '-U', 'lovable', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-At']

def sql(query):
    result = subprocess.run(BASE + ['-c', query], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

def prepare():
    TMP.mkdir(exist_ok=True)
    if not os.environ.get('PGHOST'):
        raise RuntimeError('Managed read-only schema connection unavailable')
    subprocess.run(['pg_dump', '--schema-only', '--schema=public', '--no-owner', '--file=' + str(TMP / 'public.schema.sql')], check=True, capture_output=True)
    schema = (TMP / 'public.schema.sql').read_text()
    # Disposable database only; preserve the exported SQL rather than table replacements.
    sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    sql('DROP SCHEMA public;')
    for role in set(re.findall(r'^GRANT .* TO (\w+);$|^ALTER DEFAULT PRIVILEGES FOR ROLE (\w+)', schema, re.MULTILINE)):
        role = next(part for part in role if part)
        if sql(f"SELECT count(*) FROM pg_roles WHERE rolname='{role}'") == '0':
            sql(f'CREATE ROLE {role};')
    result = subprocess.run(BASE + ['-f', str(TMP / 'public.schema.sql')], capture_output=True, text=True)
    (TMP / 'restore.log').write_text(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(result.stderr[-800:])
    # Service-only operations, real public grants; no direct authenticated execution.
    sql((ROOT / 'docs/fu-phase1d/confirmations.candidate.sql').read_text())
    sql((ROOT / 'docs/fu-phase1d/evidence-origin.candidate.sql').read_text())
    print('Restored public structure and candidates; Auth/HTTP remain local scaffolding')

if __name__ == '__main__':
    prepare()