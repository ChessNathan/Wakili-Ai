import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000;       // warn 2 min before

interface Options {
  onWarning?: (secondsLeft: number) => void;
  onExpired?: () => void;
}

export function useSessionGuard({ onWarning, onExpired }: Options = {}) {
  const navigate = useNavigate();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleExpiry = useCallback(async () => {
    await supabase.auth.signOut();
    onExpired?.();
    navigate('/login?reason=session_expired');
  }, [navigate, onExpired]);

  const resetTimers = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current)    clearTimeout(warningTimer.current);

    warningTimer.current = setTimeout(() => {
      onWarning?.(Math.round(WARNING_BEFORE_MS / 1000));
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    inactivityTimer.current = setTimeout(handleExpiry, INACTIVITY_TIMEOUT_MS);
  }, [handleExpiry, onWarning]);

  useEffect(() => {
    // Activity events that reset the inactivity timer
    const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimers, { passive: true }));
    resetTimers();

    // Re-validate session when tab becomes visible again
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) handleExpiry();
        else resetTimers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Listen for Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_OUT') handleExpiry();
        else resetTimers();
      }
    });

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimers));
      document.removeEventListener('visibilitychange', handleVisibility);
      subscription.unsubscribe();
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current)    clearTimeout(warningTimer.current);
    };
  }, [resetTimers, handleExpiry]);
}
