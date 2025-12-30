-- Padronizar responsavel_fechamento (fechadores)
UPDATE interacoes SET responsavel_fechamento = 'ANDREZA TEODORO' 
WHERE UPPER(TRIM(COALESCE(responsavel_fechamento, ''))) = 'ANDREZA';

UPDATE interacoes SET responsavel_fechamento = 'GABRIELA LIMA' 
WHERE UPPER(TRIM(COALESCE(responsavel_fechamento, ''))) = 'GABRIELA';

UPDATE interacoes SET responsavel_fechamento = 'NATANAEL DA SILVA' 
WHERE UPPER(TRIM(COALESCE(responsavel_fechamento, ''))) = 'NATANAEL';

UPDATE interacoes SET responsavel_fechamento = 'THAIS' 
WHERE UPPER(TRIM(COALESCE(responsavel_fechamento, ''))) LIKE 'THAÍS%';

-- Padronizar treinador_responsavel
UPDATE interacoes SET treinador_responsavel = 'GIOVANNA KELLY DA SILVA' 
WHERE UPPER(TRIM(COALESCE(treinador_responsavel, ''))) LIKE 'GIOVANNA%';

UPDATE interacoes SET treinador_responsavel = 'RYAN' 
WHERE UPPER(TRIM(COALESCE(treinador_responsavel, ''))) IN ('RIAN', 'RYAN');

UPDATE interacoes SET treinador_responsavel = 'LUAN MONTEIRO TEIXEIRA' 
WHERE UPPER(TRIM(COALESCE(treinador_responsavel, ''))) LIKE 'LUAN%';

UPDATE interacoes SET treinador_responsavel = 'GABRIEL ARAUJO' 
WHERE UPPER(TRIM(COALESCE(treinador_responsavel, ''))) LIKE 'GABRIEL ARAUJO%';