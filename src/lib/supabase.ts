import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const DEMO = import.meta.env.VITE_DEMO === 'true';

/** null quand les variables ne sont pas définies → l'app tourne en mode local (navigateur) */
export const supabase: SupabaseClient | null =
  !DEMO && url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
