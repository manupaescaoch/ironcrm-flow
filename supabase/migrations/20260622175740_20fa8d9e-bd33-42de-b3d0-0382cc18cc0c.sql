
UPDATE public.cronograma_funcionarios SET cargo = 'recepcao'
WHERE cargo IS NULL AND lower(nome) ~ 'aylana rafaeli|dan[uú]bia medeiros|gaby mota|natan';

UPDATE public.cronograma_funcionarios SET cargo = 'coordenador_unidade'
WHERE cargo IS NULL AND lower(nome) ~ 'marcelo|gabi lima';

UPDATE public.cronograma_funcionarios SET cargo = 'treinador'
WHERE cargo IS NULL AND lower(nome) ~ 'andrey sales|bruno|gabriel peres|beatriz santana|f[áa]bio|lucas alves';

UPDATE public.cronograma_funcionarios SET cargo = 'estagiario_lider'
WHERE cargo IS NULL AND lower(nome) ~ 'everton pedro|felipe germano|alisson orlando|geaze nascimento|gabriel araujo|estela maria';
