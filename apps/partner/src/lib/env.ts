// Public configuration only. The anon key is safe in the app: access is enforced by RLS.
// Never add the service_role key to this app.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy apps/partner/.env.example to apps/partner/.env.`);
  }
  return value;
}

// Referenced literally so Expo inlines them into the bundle.
export const SUPABASE_URL = required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL).replace(/\/$/, '');
export const SUPABASE_ANON_KEY = required(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
