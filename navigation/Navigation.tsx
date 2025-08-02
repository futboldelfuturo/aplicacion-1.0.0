// Navigation/navigation.tsx

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import SeleccionEquipoCategorias from '../screens/SeleccionEquipoCategoria';
import SubirVideo from '../screens/SubirVideo';
import UploadScreen from '../screens/UploadScreen';
import ListaVideos from '../screens/ListaVideos';

import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const Navigation = () => {
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar sesión' }} />
        <Stack.Screen
          name="SeleccionEquipoCategorias"
          options={{ title: 'Seleccionar equipo y categoría' }}
        >
          {(props) => (
            <SeleccionEquipoCategorias
              {...props}
              equipoSeleccionado={equipoSeleccionado}
              setEquipoSeleccionado={setEquipoSeleccionado}
              categoriaSeleccionada={categoriaSeleccionada}
              setCategoriaSeleccionada={setCategoriaSeleccionada}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="SubirVideo" options={{ title: 'Subir Video' }}>
          {(props) => (
            <SubirVideo
              {...props}
              equipoSeleccionado={equipoSeleccionado}
              categoriaSeleccionada={categoriaSeleccionada}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="UploadScreen" component={UploadScreen} options={{ title: 'Subir Informe' }} />
        <Stack.Screen name="ListaVideos" component={ListaVideos} options={{ title: 'Lista de Videos' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
