import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nzbiinvwweopegmajfsm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wrNFyVSYeFjfCl7NidwH-g_KRzWjJLe';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);