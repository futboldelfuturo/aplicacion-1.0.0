// src/components/SelectorDeRol.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button } from 'react-native-paper';
import { useAppContext } from '@/context/AppContext';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Roles permitidos UI
type RoleParam = 'entrenador' | 'analista' | 'administrador';

export default function SelectorDeRol() {
  const navigation = useNavigation<NavigationProp>();
  const {
    initRoles,
    changeRole,
    resetSeleccion,
    rolActual,
    adminRouteName,
    userRoles,
  } = useAppContext();

  useEffect(() => {
    // aseguramos carga de roles
    initRoles().catch((e) => console.warn('[SelectorDeRol] initRoles', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangeRole = async (rol: RoleParam) => {
    try {
      const ok = await changeRole(rol);
      if (!ok) {
        Alert.alert('Rol no permitido', `No tienes asignado el rol '${rol}'.`);
        return;
      }

      // si es administrador, navegar al route configurado
      if (rol === 'administrador') {
        const target = adminRouteName && adminRouteName.length > 0 ? adminRouteName : 'PanelAdmin';
        navigation.navigate(target as any);
        return;
      }

      // si es entrenador o analista -> limpiar selección y pedir seleccionar equipo/categoría
      resetSeleccion();
      navigation.navigate('SeleccionEquipoCategoria' as any);
    } catch (err) {
      console.error('[SelectorDeRol] handleChangeRole', err);
    }
  };

  return (
    <View style={styles.container}>
      {userRoles?.includes('entrenador') && (
        <Button
          mode="contained"
          style={styles.boton}
          onPress={() => handleChangeRole('entrenador')}
          accessibilityLabel="Cambiar a entrenador"
        >
          Entrenador
        </Button>
      )}

      {userRoles?.includes('analista') && (
        <Button
          mode="contained"
          style={styles.boton}
          onPress={() => handleChangeRole('analista')}
          accessibilityLabel="Cambiar a analista"
        >
          Analista
        </Button>
      )}

      {userRoles?.includes('administrador') && (
        <Button
          mode="contained"
          style={styles.boton}
          onPress={() => handleChangeRole('administrador')}
          accessibilityLabel="Cambiar a administrador"
        >
          Administrador
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  boton: {
    marginBottom: 10,
    alignSelf: 'stretch',
    width: '90%',
    borderRadius: 28,
    paddingVertical: 6,
  },
});
