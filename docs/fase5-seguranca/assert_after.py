import os, subprocess, sys
S = sys.argv[1]
ENV = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
MOD = "22222222-0000-0000-0000-000000000002"; ADM = "11111111-0000-0000-0000-000000000001"
OTHER = "bbbbbbbb-0000-0000-0000-00000000000b"; OWN = "aaaaaaaa-0000-0000-0000-0000000000a1"
ok = fail = 0

def run(role, sub, sql, jwtrole=None):
    pre = "BEGIN;"
    if role: pre += f"SET LOCAL ROLE {role};"
    if sub: pre += f"SELECT set_config('request.jwt.claim.sub','{sub}',true);"
    if jwtrole: pre += f"SELECT set_config('request.jwt.claim.role','{jwtrole}',true);"
    r = subprocess.run(["psql", "-h", S, "-p", "55451", "-U", "lovable", "-d", "postgres", "-X", "-At",
                        "-v", "ON_ERROR_STOP=1", "-c", pre + sql + ";ROLLBACK;"], env=ENV, capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + r.stderr).strip()

def check(name, expect_ok, role, sub, sql, jwtrole=None):
    global ok, fail
    good, out = run(role, sub, sql, jwtrole)
    passed = good == expect_ok
    ok += passed; fail += not passed
    print(("PASS" if passed else "FAIL"), name, "" if passed else out[-160:])

# 1 segredo
check("anon nao le segredo", False, "anon", None, "SELECT get_cron_secret()")
check("logado nao le segredo", False, "authenticated", MOD, "SELECT get_cron_secret()")
check("service_role le segredo", True, "service_role", None, "SELECT get_cron_secret()")
check("cron/postgres le segredo", True, None, None, "SELECT get_cron_secret()")
check("funcao interna definer le segredo", True, "authenticated", MOD, "SELECT interno_le_segredo()")
# 2 admin
for f in ["admin_cleanup_duplicate_leads(ARRAY[]::uuid[])", "admin_standardize_origem('A','B')",
          "admin_standardize_treinador('A','B')", "admin_update_cadastrador('A','B')"]:
    n = f.split("(")[0]
    check(f"{n}: anon bloqueado", False, "anon", None, "SELECT " + f)
    check(f"{n}: moderator bloqueado", False, "authenticated", MOD, "SELECT " + f)
    check(f"{n}: admin funciona", True, "authenticated", ADM, "SELECT " + f)
    check(f"{n}: service_role funciona", True, "service_role", None, "SELECT " + f, "service_role")
# 3 task_history
check("forjar autoria bloqueado", False, "authenticated", MOD,
      f"INSERT INTO task_history(task_id,user_id) VALUES('{OWN}','{ADM}')")
check("outra unidade bloqueado", False, "authenticated", MOD,
      f"INSERT INTO task_history(task_id,user_id) VALUES('{OTHER}','{MOD}')")
check("anon bloqueado", False, "anon", None, f"INSERT INTO task_history(task_id,user_id) VALUES('{OWN}',NULL)")
check("propria unidade/autoria permitido", True, "authenticated", MOD,
      f"INSERT INTO task_history(task_id,user_id) VALUES('{OWN}','{MOD}')")
check("admin outra unidade permitido", True, "authenticated", ADM,
      f"INSERT INTO task_history(task_id,user_id) VALUES('{OTHER}','{ADM}')")
check("trigger interno grava", True, "authenticated", MOD,
      f"UPDATE tasks SET titulo='z' WHERE id='{OWN}'; RESET ROLE; SELECT 1/count(*) FROM task_history WHERE task_id='{OWN}'")
check("service_role grava (automacoes)", True, "service_role", None,
      f"INSERT INTO task_history(task_id,user_id) VALUES('{OTHER}',NULL)")
# 4 telefones/reservas
for f in ["get_user_phone_by_name('X')", "claim_whatsapp_envio('k','f',NULL,NULL,1)", "release_whatsapp_envio('k')",
          "generate_follow_ups_for_lead('dddddddd-0000-0000-0000-00000000000d')"]:
    n = f.split("(")[0]
    check(f"{n}: logado bloqueado", False, "authenticated", MOD, "SELECT " + f)
    check(f"{n}: service_role funciona", True, "service_role", None, "SELECT " + f)
print(f"\n{ok} aprovados, {fail} falhas")
sys.exit(1 if fail else 0)
