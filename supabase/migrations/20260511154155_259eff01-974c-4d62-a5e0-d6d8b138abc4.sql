-- Desativar as atividades antigas (Turno 1 e Turno 2 separadas)
UPDATE cronograma_atividades
SET ativo = false, updated_at = now()
WHERE titulo IN (
  'ENVIO DA GRADE DE HORÁRIO COORDENADOR ZS TURNO 1',
  'ENVIO DA GRADE DE HORÁRIO COORDENADOR ZN TURNO 1',
  'ENVIO DA GRADE DE HORÁRIO COORDENADOR ZS TURNO 2',
  'ENVIO DA GRADE DE HORÁRIO COORDENADOR ZN TURNO 2'
);

DO $$
DECLARE
  v_zs uuid := 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a';
  v_zn uuid := 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6';
  v_danubia uuid := '11111111-0000-0000-0000-000000000003';
  v_natan uuid := '11111111-0000-0000-0000-000000000001';
  v_aylana uuid := '11111111-0000-0000-0000-000000000004';
  v_gaby uuid := '11111111-0000-0000-0000-000000000002';
  v_horarios time[] := ARRAY['05:40','06:40','07:40','08:40','09:40','10:40','11:40','12:40','13:40','14:40','15:40','16:40','17:40','18:40','19:40','20:40','21:40']::time[];
  v_dia int;
  v_h time;
  v_grade_hour int;
  v_grade_str text;
  v_resp_zs uuid;
  v_resp_zn uuid;
  v_nome_zs text;
  v_nome_zn text;
  v_coord_zs text;
  v_coord_zn text;
  v_titulo text := 'ENVIO DA GRADE DE HORÁRIO PARA COORDENADOR DE HORÁRIO';
  v_msg text;
BEGIN
  FOR v_dia IN 1..5 LOOP
    FOREACH v_h IN ARRAY v_horarios LOOP
      v_grade_hour := EXTRACT(HOUR FROM v_h)::int + 1;
      v_grade_str := lpad(v_grade_hour::text, 2, '0') || ':00';

      -- Responsável por turno (grade 06-14 = turno 1, grade 15-22 = turno 2)
      IF v_grade_hour <= 14 THEN
        v_resp_zs := v_danubia; v_nome_zs := 'Danúbia';
        v_resp_zn := v_natan;   v_nome_zn := 'Natan';
      ELSE
        v_resp_zs := v_aylana;  v_nome_zs := 'Aylana';
        v_resp_zn := v_gaby;    v_nome_zn := 'Gaby';
      END IF;

      -- Coordenador de horário por faixa
      IF v_grade_hour < 11 THEN
        v_coord_zs := 'Bruno'; v_coord_zn := 'Fábio';
      ELSIF v_grade_hour < 17 THEN
        v_coord_zs := 'Andrey'; v_coord_zn := 'Bia';
      ELSE
        v_coord_zs := 'Gabriel'; v_coord_zn := 'Lucas';
      END IF;

      -- ZS
      v_msg := E'📋 *Grade do próximo horário*\n\nFala, ' || v_nome_zs || E'.\n\nConfere agora a grade do horário das ' || v_grade_str || E' e alinha o time antes da entrada dos alunos.\n\n📍 *Unidade:* Zona Sul\n🕒 *Horário da grade:* ' || v_grade_str || E'\n🧭 *Coordenador de horário:* ' || v_coord_zs || E'\n\nSe tiver alguma pendência, resolve antes do início do horário.';
      INSERT INTO cronograma_atividades (unidade_id, titulo, horario, dia_semana, responsavel_id, mensagem, ativo)
      VALUES (v_zs, v_titulo, v_h, v_dia, v_resp_zs, v_msg, true);

      -- ZN
      v_msg := E'📋 *Grade do próximo horário*\n\nFala, ' || v_nome_zn || E'.\n\nConfere agora a grade do horário das ' || v_grade_str || E' e alinha o time antes da entrada dos alunos.\n\n📍 *Unidade:* Zona Norte\n🕒 *Horário da grade:* ' || v_grade_str || E'\n🧭 *Coordenador de horário:* ' || v_coord_zn || E'\n\nSe tiver alguma pendência, resolve antes do início do horário.';
      INSERT INTO cronograma_atividades (unidade_id, titulo, horario, dia_semana, responsavel_id, mensagem, ativo)
      VALUES (v_zn, v_titulo, v_h, v_dia, v_resp_zn, v_msg, true);
    END LOOP;
  END LOOP;
END $$;