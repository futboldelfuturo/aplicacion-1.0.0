import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Text, Divider, Button } from 'react-native-paper';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../utils/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import HeaderLogo from '../components/HeaderLogo';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PerfilUsuario() {
  const navigation = useNavigation<NavigationProp>();
  const { rolActual, resetSeleccion } = useAppContext();
  const [userInfo, setUserInfo] = useState<{
    nombre: string;
    email: string;
    equipos: string[];
    categorias: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('nombre, correo, equipo_id, categoria_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !usuario) return;

      // Obtener nombres de equipos
      const equiposIds = Array.isArray(usuario.equipo_id) 
        ? usuario.equipo_id 
        : usuario.equipo_id 
        ? [String(usuario.equipo_id)]
        : [];

      const equiposNombres: string[] = [];
      if (equiposIds.length > 0) {
        const { data: equiposData } = await supabase
          .from('teams')
          .select('nombre')
          .in('id', equiposIds);
        equiposNombres.push(...(equiposData?.map(e => e.nombre) || []));
      }

      // Obtener nombres de categorías
      const categoriasIds = Array.isArray(usuario.categoria_id)
        ? usuario.categoria_id
        : usuario.categoria_id
        ? [String(usuario.categoria_id)]
        : [];

      const categoriasNombres: string[] = [];
      if (categoriasIds.length > 0) {
        const { data: categoriasData } = await supabase
          .from('categorias')
          .select('nombre')
          .in('id', categoriasIds);
        categoriasNombres.push(...(categoriasData?.map(c => c.nombre) || []));
      }

      setUserInfo({
        nombre: usuario.nombre || 'Usuario',
        email: usuario.correo || user.email || '',
        equipos: equiposNombres,
        categorias: categoriasNombres,
      });
    } catch (error) {
      console.error('Error cargando información del usuario:', error);
    }
  };

  const handleCerrarSesion = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        setLoading(true);
        try {
          // Cerrar sesión en Supabase
          await supabase.auth.signOut();
          
          // Limpiar AsyncStorage
          await AsyncStorage.clear();
          
          // Limpiar selección del contexto
          await resetSeleccion();
          
          // Esperar un momento para asegurar que todo se limpió
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Redirigir al login con reset completo
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
          window.alert('❌ Error\n\nNo se pudo cerrar sesión correctamente.');
        } finally {
          setLoading(false);
        }
      }
    } else {
      Alert.alert(
        'Cerrar sesión',
        '¿Estás seguro de que deseas cerrar sesión?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Cerrar sesión',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              try {
                // Cerrar sesión en Supabase
                await supabase.auth.signOut();
                
                // Limpiar AsyncStorage
                await AsyncStorage.clear();
                
                // Limpiar selección del contexto
                await resetSeleccion();
                
                // Esperar un momento para asegurar que todo se limpió
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Redirigir al login con reset completo
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              } catch (error) {
                console.error('Error al cerrar sesión:', error);
                Alert.alert('Error', 'No se pudo cerrar sesión correctamente.');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    }
  };

  const roleLabel = (r: string) => {
    if (r === 'administrador') return 'Administrador';
    if (r === 'entrenador') return 'Entrenador';
    if (r === 'analista') return 'Analista';
    return 'Invitado';
  };


  return (
    <View style={styles.container}>
      <HeaderLogo />
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, { paddingTop: 100 }]}>
        {userInfo ? (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Nombre</Text>
              <Text style={styles.value}>{userInfo.nombre}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{userInfo.email}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.label}>Rol actual</Text>
              <Text style={styles.value}>{roleLabel(rolActual)}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.label}>Equipos asignados</Text>
              {userInfo.equipos.length > 0 ? (
                userInfo.equipos.map((equipo, index) => (
                  <Text key={index} style={styles.value}>• {equipo}</Text>
                ))
              ) : (
                <Text style={styles.valueEmpty}>Ninguno</Text>
              )}
            </View>

            <Divider style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.label}>Categorías asignadas</Text>
              {userInfo.categorias.length > 0 ? (
                userInfo.categorias.map((categoria, index) => (
                  <Text key={index} style={styles.value}>• {categoria}</Text>
                ))
              ) : (
                <Text style={styles.valueEmpty}>Ninguna</Text>
              )}
            </View>
          </>
        ) : null}

        <Divider style={styles.divider} />

        <Button
          mode="contained"
          onPress={handleCerrarSesion}
          loading={loading}
          disabled={loading}
          style={styles.logoutButton}
          buttonColor="#d32f2f"
          labelStyle={{ color: '#fff' }}
          textColor="#fff"
        >
          Cerrar sesión
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  divider: {
    marginVertical: 10,
    backgroundColor: '#333',
  },
  section: {
    paddingVertical: 12,
  },
  label: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: '#fff',
    marginTop: 2,
  },
  valueEmpty: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  logoutButton: {
    marginTop: 20,
    marginBottom: 20,
  },
});

