import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://astdepkrdkmufsydxviz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdGRlcGtyZGttdWZzeWR4dml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQ3OTQsImV4cCI6MjA4OTE0MDc5NH0.ABj5i-43WWfc6dfk5cuRbkt6-7yVHsXNdEbyHbzPU5s'

export const supabase = createClient(supabaseUrl, supabaseKey)