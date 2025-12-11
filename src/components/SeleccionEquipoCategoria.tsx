import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Alert, ActivityIndicator, StyleSheet, Animated, TouchableOpacity, Image, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppContext } from '../context/AppContext';
import MultiSelectDropdown from './MultiSelectDropdown';
import { supabase } from '../utils/supabase';
import { navigationRef } from '../navigation/RouteNavigation';
import HeaderLogo from './HeaderLogo';

const SeleccionEquipoCategoria = () => {
  const context = useAppContext();
  const {
    equipoSeleccionado,
    setEquipoSeleccionado,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
    setEquipoId,
    loadSelection,
    saveSelection,
    initRoles,
  } = context;

  // Verificar que saveSelection existe antes de usarlo
  if (!saveSelection) {
    console.error('[SeleccionEquipoCategoria] saveSelection no está disponible en el contexto');
  }

  const [equipos, setEquipos] = useState<{ label: string; value: string; icon?: string }[]>([]);
  const [categorias, setCategorias] = useState<{ label: string; value: string }[]>([]);
  const [loadingEquipos, setLoadingEquipos] = useState(false);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [checkingAutoSelection, setCheckingAutoSelection] = useState(true);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
  };

  // Verificar si ya hay selección automática y redirigir si es necesario
  useEffect(() => {
    const checkAutoSelection = async () => {
      setCheckingAutoSelection(true);
      try {
        // Cargar selección (esto puede hacer auto-selección si el usuario tiene un solo equipo)
        await loadSelection();
        
        // Esperar un momento para que el estado se actualice
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verificar directamente desde AsyncStorage si hay selección guardada
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: usuario } = await supabase
            .from('usuarios')
            .select('equipo_id, categoria_id')
            .eq('id', userData.user.id)
            .maybeSingle();

          if (usuario) {
            const equiposUsuario: string[] = Array.isArray(usuario.equipo_id)
              ? usuario.equipo_id.filter((id): id is string => id !== null && id !== undefined && id !== '')
              : usuario.equipo_id
              ? [String(usuario.equipo_id)]
              : [];

            const categoriasUsuario: string[] = Array.isArray(usuario.categoria_id)
              ? usuario.categoria_id.filter((id): id is string => id !== null && id !== undefined && id !== '')
              : usuario.categoria_id
              ? [String(usuario.categoria_id)]
              : [];

            // Si solo tiene un equipo y una categoría, y ya están seleccionados, redirigir
            if (equiposUsuario.length === 1 && categoriasUsuario.length === 1) {
              const equipoIdAuto = equiposUsuario[0];
              const categoriaIdAuto = categoriasUsuario[0];
              
              // Verificar si ya están en el estado o en AsyncStorage
              const raw = await AsyncStorage.getItem('@futbol:seleccion');
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.equipoSeleccionado === equipoIdAuto && 
                    parsed.categoriaSeleccionada?.includes(categoriaIdAuto)) {
                  setEquipoId(equipoIdAuto);
                  if (navigationRef.isReady()) {
                    navigationRef.reset({
                      index: 0,
                      routes: [{ name: 'PanelPrincipal' }],
                    });
                    return;
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('[SeleccionEquipoCategoria] Error en checkAutoSelection:', error);
      } finally {
        setCheckingAutoSelection(false);
      }
    };
    
    checkAutoSelection();
  }, []);

  useEffect(() => {
    const fetchEquipos = async () => {
      try {
        setLoadingEquipos(true);
        
        // Obtener equipos asignados al usuario
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          setEquipos([]);
          return;
        }

        const { data: usuario, error: usuarioError } = await supabase
          .from('usuarios')
          .select('equipo_id')
          .eq('id', userData.user.id)
          .maybeSingle();

        if (usuarioError || !usuario) {
          setEquipos([]);
          return;
        }

        // Normalizar equipo_id (puede ser array o string)
        const equiposUsuario: string[] = Array.isArray(usuario.equipo_id)
          ? usuario.equipo_id.filter((id): id is string => id !== null && id !== undefined && id !== '')
          : usuario.equipo_id
          ? [String(usuario.equipo_id)]
          : [];

        if (equiposUsuario.length === 0) {
          setEquipos([]);
          Alert.alert('Sin equipos asignados', 'No tienes equipos asignados. Contacta al administrador.');
          return;
        }

        // Cargar solo los equipos asignados
        const { data, error } = await supabase
          .from('teams')
          .select('id, nombre, escudo_url')
          .in('id', equiposUsuario);
        
        if (error) throw error;
        
        const equiposList = (data || []).map((e: any) => ({
          label: e.nombre,
          value: e.id,
          icon: e.escudo_url || undefined,
        }));
        
        setEquipos(equiposList);
        
        // Si hay un equipo seleccionado, asegurarse de que esté en la lista
        // Si no está en la lista pero hay equipos disponibles, seleccionar el primero
        if (equiposList.length > 0) {
          if (equipoSeleccionado) {
            const equipoExiste = equiposList.some(e => e.value === equipoSeleccionado);
            if (!equipoExiste) {
              // El equipo seleccionado no está en la lista asignada, seleccionar el primero disponible
              setEquipoSeleccionado(equiposList[0].value);
              setEquipoId(equiposList[0].value);
            }
          } else if (equiposList.length === 1) {
            // Si solo hay un equipo y no hay selección, auto-seleccionarlo
            setEquipoSeleccionado(equiposList[0].value);
            setEquipoId(equiposList[0].value);
          }
        }
      } catch (err: any) {
        console.error('Error cargando equipos:', err);
        Alert.alert('Error', 'No se pudieron cargar los equipos.');
      } finally {
        setLoadingEquipos(false);
      }
    };
    fetchEquipos();
  }, [equipoSeleccionado, setEquipoId]);

  useEffect(() => {
    const fetchCategorias = async () => {
      // Validar que equipoSeleccionado no esté vacío
      if (!equipoSeleccionado || equipoSeleccionado.trim() === '') {
        setCategorias([]);
        return;
      }
      
      try {
        setLoadingCategorias(true);
        
        // Obtener categorías asignadas al usuario
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          setCategorias([]);
          return;
        }

        const { data: usuario, error: usuarioError } = await supabase
          .from('usuarios')
          .select('categoria_id')
          .eq('id', userData.user.id)
          .maybeSingle();

        if (usuarioError || !usuario) {
          setCategorias([]);
          return;
        }

        // Normalizar categoria_id (puede ser array o string)
        const categoriasUsuario: string[] = Array.isArray(usuario.categoria_id)
          ? usuario.categoria_id.filter((id): id is string => id !== null && id !== undefined && id !== '')
          : usuario.categoria_id
          ? [String(usuario.categoria_id)]
          : [];

        if (categoriasUsuario.length === 0) {
          setCategorias([]);
          return;
        }

        // Cargar solo las categorías asignadas al usuario que pertenecen al equipo seleccionado
        const { data, error } = await supabase
          .from('categorias')
          .select('id, nombre')
          .eq('equipo_id', equipoSeleccionado.trim())
          .in('id', categoriasUsuario);
        
        if (error) {
          console.error('Error cargando categorías:', error);
          throw error;
        }
        
        setCategorias((data || []).map((c: any) => ({ label: c.nombre, value: c.id })));
      } catch (err: any) {
        console.error('Error en fetchCategorias:', err);
        if (err?.message?.includes('uuid')) {
          // Error de UUID - limpiar selección
          setEquipoSeleccionado('');
          setCategorias([]);
        } else {
          Alert.alert('Error', 'No se pudieron cargar las categorías.');
        }
      } finally {
        setLoadingCategorias(false);
      }
    };
    fetchCategorias();
  }, [equipoSeleccionado]);

  const handleContinuar = async () => {
    if (!equipoSeleccionado || equipoSeleccionado.trim() === '') {
      Alert.alert('Selecciona un equipo', 'Debes seleccionar un equipo para continuar.');
      return;
    }
    if (categoriaSeleccionada.length === 0) {
      Alert.alert('Selecciona categorías', 'Debes seleccionar al menos una categoría.');
      return;
    }

    // Guardar la selección antes de navegar
    try {
      setEquipoId(equipoSeleccionado);
      if (saveSelection) {
        try {
          await saveSelection({
            equipoId: equipoSeleccionado,
            equipoSeleccionado: equipoSeleccionado,
            categoriaSeleccionada: categoriaSeleccionada,
          });
        } catch (error) {
          console.error('Error guardando selección:', error);
        }
      }

      // Asegurar que el rol se mantenga correctamente
      // Recargar roles para asegurar que el rol principal esté activo
      if (initRoles) {
        await initRoles();
      }

      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'PanelPrincipal' }],
        });
      }
    } catch (error) {
      console.error('Error guardando selección:', error);
      Alert.alert('Error', 'No se pudo guardar la selección.');
    }
  };

  // Mostrar loading mientras se verifica auto-selección
  if (checkingAutoSelection) {
    return (
      <View style={styles.container}>
        <HeaderLogo />
        <ActivityIndicator size="large" color="#00AA00" />
        <Text style={{ marginTop: 12, color: '#fff', textAlign: 'center' }}>
          Cargando...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderLogo />
      <Text style={[styles.titulo, { marginTop: 80 }]}>Selecciona tu equipo y categorías</Text>

      {loadingEquipos ? (
        <ActivityIndicator size="large" style={{ marginVertical: 10 }} color="#00AA00" />
      ) : (
        <MultiSelectDropdown
          label="Equipo"
          items={equipos}
          selectedValues={equipoSeleccionado ? [equipoSeleccionado] : []}
          onValueChange={async (values) => {
            const equipoId = values[0];
            if (equipoId && equipoId.trim() !== '') {
              setEquipoSeleccionado(equipoId);
              setEquipoId(equipoId);
              setCategoriaSeleccionada([]);
              // Guardar la selección del equipo inmediatamente
              if (saveSelection) {
                try {
                  await saveSelection({
                    equipoId: equipoId,
                    equipoSeleccionado: equipoId,
                  });
                } catch (error) {
                  console.error('Error guardando selección de equipo:', error);
                }
              }
            }
          }}
          singleSelect
          searchable
        />
      )}

      {equipoSeleccionado && (
        <>
          {loadingCategorias ? (
            <ActivityIndicator size="small" style={{ marginTop: 12 }} color="#00AA00" />
          ) : (
            <MultiSelectDropdown
              label="Categorías"
              items={categorias}
              selectedValues={categoriaSeleccionada}
              onValueChange={async (values) => {
                setCategoriaSeleccionada(values);
                // Guardar la selección de categorías inmediatamente
                if (saveSelection) {
                  try {
                    await saveSelection({
                      categoriaSeleccionada: values,
                    });
                  } catch (error) {
                    console.error('Error guardando selección de categorías:', error);
                  }
                }
              }}
              searchable
            />
          )}

          {categoriaSeleccionada.length > 0 && (
            <AnimatedTouchable
              style={[styles.botonContinuar, { transform: [{ scale: scaleAnim }] }]}
              onPress={handleContinuar}
              activeOpacity={0.85}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
            >
              <Text style={styles.textoContinuar}>Continuar</Text>
            </AnimatedTouchable>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#121212', 
    padding: Platform.OS === 'web' ? 24 : 16,
    width: '100%',
    maxWidth: '100%',
  },
  titulo: { 
    fontSize: Platform.OS === 'web' ? 24 : 20, 
    fontWeight: '700', 
    marginBottom: 16, 
    color: '#fff', 
    textAlign: 'center' 
  },
  botonContinuar: {
    marginTop: 20,
    backgroundColor: '#00AA00',
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  textoContinuar: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default SeleccionEquipoCategoria;
