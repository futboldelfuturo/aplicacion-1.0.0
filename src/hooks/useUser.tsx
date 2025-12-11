import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { User } from '@supabase/supabase-js';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
      setLoading(false);
    };
    getUser();

    // Escuchar cambios de sesión (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
