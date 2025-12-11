import React, { useEffect } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../utils/supabase';

export default function AuthRedirector() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { initRoles, rolActual, rolesLoaded } = useAppContext();

  useEffect(() => {
    const init = async () => {
      try {
        // Si en Web guardas sesión manualmente, puedes restaurarla aquí si lo necesitas
        if (Platform.OS === 'web') {
          // Hook para futuras restauraciones si hiciera falta
        }

        // Obtener el rol principal directamente de la BD para asegurar que sea correcto
        const { data: userData } = await supabase.auth.getUser();
        console.log('[AuthRedirector] Usuario autenticado:', userData?.user?.id);
        console.log('[AuthRedirector] Email del usuario:', userData?.user?.email);
        
        if (!userData?.user) {
          console.warn('[AuthRedirector] No hay usuario autenticado');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' as keyof RootStackParamList }],
          });
          return;
        }

        // Inicializamos roles del usuario (después de obtener userData)
        console.log('[AuthRedirector] Inicializando roles...');
        const roles = await initRoles();
        console.log('[AuthRedirector] Roles inicializados:', roles);
        console.log('[AuthRedirector] Rol actual del contexto:', rolActual);
        
        // Esperar un momento para que el estado se actualice
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Obtener el rol directamente de la BD
        const { data: usuario, error: usuarioError } = await supabase
          .from('usuarios')
          .select('rol_principal, nombre, correo, id')
          .eq('id', userData.user.id)
          .maybeSingle();

        console.log('[AuthRedirector] Usuario desde BD:', usuario);
        console.log('[AuthRedirector] Error al obtener usuario:', usuarioError);

        if (usuarioError) {
          console.error('[AuthRedirector] Error obteniendo usuario:', usuarioError);
        }

        let rolPrincipal: 'entrenador' | 'analista' | 'administrador' | 'invitado' = 'invitado';

        if (usuario?.rol_principal) {
          const rp = String(usuario.rol_principal).toLowerCase();
          console.log('[AuthRedirector] Rol principal desde BD (raw):', usuario.rol_principal);
          console.log('[AuthRedirector] Rol principal (lowercase):', rp);
          
          if (rp.includes('entren')) {
            rolPrincipal = 'entrenador';
          } else if (rp.includes('anal')) {
            rolPrincipal = 'analista';
          } else if (rp.includes('admin')) {
            rolPrincipal = 'administrador';
          }

          console.log('[AuthRedirector] Rol principal determinado desde BD:', rolPrincipal);
        } else {
          console.warn('[AuthRedirector] Usuario no tiene rol_principal definido, usando rolActual del contexto:', rolActual);
          rolPrincipal = rolActual;
        }

        // Redirigir según el rol principal
        console.log('[AuthRedirector] Redirigiendo con rol:', rolPrincipal);
        switch (rolPrincipal) {
          case 'administrador':
            console.log('[AuthRedirector] Redirigiendo a PanelAdmin');
            navigation.reset({
              index: 0,
              routes: [{ name: 'PanelAdmin' as keyof RootStackParamList }],
            });
            return;

          case 'entrenador':
          case 'analista':
            console.log('[AuthRedirector] Redirigiendo a SeleccionEquipoCategoria');
            // Para entrenador/analista, siempre ir a selección de equipo/categoría primero
            // El componente SeleccionEquipoCategoria manejará la auto-selección si aplica
            navigation.reset({
              index: 0,
              routes: [{ name: 'SeleccionEquipoCategoria' as keyof RootStackParamList }],
            });
            return;

          default:
            console.log('[AuthRedirector] Redirigiendo a PanelPrincipal (invitado)');
            // Invitado u otros roles → panel principal
            navigation.reset({
              index: 0,
              routes: [{ name: 'PanelPrincipal' as keyof RootStackParamList }],
            });
            return;
        }
      } catch (err) {
        console.warn('[AuthRedirector] init error:', err);
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' as keyof RootStackParamList }],
        });
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
