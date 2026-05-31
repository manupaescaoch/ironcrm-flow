-- Allow the meeting creator to update their own meetings
CREATE POLICY update_reunioes_criador
ON public.reunioes
FOR UPDATE
TO authenticated
USING (criado_por = auth.uid())
WITH CHECK (criado_por = auth.uid());