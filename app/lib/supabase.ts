import { isLocalActivityImport } from './activity/development'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://astdepkrdkmufsydxviz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdGRlcGtyZGttdWZzeWR4dml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQ3OTQsImV4cCI6MjA4OTE0MDc5NH0.ABj5i-43WWfc6dfk5cuRbkt6-7yVHsXNdEbyHbzPU5s'

const developmentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const developmentKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const useConfiguredActivityProject = developmentUrl && developmentKey &&
  (isLocalActivityImport(developmentUrl) ||
    (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED === 'true'))

export const supabase = useConfiguredActivityProject
  ? createClient(developmentUrl, developmentKey)
  : createClient(supabaseUrl, supabaseKey)
