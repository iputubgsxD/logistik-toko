import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://okdaqvgpyfclmhjodkoc.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_aQ0uAu3cdMV1RVVWUxXYdg_1Jf9Mylq'

export const supabase = createClient(supabaseUrl, supabaseKey)