import { createClient } from '@supabase/supabase-js';

// Project credentials provided by user
const SUPABASE_URL = 'https://gtsoyntvmjowzfeytjmr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c295bnR2bWpvd3pmZXl0am1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODQ4OTIsImV4cCI6MjA4MTE2MDg5Mn0.jfdiDqFIHl02m0w4OPLAaS_XaZ5wKEjwO5WpAdlNxAw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
