import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';

export function useWalkthroughStatus() {
  const user = useAuthStore((s) => s.user);
  const [walkthroughCompleted, setWalkthroughCompleted] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('walkthrough_completed, role')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          // Fallback: show walkthrough on error
          setWalkthroughCompleted(false);
          setRole('specialist');
        } else {
          setWalkthroughCompleted(data?.walkthrough_completed ?? false);
          setRole(data?.role ?? 'specialist');
        }
        setLoading(false);
      });
  }, [user]);

  const completeWalkthrough = useCallback(async () => {
    if (!user) return;
    setWalkthroughCompleted(true); // Optimistic
    await supabase
      .from('profiles')
      .update({ walkthrough_completed: true })
      .eq('id', user.id);
  }, [user]);

  const resetWalkthrough = useCallback(async () => {
    if (!user) return;
    setWalkthroughCompleted(false); // Optimistic
    await supabase
      .from('profiles')
      .update({ walkthrough_completed: false })
      .eq('id', user.id);
  }, [user]);

  return { walkthroughCompleted, role, loading, completeWalkthrough, resetWalkthrough };
}
