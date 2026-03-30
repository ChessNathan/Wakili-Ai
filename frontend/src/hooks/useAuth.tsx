import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Profile, Firm } from '../types';

interface Ctx {
  user: User | null;
  profile: Profile | null;
  firm: Firm | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, firmName: string) => Promise<void>;
  joinFirm: (email: string, password: string, fullName: string, firmCode: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [firm, setFirm]               = useState<Firm | null>(null);
  const [loading, setLoading]         = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Retry-enabled profile fetch — Supabase JWT may not be ready immediately after signIn
  async function loadProfile(uid: string, retries = 4): Promise<void> {
    setProfileError(null);
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 600 * attempt));

      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (pErr) {
        console.warn(`loadProfile attempt ${attempt + 1} error:`, pErr.message);
        if (attempt === retries) {
          setProfileError(`Could not load profile: ${pErr.message}`);
          return;
        }
        continue;
      }

      if (!p) {
        // Profile row doesn't exist yet (trigger may be delayed)
        if (attempt === retries) {
          setProfileError('Profile not found. Please sign out and sign in again.');
          return;
        }
        continue;
      }

      setProfile(p as Profile);

      if (p.firm_id) {
        const { data: f, error: fErr } = await supabase
          .from('firms')
          .select('*')
          .eq('id', p.firm_id)
          .maybeSingle();

        if (fErr) {
          console.warn('loadFirm error:', fErr.message);
        } else {
          setFirm(f as Firm | null);
        }
      } else {
        setFirm(null);
      }

      return; // success
    }
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = { id: session.user.id, email: session.user.email! };
        setUser(u);
        loadProfile(u.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const u = { id: session.user.id, email: session.user.email! };
        setUser(u);
        // On SIGNED_IN (fresh login), give Supabase a moment to propagate then load
        const delay = event === 'SIGNED_IN' ? 500 : 0;
        setTimeout(() => loadProfile(u.id), delay);
      } else {
        setUser(null); setProfile(null); setFirm(null); setProfileError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (data.user) {
      const u = { id: data.user.id, email: data.user.email! };
      setUser(u);
      await loadProfile(u.id);
    }
  }

  async function signUp(email: string, password: string, fullName: string, firmName: string) {
    const { data: auth, error: signUpErr } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });
    if (signUpErr) throw new Error(signUpErr.message);
    if (!auth.user) throw new Error('Signup failed. Please try again.');

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error('Account created — please sign in.');

    const uid = auth.user.id;
    // Wait for DB trigger to create the profile row
    await new Promise(r => setTimeout(r, 2000));

    const initials = fullName.trim().split(' ').map((n: string) => n[0] || '').join('').toUpperCase().slice(0, 2);
    await supabase.from('profiles').upsert(
      { id: uid, full_name: fullName, initials, role: 'senior_partner' },
      { onConflict: 'id' }
    );

    if (firmName.trim()) {
      const inviteCode = 'FIRM-' +
        Math.random().toString(36).slice(2, 6).toUpperCase() + '-' +
        Math.random().toString(36).slice(2, 6).toUpperCase();

      const { data: newFirm } = await supabase
        .from('firms')
        .insert({ name: firmName.trim(), plan: 'pro', invite_code: inviteCode })
        .select().single();

      if (newFirm) {
        await supabase.from('profiles')
          .update({ firm_id: (newFirm as any).id, role: 'senior_partner' })
          .eq('id', uid);
        setFirm(newFirm as Firm);
      }
    }

    setUser({ id: uid, email: auth.user.email! });
    await loadProfile(uid);
  }

  async function joinFirm(
    email: string, password: string, fullName: string, firmCode: string, role: string
  ) {
    const cleanCode = firmCode.trim().toUpperCase();
    const { data: firms, error: firmErr } = await supabase
      .from('firms').select('*').eq('invite_code', cleanCode).limit(1);

    if (firmErr || !firms || firms.length === 0) {
      throw new Error('Invalid invite code. Please check with your senior partner.');
    }
    const targetFirm = firms[0];

    const { data: auth, error: signUpErr } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });
    if (signUpErr) throw new Error(signUpErr.message);
    if (!auth.user) throw new Error('Registration failed. Please try again.');

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error('Account created — please sign in manually.');

    const uid = auth.user.id;
    await new Promise(r => setTimeout(r, 2000));

    const initials = fullName.trim().split(' ').map((n: string) => n[0] || '').join('').toUpperCase().slice(0, 2);
    await supabase.from('profiles').upsert(
      { id: uid, full_name: fullName, initials, firm_id: targetFirm.id, role },
      { onConflict: 'id' }
    );

    setUser({ id: uid, email: auth.user.email! });
    setFirm(targetFirm as Firm);
    await loadProfile(uid);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setFirm(null); setProfileError(null);
  }

  return (
    <AuthCtx.Provider value={{ user, profile, firm, loading, profileError, signIn, signUp, joinFirm, signOut, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
