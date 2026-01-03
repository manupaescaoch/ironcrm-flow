-- Enable realtime for interacoes table
ALTER TABLE interacoes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE interacoes;

-- Enable realtime for leads table
ALTER TABLE leads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;