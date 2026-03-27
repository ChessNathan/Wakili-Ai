import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Profile, Firm } from '../types';

interface Ctx {
  user: User | null; profile: Profile | null; firm: Firm | null; loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, firmName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firm, setFirm]       = useState<Firm | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    try {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', uid).single();
      setProfile(p);
      if (p?.firm_id) {
        const { data: f } = await supabase.from('firms').select('*').eq('id', p.firm_id).single();
        setFirm(f);
      }
    } catch (_) {}
  }

  async function refreshProfile() { if (user) await loadProfile(user.id); }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! });
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) { setUser({ id: session.user.id, email: session.user.email! }); loadProfile(session.user.id); }
      else { setUser(null); setProfile(null); setFirm(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (data.user) { setUser({ id: data.user.id, email: data.user.email! }); await loadProfile(data.user.id); }
  }

  async function signUp(email: string, password: string, fullName: string, firmName: string) {
    // Step 1: Create auth user
    const { data: auth, error: signUpErr } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });
    if (signUpErr) throw new Error(signUpErr.message);
    if (!auth.user) throw new Error('Signup failed. Please try again.');

    // Step 2: Sign in immediately
    const { data: sess, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error('Account created — please sign in.');

    const uid = auth.user.id;

    // Step 3: Wait for DB trigger, then upsert profile
    await new Promise(r => setTimeout(r, 1500));
    const initials = fullName.trim().split(' ').map((n: string) => n[0] || '').join('').toUpperCase().slice(0, 2);
    await supabase.from('profiles').upsert({ id: uid, full_name: fullName, initials, role: 'senior_partner' }, { onConflict: 'id' });

    // Step 4: Create firm
    if (firmName.trim()) {
      const { data: firm } = await supabase.from('firms').insert({ name: firmName.trim(), plan: 'pro' }).select().single();
      if (firm) {
        await supabase.from('profiles').update({ firm_id: (firm as any).id, role: 'senior_partner' }).eq('id', uid);
        setFirm(firm as any);
      }
    }

    setUser({ id: uid, email: auth.user.email! });
    await loadProfile(uid);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setFirm(null);
  }

  return <AuthCtx.Provider value={{ user, profile, firm, loading, signIn, signUp, signOut, refreshProfile }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
