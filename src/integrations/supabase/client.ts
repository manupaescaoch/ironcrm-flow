import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nidpykswipyxnqhwmgno.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pZHB5a3N3aXB5eG5xaHdtZ25vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNzY3ODMsImV4cCI6MjA4MDk1Mjc4M30._GiHgBTtT0MyMK20Auu7VeselyiTb2FE8rouyWeQi2o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
