import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';

export function useUserInfo() {
  const [nombre, setNombre] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserInfo = useCallback(async () => {
    setLoading(true);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      setLoading(false);
      return;
    }
    const user = session.user;

    // Buscar por id
    let { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre, roles')
      .eq('id', user.id)
      .maybeSingle();

    // Si no encuentra, buscar por correo
    if (!usuario) {
      const r = await supabase
        .from('usuarios')
        .select('nombre, roles')
        .eq('correo', user.email)
        .maybeSingle();
      usuario = r.data;
    }

    if (usuario) {
      setNombre(usuario.nombre || '');
      // aseguramos que roles sea array
      if (Array.isArray(usuario.roles)) {
        setRoles(usuario.roles);
      } else if (typeof usuario.roles === 'string' && usuario.roles.length > 0) {
        setRoles(usuario.roles.split(',').map(r => r.trim()));
      } else {
        setRoles([]);
      }
    } else {
      setNombre('');
      setRoles([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUserInfo();

    // Escuchar cambios de sesión
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      fetchUserInfo();
    });
    return () => listener.subscription.unsubscribe();
  }, [fetchUserInfo]);

  return { nombre, roles, loading, refresh: fetchUserInfo };
}
