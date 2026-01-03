-- Enable realtime for follow_ups table
ALTER TABLE follow_ups REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE follow_ups;