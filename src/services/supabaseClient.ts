import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigurationError = !supabaseUrl || !supabasePublishableKey
  ? 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then rebuild the application.'
  : '';

export const supabase: SupabaseClient | null = supabaseConfigurationError
  ? null
  : createClient(supabaseUrl!, supabasePublishableKey!, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
