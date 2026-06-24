import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hsoypayfbosdiqyicrqx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tqd7FQNGPmuhgdhAqsnKgw_8roeD_n-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
