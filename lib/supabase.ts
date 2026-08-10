import { createClient } from "@supabase/supabase-js";

// These are the client-safe public values. The publishable key is designed to
// be shipped in the browser; row-level security in the database is what keeps
// each user's data private.
export const SUPABASE_URL = "https://tjwfhaqlqanwzyyxuxdi.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_thiNwyvqdx0dn2CihH4n1A_7dfxLTS2";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
