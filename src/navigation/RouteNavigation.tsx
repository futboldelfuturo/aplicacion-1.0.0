import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { Image, View, Text, TouchableOpacity } from "react-native";
import { RootStackParamList } from "@/types";
import { Feather } from "@expo/vector-icons";
import WebContainer from "../components/WebContainer";

import LoginScreen from "../screens/auth/LoginScreen";
import AuthRedirector from "../screens/auth/AuthRedirector";
import SeleccionEquipoCategoria from "../components/SeleccionEquipoCategoria";

// 🔹 NUEVAS pantallas para admin
import PanelAdmin from "../screens/admin/PanelAdmin";
import GestionUsuarios from "../screens/admin/GestionUsuarios";
import CrearUsuario from "../screens/admin/CrearUsuario"; // <-- nueva pantalla
import GestionEquipos from "../screens/admin/GestionEquipos";
import GestionCategorias from "../screens/admin/GestionCategorias";
import GestionJugadores from "../screens/admin/GestionJugadores";

import PanelPrincipal from "../screens/Principal/PanelPrincipal";
import Entrenamientos from "../screens/entrenador/Entrenamientos";
import AnalisisPartidos from "../screens/entrenador/AnalisisPartidos";
import PartidosCompletos from "../screens/entrenador/PartidosCompletos";
import FutPro from "../screens/entrenador/FutPro";
import SubirVideo from "../screens/entrenador/SubirVideo";
import SubirAnalisis from "../screens/entrenador/SubirAnalisis";
import SubirDeNube from "../screens/entrenador/SubirDeNube";
import ContenidoPorCategoria from "../screens/entrenador/ContenidoPorCategoria";
import VideoPlayer from "../screens/entrenador/VideoPlayer";
import EditarVideo from "../screens/entrenador/EditarVideo";
import InformesJugador from "../screens/entrenador/InformesJugador";
import PerfilUsuario from "../screens/PerfilUsuario";
import EditarAnalisis from "../screens/entrenador/EditarAnalisis";
import EditarAnalisisJugador from "../screens/entrenador/EditarAnalisisJugador";

import { createNavigationContainerRef } from "@react-navigation/native";
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createStackNavigator<RootStackParamList>();

// Header con logo personalizado (sin menú aquí, se maneja en RouteNavigation)
const HeaderWithLogo = ({ title }: { title: string }) => {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <Image
          source={require("../../assets/Flogo.png")}
          style={{ width: 30, height: 30, marginRight: 8 }}
        />
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold" }}>
          {title}
        </Text>
      </View>
    </View>
  );
};

const RouteNavigation = () => {
  // Header con botón de menú (definido dentro del componente para navegar a perfil)
  const HeaderWithMenu = ({ title }: { title: string }) => {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Image
            source={require("../../assets/Flogo.png")}
            style={{ width: 30, height: 30, marginRight: 8 }}
          />
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold" }}>
            {title}
          </Text>
        </View>
      </View>
    );
  };

  const defaultOptions = {
    headerShown: false, // Ocultar header en todas las pantallas por defecto
    headerStyle: {
      backgroundColor: "#121212",
      elevation: 4,
    },
    headerTintColor: "#00AA00",
    headerTitleAlign: "center" as const,
    headerTitleStyle: {
      fontSize: 20,
      fontWeight: "bold" as const,
    },
  };

  return (
    <WebContainer>
      <View style={{ flex: 1 }}>
        <Stack.Navigator initialRouteName="Login" screenOptions={defaultOptions}>
      {/* Login y auth */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AuthRedirector"
        component={AuthRedirector}
        options={{ headerShown: false }}
      />

      {/* Selección */}
      <Stack.Screen
        name="SeleccionEquipoCategoria"
        component={SeleccionEquipoCategoria}
        options={{
          headerTitle: () => (
            <HeaderWithMenu title="Seleccionar equipo/categoría" />
          ),
          cardStyleInterpolator: () => ({ cardStyle: { opacity: 1 } }),
        }}
      />

      {/* Panel Admin */}
      <Stack.Screen
        name="PanelAdmin"
        component={PanelAdmin}
        options={{
          headerTitle: () => <HeaderWithMenu title="Panel Admin" />,
        }}
      />
      <Stack.Screen
        name="GestionUsuarios"
        component={GestionUsuarios}
        options={{
          headerTitle: () => <HeaderWithMenu title="Gestión de Usuarios" />,
        }}
      />
      <Stack.Screen
        name="CrearUsuario"
        component={CrearUsuario}
        options={{
          headerTitle: () => <HeaderWithMenu title="Crear / Editar Usuario" />,
        }}
      />
      <Stack.Screen
        name="GestionEquipos"
        component={GestionEquipos}
        options={{
          headerTitle: () => <HeaderWithMenu title="Gestión de Equipos" />,
        }}
      />
      <Stack.Screen
        name="GestionCategorias"
        component={GestionCategorias}
        options={{
          headerTitle: () => <HeaderWithMenu title="Gestión de Categorías" />,
        }}
      />
      <Stack.Screen
        name="GestionJugadores"
        component={GestionJugadores}
        options={{
          headerTitle: () => <HeaderWithMenu title="Gestión de Jugadores" />,
        }}
      />
      {/* Panel principal */}
      <Stack.Screen
        name="PanelPrincipal"
        component={PanelPrincipal}
        options={{
          headerTitle: () => <HeaderWithMenu title="Inicio" />,
        }}
      />

      {/* Entrenador */}
      <Stack.Screen
        name="Entrenamientos"
        component={Entrenamientos}
        options={{
          headerTitle: () => <HeaderWithMenu title="Entrenamientos" />,
        }}
      />
      <Stack.Screen
        name="AnalisisPartidos"
        component={AnalisisPartidos}
        options={{
          headerTitle: () => <HeaderWithMenu title="Análisis de Partidos" />,
        }}
      />
      <Stack.Screen
        name="PartidosCompletos"
        component={PartidosCompletos}
        options={{
          headerTitle: () => <HeaderWithMenu title="Partidos Completos" />,
        }}
      />
      <Stack.Screen
        name="FutPro"
        component={FutPro}
        options={{
          headerTitle: () => <HeaderWithMenu title="FutPro" />,
        }}
      />
      <Stack.Screen
        name="SubirVideo"
        component={SubirVideo}
        options={{
          headerTitle: () => <HeaderWithMenu title="Subir Video" />,
        }}
      />
      <Stack.Screen
        name="SubirAnalisis"
        component={SubirAnalisis}
        options={{
          headerTitle: () => <HeaderWithMenu title="Subir Análisis" />,
        }}
      />
      <Stack.Screen
        name="SubirDeNube"
        component={SubirDeNube}
        options={{
          headerTitle: () => <HeaderWithMenu title="+Youtube" />,
        }}
      />
      <Stack.Screen
        name="ContenidoPorCategoria"
        component={ContenidoPorCategoria}
        options={{
          headerTitle: () => <HeaderWithMenu title="Contenido por Categoría" />,
        }}
      />
      <Stack.Screen
        name="VideoPlayer"
        component={VideoPlayer}
        options={{
          headerTitle: () => <HeaderWithMenu title="Video Player" />,
        }}
      />
      <Stack.Screen
        name="EditarVideo"
        component={EditarVideo}
        options={{
          headerTitle: () => <HeaderWithMenu title="Editar Video" />,
        }}
      />

      {/* Informes */}
      <Stack.Screen
        name="InformesJugador"
        component={InformesJugador}
        options={{
          headerTitle: () => <HeaderWithMenu title="Informes del Jugador" />,
        }}
      />

      {/* Perfil de usuario */}
      <Stack.Screen
        name="PerfilUsuario"
        component={PerfilUsuario}
        options={{
          headerTitle: () => <HeaderWithLogo title="Perfil" />,
        }}
      />

      {/* Editar análisis */}
      <Stack.Screen
        name="EditarAnalisis"
        component={EditarAnalisis}
        options={{
          headerTitle: () => <HeaderWithMenu title="Editar Análisis" />,
        }}
      />

      {/* Editar análisis de jugador */}
      <Stack.Screen
        name="EditarAnalisisJugador"
        component={EditarAnalisisJugador}
        options={{
          headerTitle: () => <HeaderWithMenu title="Editar Análisis" />,
        }}
      />
    </Stack.Navigator>
      </View>
    </WebContainer>
  );
};

export default RouteNavigation;
