
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ygbxdlwmtquuqghyvpvu.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_DkK0qIowYyPdd86lR7Rpww_7zTVVbgx";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);
