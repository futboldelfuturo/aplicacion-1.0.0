import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, Image, Platform } from "react-native";
import {
  Text,
  Button,
  Chip,
  Subheading,
  ActivityIndicator,
  TextInput,
} from "react-native-paper";
import { supabase } from "@/utils/supabase";
import { useRoute, useNavigation } from "@react-navigation/native";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import HeaderLogo from "../../components/HeaderLogo";
import { Feather } from "@expo/vector-icons";

type Rol = "administrador" | "entrenador" | "analista";
type Usuario = {
  id?: string;
  nombre: string;
  email: string;
  rolPrincipal: Rol;
  rolesSecundarios?: Rol[];
  equipos?: string[];
  categorias?: string[];
};
type Team = { id: string; nombre: string; escudo_url?: string | null };
type Categoria = { id: string; nombre: string; equipo_id: string };

type CreateMode = "usuario" | "jugador" | "equipo" | "categoria";

export default function CrearUsuario() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const mode =
    (route.params?.mode as CreateMode) ??
    (route.params?.usuario ? "usuario" : "usuario");
  const usuarioEdit = route.params?.usuario as Usuario | undefined;

  const [loading, setLoading] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    cargarTeams();
    cargarCategorias();
  }, []);

  const cargarTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, nombre, escudo_url")
        .order("nombre");
      if (!error) setTeams((data as any) || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const cargarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .order("nombre");
      if (!error) setCategorias((data as any) || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const ROLES: Rol[] = ["administrador", "entrenador", "analista"];
  const [nombreUsuario, setNombreUsuario] = useState(usuarioEdit?.nombre || "");
  const [email, setEmail] = useState(usuarioEdit?.email || "");

  // contraseña solo en creación
  const [password, setPassword] = useState("");

  const [rolPrincipal, setRolPrincipal] = useState<Rol>(
    usuarioEdit?.rolPrincipal || "entrenador"
  );
  const [rolesSecundarios, setRolesSecundarios] = useState<Rol[]>(
    usuarioEdit?.rolesSecundarios || []
  );
  const [equiposSeleccionados, setEquiposSeleccionados] = useState<string[]>(
    usuarioEdit?.equipos || []
  );
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<
    string[]
  >(usuarioEdit?.categorias || []);
  const [passwordCreada, setPasswordCreada] = useState<string>(""); // Guardar contraseña temporalmente solo al crear

  const showError = (msg?: string) =>
    Alert.alert("Error", msg || "Ocurrió un error");

  const crearUsuario = async () => {
    if (!nombreUsuario || !email || (!usuarioEdit && !password) || !rolPrincipal) {
      return showError("Completa los campos obligatorios.");
    }
    setLoading(true);
    try {
      let userId: string | undefined = usuarioEdit?.id;

      // 1) Crear en Auth (solo si es nuevo)
      if (!usuarioEdit) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              rol_principal: rolPrincipal,
              nombre: nombreUsuario,
            },
          },
        });

        console.log("Auth response:", JSON.stringify(authData, null, 2));
        if (authError) {
          console.error("Auth error:", authError);
          Alert.alert("Auth Error", JSON.stringify(authError, null, 2));
          throw authError;
        }

        // Obtener el ID del usuario creado en Auth
        if (authData?.user?.id) {
          userId = authData.user.id;
          console.log("Usuario creado en Auth con ID:", userId);
        } else {
          throw new Error("No se pudo obtener el ID del usuario creado en Auth");
        }

        // Guardar contraseña temporalmente solo si es creación nueva
        if (password) {
          setPasswordCreada(password);
        }
      }

      // 2) Guardar en tabla "usuarios"
      // Limpiar arrays para asegurar que no tengan valores null o undefined
      const equiposLimpios = equiposSeleccionados.filter(
        (id): id is string => id !== null && id !== undefined && id !== ""
      );
      const categoriasLimpias = categoriasSeleccionadas.filter(
        (id): id is string => id !== null && id !== undefined && id !== ""
      );

      const payload: any = {
        id: userId, // CRÍTICO: Usar el ID del usuario de Auth
        nombre: nombreUsuario,
        correo: email,
        rol_principal: rolPrincipal, // Asegurar que sea string
        roles: rolesSecundarios ?? [],
        equipo_id: equiposLimpios.length > 0 ? equiposLimpios : [],
        categoria_id: categoriasLimpias.length > 0 ? categoriasLimpias : [],
        ...(usuarioEdit ? {} : { creado_en: new Date().toISOString() }),
      };

      console.log("Payload a upsert en usuarios:", JSON.stringify(payload, null, 2));
      console.log("Rol principal a guardar:", rolPrincipal, "Tipo:", typeof rolPrincipal);

      if (!userId) {
        throw new Error("No se pudo determinar el ID del usuario");
      }

      const { data, error } = await supabase
        .from("usuarios")
        .upsert([payload], { onConflict: "id" }) // Siempre usar 'id' como conflicto
        .select();

      console.log("Upsert response:", JSON.stringify(data, null, 2));
      if (error) {
        console.error("DB error completo:", error);
        // No exponer detalles del error al usuario en producción
        if (Platform.OS === 'web') {
          window.alert('❌ Error\n\nOcurrió un error al procesar la solicitud. Por favor, intenta nuevamente.');
        } else {
          Alert.alert('Error', 'Ocurrió un error al procesar la solicitud. Por favor, intenta nuevamente.');
        }
        throw error;
      }

      // Verificar que el usuario se guardó correctamente
      if (data && data.length > 0) {
        console.log("Usuario guardado correctamente:", JSON.stringify(data[0], null, 2));
        console.log("Rol principal guardado:", data[0].rol_principal);
      } else {
        console.warn("No se recibió data del upsert");
      }

      if (Platform.OS === 'web') {
        window.alert(usuarioEdit ? "✅ Usuario actualizado correctamente" : "✅ Usuario creado correctamente");
        // En web, navegar inmediatamente
        navigation.goBack();
      } else {
        Alert.alert(
          "Éxito",
          usuarioEdit ? "Usuario actualizado correctamente" : "Usuario creado correctamente"
        );
        // Pequeño delay para asegurar que la actualización se complete
        setTimeout(() => {
          navigation.goBack();
        }, 500);
      }
    } catch (e: any) {
      console.error("Error al crear/editar usuario:", e);
      // No exponer detalles del error al usuario en producción
      if (Platform.OS === 'web') {
        window.alert('❌ Error\n\nOcurrió un error al procesar la solicitud. Por favor, intenta nuevamente.');
      } else {
        Alert.alert('Error', 'Ocurrió un error al procesar la solicitud. Por favor, intenta nuevamente.');
      }
      showError("Ocurrió un error al procesar la solicitud. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const categoriasFiltradas = categorias.filter((c) =>
    equiposSeleccionados.includes(c.equipo_id)
  );

  const renderUsuarioForm = () => (
    <>
      <Subheading>{usuarioEdit ? "Editar usuario" : "Crear usuario"}</Subheading>
      <TextInput
        label="Nombre"
        value={nombreUsuario}
        onChangeText={setNombreUsuario}
        style={{ marginBottom: 12, backgroundColor: "#fff" }}
        textColor={Platform.OS === 'web' ? '#000' : undefined}
        mode="outlined"
        theme={{
          colors: {
            primary: "#00AA00",
            text: Platform.OS === 'web' ? "#000" : undefined,
            placeholder: "#666",
            background: "#fff",
          },
        }}
      />
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        style={{ marginBottom: 12, backgroundColor: "#fff" }}
        textColor={Platform.OS === 'web' ? '#000' : undefined}
        keyboardType="email-address"
        mode="outlined"
        theme={{
          colors: {
            primary: "#00AA00",
            text: Platform.OS === 'web' ? "#000" : undefined,
            placeholder: "#666",
            background: "#fff",
          },
        }}
      />

      {/* Contraseña: solo para creación */}
      {!usuarioEdit && (
        <>
          <TextInput
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{ marginBottom: 12, backgroundColor: "#fff" }}
            textColor={Platform.OS === 'web' ? '#000' : undefined}
            mode="outlined"
            theme={{
              colors: {
                primary: "#00AA00",
                text: Platform.OS === 'web' ? "#000" : undefined,
                placeholder: "#666",
                background: "#fff",
              },
            }}
          />
          {passwordCreada && (
            <View style={{ 
              marginBottom: 12, 
              padding: 12, 
              backgroundColor: "#E8F5E9", 
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#4CAF50"
            }}>
              <Text style={{ color: "#2E7D32", fontSize: 12, marginBottom: 4, fontWeight: "600" }}>
                ⚠️ Contraseña asignada (guarda esta información):
              </Text>
              <Text style={{ color: "#1B5E20", fontSize: 14, fontWeight: "bold" }}>
                {passwordCreada}
              </Text>
              <Text style={{ color: "#666", fontSize: 11, marginTop: 4, fontStyle: "italic" }}>
                Esta contraseña no se puede recuperar después. Guárdala de forma segura.
              </Text>
            </View>
          )}
        </>
      )}
      
      {usuarioEdit && (
        <View style={{ 
          marginBottom: 12, 
          padding: 12, 
          backgroundColor: "#FFF3E0", 
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#FF9800"
        }}>
          <Text style={{ color: "#E65100", fontSize: 12, fontWeight: "600" }}>
            ℹ️ Información de contraseña
          </Text>
          <Text style={{ color: "#BF360C", fontSize: 13, marginTop: 4 }}>
            Las contraseñas en Supabase Auth están encriptadas y no se pueden recuperar por seguridad. 
            Si el usuario olvida su contraseña, debe usar la opción "Olvidé mi contraseña" en el login.
          </Text>
        </View>
      )}

      <Text style={{ marginTop: 12, marginBottom: 8, color: "#fff", fontSize: 16, fontWeight: "600" }}>
        Rol principal
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {ROLES.map((r) => (
          <Chip
            key={r}
            mode={rolPrincipal === r ? "flat" : "outlined"}
            onPress={() => setRolPrincipal(r)}
            selected={rolPrincipal === r}
            selectedColor="#fff"
            style={{
              backgroundColor: rolPrincipal === r 
                ? (r === "administrador" ? "#FF6B35" : r === "entrenador" ? "#00AA00" : "#0a7cff")
                : "#1F1F1F",
              borderColor: "#333",
            }}
            textStyle={{ color: "#fff" }}
          >
            {r}
          </Chip>
        ))}
      </View>

      <Text style={{ marginTop: 8, marginBottom: 8, color: "#fff", fontSize: 16, fontWeight: "600" }}>
        Roles secundarios
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {ROLES.filter((r) => r !== rolPrincipal).map((r) => (
          <Chip
            key={r}
            mode={rolesSecundarios.includes(r) ? "flat" : "outlined"}
            onPress={() => {
              if (rolesSecundarios.includes(r)) {
                setRolesSecundarios(rolesSecundarios.filter((x) => x !== r));
              } else {
                setRolesSecundarios([...rolesSecundarios, r]);
              }
            }}
          >
            {r}
          </Chip>
        ))}
      </View>

      <MultiSelectDropdown
        label="Equipos (máx. 5)"
        items={teams.map((t) => ({
          label: t.nombre,
          value: t.id,
          icon: t.escudo_url ? (
            <Image
              source={{ uri: t.escudo_url }}
              style={{ width: 35, height: 35, marginRight: 8 }}
            />
          ) : undefined,
        }))}
        selectedValues={equiposSeleccionados}
        onValueChange={(vals) => {
          if (vals.length <= 5) setEquiposSeleccionados(vals);
          else Alert.alert("Máximo 5 equipos permitidos");
        }}
        searchable={true}
        searchPlaceholder="Buscar equipos..."
      />

      {equiposSeleccionados.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "bold", marginBottom: 6, color: "#ffff" }}>
            Categorías disponibles
          </Text>
          {equiposSeleccionados.map((eqId) => {
            const equipo = teams.find((t) => t.id === eqId);
            const cats = categoriasFiltradas.filter((c) => c.equipo_id === eqId);
            if (cats.length === 0) return null;

            return (
              <View key={eqId} style={{ marginBottom: 12 }}>
                <Text style={{ marginBottom: 4, color: "#ffff" }}>
                  {equipo?.nombre || "Equipo"}:
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {cats.map((c) => {
                    const selected = categoriasSeleccionadas.includes(c.id);
                    return (
                      <Chip
                        key={c.id}
                        mode={selected ? "flat" : "outlined"}
                        onPress={() => {
                          if (selected) {
                            setCategoriasSeleccionadas(
                              categoriasSeleccionadas.filter((id) => id !== c.id)
                            );
                          } else {
                            setCategoriasSeleccionadas([
                              ...categoriasSeleccionadas,
                              c.id,
                            ]);
                          }
                        }}
                      >
                        {c.nombre}
                      </Chip>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Button
        mode="contained"
        onPress={crearUsuario}
        loading={loading}
        disabled={loading}
        style={{ 
          marginTop: 24, 
          backgroundColor: "#00AA00",
          paddingVertical: 8,
          borderRadius: 10,
        }}
        labelStyle={{ 
          color: "#fff",
          fontSize: 16,
          fontWeight: "bold",
        }}
        icon={usuarioEdit ? "content-save" : "account-plus"}
      >
        {usuarioEdit ? "Actualizar usuario" : "Crear usuario"}
      </Button>
    </>
  );

  const renderByMode = () => {
    switch (mode) {
      case "usuario":
        return renderUsuarioForm();
      default:
        return <Text>Modo no reconocido</Text>;
    }
  };

  const confirmarEliminar = () => {
    if (!usuarioEdit) return;
    Alert.alert(
      "Confirmar eliminación",
      `¿Estás seguro de eliminar a ${usuarioEdit.nombre}?\n\nEsta acción eliminará el usuario de Auth y de la base de datos. Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Eliminar de la tabla usuarios
              const { error: deleteError } = await supabase
                .from("usuarios")
                .delete()
                .eq("id", usuarioEdit.id);

              if (deleteError) throw deleteError;

              // Llamar a Edge Function para eliminar de Auth
              const { error: edgeError } = await supabase.functions.invoke("delete-user", {
                body: { userId: usuarioEdit.id },
              });

              if (edgeError) {
                console.warn("Error al eliminar de Auth:", edgeError);
              }

              Alert.alert("Éxito", "Usuario eliminado correctamente.");
              navigation.goBack();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "No se pudo eliminar el usuario");
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <HeaderLogo />
      <ScrollView
        {...(Platform.OS === 'web' ? { 'data-scrollview-web': true } : {})}
        style={{ flex: 1, backgroundColor: "#121212" }}
        contentContainerStyle={{ padding: 20, paddingTop: 100, paddingBottom: Platform.OS === 'web' ? 100 : 40 }}
        scrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>
          {usuarioEdit ? "Editar usuario" : "Crear usuario"}
        </Text>
        {loading && (
          <View style={{ padding: 20 }}>
            <ActivityIndicator animating size="large" color="#00AA00" />
          </View>
        )}
        <View style={{ marginTop: 8 }}>{renderByMode()}</View>
        
        {usuarioEdit && (
          <Button
            mode="contained"
            onPress={confirmarEliminar}
            style={{ 
              marginTop: 20, 
              backgroundColor: "#d32f2f",
              paddingVertical: 8,
            }}
            labelStyle={{ color: "#fff" }}
            icon="delete"
          >
            Eliminar usuario
          </Button>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  title: { 
    fontSize: 28, 
    fontWeight: "700", 
    marginBottom: 24, 
    color: "#fff",
    textAlign: "center",
  },
});
