import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
  StatusBar,
} from "react-native";
import { supabase } from "../../utils/supabase";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../types";
import { useAppContext } from "../../context/AppContext";
import { useNavigation } from "@react-navigation/native";

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { initRoles, rolesLoaded, rolActual } = useAppContext();

  // Animación fade-in
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const onLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Ingresa correo y contraseña.");
      return;
    }

    try {
      setLoading(true);

      const resp = await supabase.auth.signInWithPassword({ email, password });

      if (resp.error) {
        Alert.alert("Error", resp.error.message || "No se pudo iniciar sesión");
        setLoading(false);
        return;
      }

      try {
        await initRoles();
      } catch (e) {
        console.warn("[LoginScreen] initRoles fallo:", e);
      }

      const maxWait = 2500;
      const interval = 100;
      let waited = 0;
      while (!rolesLoaded && waited < maxWait) {
        await new Promise((r) => setTimeout(r, interval));
        waited += interval;
      }

      if (rolActual === "entrenador" || rolActual === "analista") {
        // Para entrenador/analista, siempre ir a selección de equipo/categoría primero
        // El componente SeleccionEquipoCategoria manejará la auto-selección si aplica
        navigation.reset({
          index: 0,
          routes: [{ name: "SeleccionEquipoCategoria" as keyof RootStackParamList }],
        });
        return;
      }
      if (rolActual === "administrador") {
        navigation.reset({
          index: 0,
          routes: [{ name: "PanelAdmin" as keyof RootStackParamList }],
        });
        return;
      }
      navigation.reset({
        index: 0,
        routes: [{ name: "PanelPrincipal" as keyof RootStackParamList }],
      });
    } catch (err) {
      console.error("[LoginScreen] error login:", err);
      Alert.alert("Error", "Ocurrió un problema al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Logo */}
          <Image
            source={require("../../../assets/Flogo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Título */}
          <Text style={styles.title}>Iniciar sesión</Text>

          {/* Inputs */}
          <TextInput
            placeholder="Correo"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, Platform.OS === 'web' && { color: '#000' }]}
            placeholderTextColor={Platform.OS === 'web' ? '#666' : '#ffffff88'}
          />

          <TextInput
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={[styles.input, Platform.OS === 'web' && { color: '#000' }]}
            placeholderTextColor={Platform.OS === 'web' ? '#666' : '#ffffff88'}
          />

          {/* Botón */}
          <TouchableOpacity style={styles.button} onPress={onLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  logo: {
    width: "80%",
    height: 120,
    marginBottom: 30,
  },
  title: {
    fontFamily: "MontserratBold",
    fontSize: 24,
    marginBottom: 20,
    color: "#fff",
    textAlign: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ffffff33",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    color: "#fff",
    backgroundColor: "#ffffff10",
    fontFamily: "PoppinsMedium",
  },
  button: {
    width: "100%",
    backgroundColor: "#00AA00",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "MontserratBold",
  },
});
