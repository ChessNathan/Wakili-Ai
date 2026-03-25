import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Profile, Firm } from '../types';

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  firm: Firm | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, firmName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firm, setFirm]       = useState<Firm | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    try {
      const { data: prof, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      setProfile(prof);
      if (prof?.firm_id) {
        const { data: f } = await supabase
          .from('firms').select('*').eq('id', prof.firm_id).single();
        if (f) setFirm(f);
      }
    } catch (_) {
      // Profile might not exist yet - ok
    }
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! });
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! });
        loadProfile(session.user.id);
      } else {
        setUser(null); setProfile(null); setFirm(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (data.user) {
      setUser({ id: data.user.id, email: data.user.email! });
      await loadProfile(data.user.id);
    }
  }

  async function signUp(email: string, password: string, fullName: string, firmName: string) {
    // Step 1: Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) throw new Error(signUpError.message);
    if (!authData.user) throw new Error('Signup failed. Please try again.');

    // Step 2: Sign in to get session
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email, password,
    });

    if (signInError) throw new Error('Account created! Please sign in.');
    if (!sessionData.session) throw new Error('Could not create session. Please sign in.');

    const uid = authData.user.id;

    // Step 3: Wait for trigger to create profile (up to 3s)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 4: Update profile with full name and initials
    const initials = fullName.split(' ')
      .map((n: string) => n[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 2);

    await supabase.from('profiles').upsert({
      id: uid,
      full_name: fullName,
      initials,
      role: 'senior_partner',
    }, { onConflict: 'id' });

    // Step 5: Create firm if provided
    if (firmName.trim()) {
      const { data: firm, error: firmError } = await supabase
        .from('firms')
        .insert({ name: firmName.trim(), plan: 'pro' })
        .select()
        .single();

      if (!firmError && firm) {
        await supabase.from('profiles')
          .update({ firm_id: (firm as any).id, role: 'senior_partner' })
          .eq('id', uid);
        setFirm(firm as any);
      }
    }

    // Step 6: Load final profile
    setUser({ id: uid, email: authData.user.email! });
    await loadProfile(uid);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setFirm(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, firm, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
