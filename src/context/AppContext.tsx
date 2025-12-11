import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { Alert } from 'react-native';

export type RoleType = 'entrenador' | 'analista' | 'administrador' | 'invitado';

export interface AppContextType {
  equipoId: string | null;
  setEquipoId: (id: string | null) => void;
  equipoSeleccionado: string;
  setEquipoSeleccionado: (equipo: string) => void;
  categoriaSeleccionada: string[];
  setCategoriaSeleccionada: (categorias: string[]) => void;

  saveSelection: (payload: {
    equipoId?: string | null;
    equipoSeleccionado?: string;
    categoriaSeleccionada?: string[];
  }) => Promise<void>;
  loadSelection: () => Promise<void>;

  rolActual: RoleType;
  setRolActual: (rol: RoleType) => void;
  userRoles: RoleType[];
  initRoles: () => Promise<RoleType[]>;
  changeRole: (rol: RoleType) => Promise<boolean>;
  rolesLoaded: boolean;

  adminRouteName: string;
  setAdminRouteName: (r: string) => void;

  resetSeleccion: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SELECTION_STORAGE_KEY = '@futbol:seleccion';
const ROLE_STORAGE_KEY = '@futbol:rolActual'; // 🔹 nueva clave para rolActual

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [equipoId, setEquipoId] = useState<string | null>(null);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string[]>([]);

  const [rolActual, setRolActualState] = useState<RoleType>('invitado');
  const [userRoles, setUserRoles] = useState<RoleType[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState<boolean>(false);

  const [adminRouteName, setAdminRouteName] = useState<string>('PanelAdmin');

  // 🔹 Guardar rolActual en estado y AsyncStorage
  const setRolActual = async (rol: RoleType) => {
    console.log('[AppContext] setRolActual llamado con:', rol);
    setRolActualState(rol);
    try {
      await AsyncStorage.setItem(ROLE_STORAGE_KEY, rol);
    } catch (err) {
      console.warn('[AppContext] setRolActual save error', err);
    }
  };

  // 🔹 Cargar rolActual guardado
  const loadRolActual = async (): Promise<RoleType> => {
    try {
      const storedRol = await AsyncStorage.getItem(ROLE_STORAGE_KEY);
      if (storedRol) return storedRol as RoleType;
    } catch (err) {
      console.warn('[AppContext] loadRolActual error', err);
    }
    return 'invitado';
  };

  const resetSeleccion = async () => {
    setEquipoId(null);
    setEquipoSeleccionado('');
    setCategoriaSeleccionada([]);
    try {
      await AsyncStorage.removeItem(SELECTION_STORAGE_KEY);
      await AsyncStorage.removeItem(ROLE_STORAGE_KEY); // 🔹 también eliminar rol guardado
    } catch (err) {
      console.warn('[AppContext] resetSeleccion remove storage error', err);
    }
  };

  const saveSelection = async (payload: {
    equipoId?: string | null;
    equipoSeleccionado?: string;
    categoriaSeleccionada?: string[];
  }) => {
    try {
      const current = {
        equipoId: payload.equipoId ?? equipoId,
        equipoSeleccionado: payload.equipoSeleccionado ?? equipoSeleccionado,
        categoriaSeleccionada: payload.categoriaSeleccionada ?? categoriaSeleccionada,
      };
      await AsyncStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(current));
      setEquipoId(current.equipoId ?? null);
      setEquipoSeleccionado(current.equipoSeleccionado ?? '');
      setCategoriaSeleccionada(current.categoriaSeleccionada ?? []);
    } catch (e) {
      console.warn('[AppContext] saveSelection error:', e);
      throw e;
    }
  };

  const loadSelection = async () => {
    try {
      // Primero intentar cargar desde AsyncStorage (última selección guardada)
      const raw = await AsyncStorage.getItem(SELECTION_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // Validar que los valores no estén vacíos
          if (parsed.equipoSeleccionado && parsed.equipoSeleccionado.trim() !== '') {
            setEquipoId(parsed.equipoId ?? parsed.equipoSeleccionado);
            setEquipoSeleccionado(parsed.equipoSeleccionado);
            setCategoriaSeleccionada(Array.isArray(parsed.categoriaSeleccionada) ? parsed.categoriaSeleccionada : []);
            return; // Si ya hay selección guardada válida, usarla
          }
        } catch (parseError) {
          console.warn('[AppContext] Error parseando selección guardada:', parseError);
          // Continuar con auto-selección si el parse falla
        }
      }

      // Si no hay selección guardada válida, verificar si el usuario tiene un solo equipo/categoría
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('equipo_id, categoria_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (error || !usuario) return;

      // Normalizar equipo_id (puede ser array o string)
      const equiposUsuario: string[] = Array.isArray(usuario.equipo_id)
        ? usuario.equipo_id
        : usuario.equipo_id
        ? [String(usuario.equipo_id)]
        : [];

      // Normalizar categoria_id (puede ser array o string)
      const categoriasUsuario: string[] = Array.isArray(usuario.categoria_id)
        ? usuario.categoria_id
        : usuario.categoria_id
        ? [String(usuario.categoria_id)]
        : [];

      // Auto-seleccionar si solo hay un equipo
      if (equiposUsuario.length === 1 && equiposUsuario[0]) {
        const equipoIdAuto = String(equiposUsuario[0]).trim();
        if (equipoIdAuto && equipoIdAuto !== '') {
          setEquipoId(equipoIdAuto);
          setEquipoSeleccionado(equipoIdAuto);

          // Si solo hay una categoría, auto-seleccionarla también
          if (categoriasUsuario.length === 1 && categoriasUsuario[0]) {
            const categoriaIdAuto = String(categoriasUsuario[0]).trim();
            if (categoriaIdAuto && categoriaIdAuto !== '') {
              setCategoriaSeleccionada([categoriaIdAuto]);
              // Guardar la selección automática
              await saveSelection({
                equipoId: equipoIdAuto,
                equipoSeleccionado: equipoIdAuto,
                categoriaSeleccionada: [categoriaIdAuto],
              });
            } else {
              // Guardar solo el equipo
              await saveSelection({
                equipoId: equipoIdAuto,
                equipoSeleccionado: equipoIdAuto,
              });
            }
          } else {
            // Guardar solo el equipo
            await saveSelection({
              equipoId: equipoIdAuto,
              equipoSeleccionado: equipoIdAuto,
            });
          }
        }
      } else if (categoriasUsuario.length === 1 && categoriasUsuario[0] && equiposUsuario.length === 0) {
        // Si solo hay una categoría pero no equipos, solo seleccionar categoría
        const categoriaIdAuto = String(categoriasUsuario[0]).trim();
        if (categoriaIdAuto && categoriaIdAuto !== '') {
          setCategoriaSeleccionada([categoriaIdAuto]);
          await saveSelection({
            categoriaSeleccionada: [categoriaIdAuto],
          });
        }
      }
    } catch (e) {
      console.warn('[AppContext] loadSelection error:', e);
    }
  };

  const fetchUserRolesFromDB = async (): Promise<{ roles: RoleType[]; rolPrincipal: RoleType }> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.log('[AppContext] No hay usuario autenticado');
        return { roles: [], rolPrincipal: 'invitado' };
      }
      const userId = userData.user.id;

      console.log('[AppContext] Buscando usuario con ID:', userId);

      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('roles, rol_principal, nombre, correo')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AppContext] Error obteniendo usuario:', error);
        console.error('[AppContext] Detalles del error:', JSON.stringify(error, null, 2));
        return { roles: [], rolPrincipal: 'invitado' };
      }
      
      if (!usuario) {
        console.log('[AppContext] Usuario no encontrado en BD con ID:', userId);
        console.log('[AppContext] Intentando buscar por correo...');
        
        // Intentar buscar por correo como fallback
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.email) {
          const { data: usuarioPorCorreo, error: errorCorreo } = await supabase
            .from('usuarios')
            .select('roles, rol_principal, nombre, correo')
            .eq('correo', userData.user.email)
            .maybeSingle();
          
          if (!errorCorreo && usuarioPorCorreo) {
            console.log('[AppContext] Usuario encontrado por correo:', usuarioPorCorreo);
            // Continuar con usuarioPorCorreo
            const rolesFromDb: string[] = Array.isArray(usuarioPorCorreo.roles)
              ? usuarioPorCorreo.roles.map((r: any) => String(r).toLowerCase())
              : [];

            const mappedRoles: RoleType[] = rolesFromDb.reduce<RoleType[]>((acc, r) => {
              if (r.includes('entren')) acc.push('entrenador');
              else if (r.includes('anal')) acc.push('analista');
              else if (r.includes('admin')) acc.push('administrador');
              return acc;
            }, []);

            const rp = String(usuarioPorCorreo.rol_principal || '').toLowerCase();
            const rolPrincipal: RoleType =
              rp.includes('entren') ? 'entrenador' :
              rp.includes('anal') ? 'analista' :
              rp.includes('admin') ? 'administrador' :
              'invitado';

            const finalRoles = mappedRoles.includes(rolPrincipal)
              ? mappedRoles
              : [rolPrincipal, ...mappedRoles];

            return { roles: finalRoles, rolPrincipal };
          }
        }
        
        return { roles: [], rolPrincipal: 'invitado' };
      }

      console.log('[AppContext] Usuario desde BD:', { 
        roles: usuario.roles, 
        rol_principal: usuario.rol_principal 
      });

      const rolesFromDb: string[] = Array.isArray(usuario.roles)
        ? usuario.roles.map((r: any) => String(r).toLowerCase())
        : [];

      const mappedRoles: RoleType[] = rolesFromDb.reduce<RoleType[]>((acc, r) => {
        if (r.includes('entren')) acc.push('entrenador');
        else if (r.includes('anal')) acc.push('analista');
        else if (r.includes('admin')) acc.push('administrador');
        return acc;
      }, []);

      const rp = String(usuario.rol_principal || '').toLowerCase();
      const rolPrincipal: RoleType =
        rp.includes('entren') ? 'entrenador' :
        rp.includes('anal') ? 'analista' :
        rp.includes('admin') ? 'administrador' :
        'invitado';

      console.log('[AppContext] Rol principal determinado:', rolPrincipal);

      const finalRoles = mappedRoles.includes(rolPrincipal)
        ? mappedRoles
        : [rolPrincipal, ...mappedRoles];

      return { roles: finalRoles, rolPrincipal };
    } catch (err) {
      console.error('[AppContext] fetchUserRolesFromDB error:', err);
      return { roles: [], rolPrincipal: 'invitado' };
    }
  };

  const initRoles = async (): Promise<RoleType[]> => {
    setRolesLoaded(false);
    try {
      await loadSelection();

      const { roles, rolPrincipal } = await fetchUserRolesFromDB();
      setUserRoles(roles);

      // 🔹 Siempre usar el rol principal de la BD al iniciar la app
      // El rol guardado solo se usa cuando el usuario cambia de rol manualmente durante la sesión
      console.log('[AppContext] Usando rol principal desde BD:', rolPrincipal);
      await setRolActual(rolPrincipal);
      
      // Limpiar el rol guardado si no coincide con el rol principal
      // Esto evita que se use un rol incorrecto en futuras sesiones
      const rolGuardado = await loadRolActual();
      if (rolGuardado && rolGuardado !== rolPrincipal && !roles.includes(rolGuardado)) {
        console.log('[AppContext] Limpiando rol guardado inválido:', rolGuardado);
        await AsyncStorage.removeItem(ROLE_STORAGE_KEY);
      }

      setRolesLoaded(true);
      return roles;
    } catch (err) {
      console.error('[AppContext] initRoles error:', err);
      // En caso de error, intentar obtener el rol directamente de la BD
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: usuario } = await supabase
            .from('usuarios')
            .select('rol_principal')
            .eq('id', userData.user.id)
            .maybeSingle();
          
          if (usuario?.rol_principal) {
            const rp = String(usuario.rol_principal).toLowerCase();
            let rolPrincipal: RoleType = 'invitado';
            if (rp.includes('entren')) rolPrincipal = 'entrenador';
            else if (rp.includes('anal')) rolPrincipal = 'analista';
            else if (rp.includes('admin')) rolPrincipal = 'administrador';
            
            await setRolActual(rolPrincipal);
            setUserRoles([rolPrincipal]);
            setRolesLoaded(true);
            return [rolPrincipal];
          }
        }
      } catch (fallbackErr) {
        console.error('[AppContext] Fallback error:', fallbackErr);
      }
      
      setUserRoles([]);
      await setRolActual('invitado');
      setRolesLoaded(true);
      return [];
    }
  };

  const changeRole = async (rol: RoleType): Promise<boolean> => {
    try {
      let roles = userRoles;
      if (!roles || roles.length === 0) {
        const { roles: fetchedRoles } = await fetchUserRolesFromDB();
        roles = fetchedRoles;
        setUserRoles(roles);
      }

      if (!roles.includes(rol)) return false;

      await setRolActual(rol); // 🔹 persistir cambio de rol
      return true;
    } catch (err) {
      console.error('[AppContext] changeRole error:', err);
      return false;
    }
  };

  useEffect(() => {
    initRoles().catch((e) => console.warn('[AppContext] initRoles', e));
  }, []);

  return (
    <AppContext.Provider
      value={{
        equipoId,
        setEquipoId,
        equipoSeleccionado,
        setEquipoSeleccionado,
        categoriaSeleccionada,
        setCategoriaSeleccionada,
        saveSelection,
        loadSelection,
        rolActual,
        setRolActual,
        userRoles,
        initRoles,
        changeRole,
        rolesLoaded,
        adminRouteName,
        setAdminRouteName,
        resetSeleccion,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext debe usarse dentro de AppProvider');
  return context;
};
