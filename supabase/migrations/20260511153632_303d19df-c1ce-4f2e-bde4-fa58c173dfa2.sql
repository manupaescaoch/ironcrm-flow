DO $$
DECLARE
  v_zs uuid := 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a';
  v_zn uuid := 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6';
  v_aylana uuid := '11111111-0000-0000-0000-000000000004';
  v_gaby uuid := '11111111-0000-0000-0000-000000000002';
  v_horarios time[] := ARRAY['14:40','15:40','16:40','17:40','18:40','19:40','20:40','21:40']::time[];
  v_dia int;
  v_h time;
  v_msg_zs text := E'📋 *Grade do próximo horário*\n\nFala, Aylana.\n\nConfere agora a grade do próximo horário e alinha o time antes da entrada dos alunos.\n\n📍 *Unidade:* Zona Sul\n🕒 *Horário:* {horario}\n\nSe tiver alguma pendência, resolve antes do início do horário.';
  v_msg_zn text := E'📋 *Grade do próximo horário*\n\nFala, Gaby.\n\nConfere agora a grade do próximo horário e alinha o time antes da entrada dos alunos.\n\n📍 *Unidade:* Zona Norte\n🕒 *Horário:* {horario}\n\nSe tiver alguma pendência, resolve antes do início do horário.';
BEGIN
  FOR v_dia IN 1..5 LOOP
    FOREACH v_h IN ARRAY v_horarios LOOP
      INSERT INTO cronograma_atividades (unidade_id, titulo, horario, dia_semana, responsavel_id, mensagem, ativo)
      VALUES (v_zs, 'ENVIO DA GRADE DE HORÁRIO COORDENADOR ZS TURNO 2', v_h, v_dia, v_aylana,
        REPLACE(v_msg_zs, '{horario}', to_char(v_h, 'HH24:MI')), true);
      INSERT INTO cronograma_atividades (unidade_id, titulo, horario, dia_semana, responsavel_id, mensagem, ativo)
      VALUES (v_zn, 'ENVIO DA GRADE DE HORÁRIO COORDENADOR ZN TURNO 2', v_h, v_dia, v_gaby,
        REPLACE(v_msg_zn, '{horario}', to_char(v_h, 'HH24:MI')), true);
    END LOOP;
  END LOOP;
END $$;