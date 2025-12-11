import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Platform, StatusBar, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import HeaderLogo from "../../components/HeaderLogo";
import { Feather } from "@expo/vector-icons";
import { useAppContext } from "../../context/AppContext";

export default function PanelAdmin() {
  const navigation = useNavigation<any>();
  const { userRoles, changeRole } = useAppContext();
  
  // Verificar si el usuario tiene rol de entrenador o analista
  const tieneRolEntrenadorOAnalista = userRoles.some(rol => rol === 'entrenador' || rol === 'analista');

  const menuItems = [
    { 
      title: "Gestión de Usuarios", 
      icon: "users", 
      onPress: () => navigation.navigate("GestionUsuarios"),
      color: "#00AA00"
    },
    { 
      title: "Gestión de Equipos y Categorías", 
      icon: "shield", 
      onPress: () => navigation.navigate("GestionEquipos"),
      color: "#0a7cff"
    },
    { 
      title: "Gestión de Jugadores", 
      icon: "user", 
      onPress: () => navigation.navigate("GestionJugadores"),
      color: "#9B59B6"
    },
  ];

  const statusBarHeight = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0);
  const paddingTopNecesario = statusBarHeight + 20;

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <HeaderLogo showBackButton={false} />
      
      {/* Botón de perfil en la esquina superior izquierda */}
      <View style={styles.perfilButtonContainer}>
        <TouchableOpacity
          onPress={() => navigation.navigate('PerfilUsuario' as never)}
          style={styles.perfilButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="user" size={24} color="#00AA00" />
        </TouchableOpacity>
      </View>

      {/* Botones de cambio de rol en la esquina derecha */}
      <View style={styles.roleButtonsContainer}>
        {userRoles.includes('entrenador') && (
          <TouchableOpacity
            onPress={async () => {
              const ok = await changeRole('entrenador');
              if (ok) {
                navigation.navigate("PanelPrincipal" as never);
              } else {
                Alert.alert('Rol no permitido', 'No tienes asignado el rol de Entrenador.');
              }
            }}
            style={styles.roleButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="award" size={20} color="#00AA00" />
          </TouchableOpacity>
        )}
        {userRoles.includes('analista') && (
          <TouchableOpacity
            onPress={async () => {
              const ok = await changeRole('analista');
              if (ok) {
                navigation.navigate("PanelPrincipal" as never);
              } else {
                Alert.alert('Rol no permitido', 'No tienes asignado el rol de Analista.');
              }
            }}
            style={styles.roleButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="monitor" size={20} color="#00AA00" />
          </TouchableOpacity>
        )}
      </View>

      {/* Logo de la empresa centrado arriba */}
      <View style={[styles.logoContainer, { paddingTop: paddingTopNecesario }]}>
        <Image
          source={require('../../../assets/logo2.png')}
          style={styles.logoEmpresa}
          resizeMode="contain"
        />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Panel Administrador</Text>

        {/* Botón especial para ir al Panel Principal (solo si tiene rol de entrenador o analista) */}
        {tieneRolEntrenadorOAnalista && (
          <TouchableOpacity 
            style={styles.panelPrincipalButton} 
            onPress={() => navigation.navigate("PanelPrincipal" as never)}
            activeOpacity={0.8}
          >
            <View style={styles.panelPrincipalContent}>
              <View style={styles.panelPrincipalIconContainer}>
                <Feather name="home" size={28} color="#fff" />
              </View>
              <View style={styles.panelPrincipalTextContainer}>
                <Text style={styles.panelPrincipalTitle}>Panel Principal</Text>
                <Text style={styles.panelPrincipalSubtitle}>Volver al panel de entrenador/analista</Text>
              </View>
              <Feather name="chevron-right" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* Separador visual */}
        {tieneRolEntrenadorOAnalista && (
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>GESTIÓN</Text>
            <View style={styles.separatorLine} />
          </View>
        )}

        {/* Botones de gestión */}
        {menuItems.map((item, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.button, { borderLeftColor: item.color }]} 
            onPress={item.onPress}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
                <Feather name={item.icon as any} size={24} color={item.color} />
              </View>
              <Text style={styles.buttonText}>{item.title}</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#666" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    padding: 20, 
    gap: 16, 
    backgroundColor: "#121212",
    paddingBottom: 40
  },
  perfilButtonContainer: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
    left: 16,
    zIndex: 10,
  },
  perfilButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0, 170, 0, 0.1)",
  },
  roleButtonsContainer: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
    right: 16,
    flexDirection: "row",
    gap: 8,
    zIndex: 10,
  },
  roleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 170, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 170, 0, 0.3)",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    width: "100%",
  },
  logoEmpresa: {
    width: 120,
    height: 120,
    borderRadius: 999,
  },
  title: { 
    fontSize: 28, 
    fontWeight: "bold", 
    marginBottom: 24, 
    color: "#fff",
    textAlign: "center"
  },
  panelPrincipalButton: {
    backgroundColor: "#00AA00",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#00AA00",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  panelPrincipalContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelPrincipalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  panelPrincipalTextContainer: {
    flex: 1,
  },
  panelPrincipalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  panelPrincipalSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
    fontWeight: "500",
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#333",
  },
  separatorText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  button: {
    backgroundColor: "#1F1F1F",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#333",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "600",
    flex: 1
  },
});
