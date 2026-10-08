import type { Enums } from '@cape001/db';
import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from './supabase';

// Who is logged in, which shops they belong to and which one they are working in. Drives the
// route guards in app/_layout.tsx:
//   no session            -> login
//   no name yet           -> your-name
//   no shop               -> create-shop
//   selected shop pending -> pending
//   otherwise             -> the app

export type ShopRole = Enums<'shop_role'>;

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
}

export interface MyShop {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  role: ShopRole;
  /** The user's own barbers row in this shop, if they are a linked barber. */
  barberId: string | null;
  lng: number;
  lat: number;
}

/** error: logged in, but the profile or shops could not be loaded (e.g. offline). */
type Status = 'loading' | 'signedOut' | 'signedIn' | 'error';

interface SessionState {
  status: Status;
  session: Session | null;
  profile: Profile | null;
  shops: MyShop[];
  /** The shop the app is showing. */
  shop: MyShop | null;
  /** True for owners and managers of the selected shop. */
  isManager: boolean;
  isOwner: boolean;
  /** Reload profile and shops (after creating a shop, approval, invites…). */
  refresh: () => Promise<void>;
  selectShop: (shopId: string) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

const SELECTED_SHOP_KEY = 'cape001-selected-shop';

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, phone').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function loadShops(): Promise<MyShop[]> {
  const { data: memberships, error } = await supabase.rpc('my_shops');
  if (error) throw error;
  if (!memberships?.length) return [];

  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select('id, name, slug, is_active')
    .in(
      'id',
      memberships.map((row) => row.shop_id),
    );
  if (shopsError) throw shopsError;

  return memberships.flatMap((row) => {
    const shop = shops.find((s) => s.id === row.shop_id);
    if (!shop) return [];
    return [
      {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        isActive: shop.is_active,
        role: row.role,
        barberId: row.barber_id,
        lng: row.lng,
        lat: row.lat,
      },
    ];
  });
}

interface SessionData {
  profile: Profile | null;
  shops: MyShop[];
  selectedId: string | null;
}

async function fetchSessionData(userId: string): Promise<SessionData> {
  // Link any barber invites for this phone first, so a newly invited barber goes straight
  // into their shop instead of "Create your shop". Failure here must not block login.
  const { error: claimError } = await supabase.rpc('claim_barber_invites');
  if (claimError) console.warn('claim_barber_invites failed', claimError.message);

  const [profile, shops, rememberedId] = await Promise.all([
    loadProfile(userId),
    loadShops(),
    SecureStore.getItemAsync(SELECTED_SHOP_KEY),
  ]);
  return { profile, shops, selectedId: pickShop(shops, rememberedId)?.id ?? null };
}

/** Prefer the remembered shop, then an active one, then any. */
function pickShop(shops: MyShop[], rememberedId: string | null): MyShop | null {
  return (
    shops.find((s) => s.id === rememberedId) ?? shops.find((s) => s.isActive) ?? shops[0] ?? null
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // undefined until the stored session has been read.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shops, setShops] = useState<MyShop[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which user the profile and shops above belong to, and whether loading them worked.
  const [loaded, setLoaded] = useState<{ userId: string; ok: boolean } | null>(null);

  const userId = session?.user.id ?? null;

  const apply = useCallback((uid: string, data: SessionData) => {
    setProfile(data.profile);
    setShops(data.shops);
    setSelectedId(data.selectedId);
    setLoaded({ userId: uid, ok: true });
  }, []);

  const fail = useCallback((uid: string, error: unknown) => {
    console.warn('Loading the session failed', error);
    // Keep showing good data if this was only a background refresh.
    setLoaded((current) => (current?.userId === uid && current.ok ? current : { userId: uid, ok: false }));
  }, []);

  // Follow the auth session. Database calls are kept out of the onAuthStateChange callback
  // (supabase-js holds a lock there); the effect below reacts to the user id instead.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setShops([]);
        setSelectedId(null);
        setLoaded(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchSessionData(userId).then(
      (data) => {
        if (!cancelled) apply(userId, data);
      },
      (error) => {
        if (!cancelled) fail(userId, error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId, apply, fail]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      apply(userId, await fetchSessionData(userId));
    } catch (error) {
      fail(userId, error);
      throw error;
    }
  }, [userId, apply, fail]);

  // Re-check when the app comes back to the foreground (e.g. the shop was approved meanwhile).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) {
        fetchSessionData(userId).then(
          (data) => apply(userId, data),
          (error) => console.warn('Refreshing the session failed', error),
        );
      }
    });
    return () => subscription.remove();
  }, [userId, apply]);

  const status: Status =
    session === undefined
      ? 'loading'
      : session === null
        ? 'signedOut'
        : loaded?.userId !== session.user.id
          ? 'loading'
          : loaded.ok
            ? 'signedIn'
            : 'error';

  const selectShop = useCallback((shopId: string) => {
    setSelectedId(shopId);
    SecureStore.setItemAsync(SELECTED_SHOP_KEY, shopId).catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    await supabase.removeAllChannels();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<SessionState>(() => {
    const shop = shops.find((s) => s.id === selectedId) ?? null;
    return {
      status,
      session: session ?? null,
      profile,
      shops,
      shop,
      isManager: shop?.role === 'owner' || shop?.role === 'manager',
      isOwner: shop?.role === 'owner',
      refresh,
      selectShop,
      signOut,
    };
  }, [status, session, profile, shops, selectedId, refresh, selectShop, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** The selected shop, for screens that are only reachable once a shop is selected. */
export function useShop(): MyShop {
  const { shop } = useSession();
  if (!shop) throw new Error('useShop used without a selected shop');
  return shop;
}
