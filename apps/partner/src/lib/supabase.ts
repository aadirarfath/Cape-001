import type { Database } from '@cape001/db';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';
import { secureStorage } from './secure-storage';

// The only Supabase client in the app. Anon key + the user's session; RLS and the database
// functions decide what each owner, manager or barber can see and do.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    storageKey: 'cape001-partner-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

/** Public URL of a file in the shop-photos bucket. */
export function shopPhotoUrl(storagePath: string): string {
  return supabase.storage.from('shop-photos').getPublicUrl(storagePath).data.publicUrl;
}
