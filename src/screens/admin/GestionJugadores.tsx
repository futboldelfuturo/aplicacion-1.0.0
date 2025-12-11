import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  Platform,
  StatusBar,
} from "react-native";
import {
  Text,
  Button,
  ActivityIndicator,
  Dialog,
  Portal,
  Chip,
  IconButton,
  TextInput,
} from "react-native-paper";
import { supabase } from "@/utils/supabase";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import HeaderLogo from "../../components/HeaderLogo";
import { Feather } from "@expo/vector-icons";
import MultiSelectDropdown from "../../components/MultiSelectDropdown";

type Team = {
  id: string;
  nombre: string;
  escudo_url?: string | null;
};

type Jugador = {
  id: string;
  nombre: string;
  ano_nacimiento?: number | null;
  posicion?: string | null;
  pie_habil?: string | null;
  club?: string | null;
  estatura?: number | null;
  peso?: number | null;
  foto_url?: string | null;
  equipo_id?: string | null;
  dorsal?: number | null;
};

const POSICIONES = ["Portero", "Defensa", "Mediocentro", "Delantero"];
const PIES_HABILES = ["Izquierdo", "Derecho", "Ambos"];

const GestionJugadores = () => {
  const navigation = useNavigation<any>();

  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [loading, setLoading] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);

  const [search, setSearch] = useState("");

  // Dialog para jugador
  const [jugadorDialogVisible, setJugadorDialogVisible] = useState(false);
  const [jugadorEditId, setJugadorEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [añoNacimiento, setAñoNacimiento] = useState("");
  const [posicion, setPosicion] = useState("");
  const [pieHabil, setPieHabil] = useState("");
  const [club, setClub] = useState("");
  const [estatura, setEstatura] = useState("");
  const [peso, setPeso] = useState("");
  const [equipoId, setEquipoId] = useState<string | null>(null);
  const [fotoLocalUri, setFotoLocalUri] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const [processingDelete, setProcessingDelete] = useState(false);

  // ───────────────────────────────
  // Load jugadores / equipos / categorias
  // ───────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: jugadoresData, error: jugadoresError } = await supabase
        .from("jugadores")
        .select("*")
        .order("nombre", { ascending: true });
      if (jugadoresError) throw jugadoresError;

      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .order("nombre", { ascending: true });
      if (teamsError) throw teamsError;

      setJugadores(jugadoresData || []);
      setTeams(teamsData || []);
    } catch (err: any) {
      Alert.alert("Error", err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refrescar datos cuando se vuelve a la pantalla
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  // ───────────────────────────────
  // Apply filters (client-side)
  // ───────────────────────────────
  const filteredJugadores = useMemo(() => {
    return jugadores.filter((j) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        j.nombre?.toLowerCase().includes(q) ||
        j.club?.toLowerCase().includes(q) ||
        j.posicion?.toLowerCase().includes(q);
      return matchSearch;
    });
  }, [jugadores, search]);

  // ───────────────────────────────
  // Jugador: Abrir crear/editar
  // ───────────────────────────────
  const abrirCrearJugador = () => {
    setJugadorEditId(null);
    setNombre("");
    setAñoNacimiento("");
    setPosicion("");
    setPieHabil("");
    setClub("");
    setEstatura("");
    setPeso("");
    setEquipoId(null);
    setFotoLocalUri(null);
    setFotoUrl(null);
    setJugadorDialogVisible(true);
  };

  const abrirEditarJugador = (jugador: Jugador) => {
    setJugadorEditId(jugador.id);
    setNombre(jugador.nombre || "");
    setAñoNacimiento(jugador.ano_nacimiento ? String(jugador.ano_nacimiento) : "");
    setPosicion(jugador.posicion || "");
    setPieHabil(jugador.pie_habil || "");
    setClub(jugador.club || "");
    setEstatura(jugador.estatura ? String(jugador.estatura) : "");
    setPeso(jugador.peso ? String(jugador.peso) : "");
    setEquipoId(jugador.equipo_id || null);
    setFotoUrl(jugador.foto_url || null);
    setFotoLocalUri(null);
    setJugadorDialogVisible(true);
  };

  // ───────────────────────────────
  // Jugador: Seleccionar foto
  // ───────────────────────────────
  const pickFoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permisos", "Se necesitan permisos para acceder a la galería");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setFotoLocalUri(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // ───────────────────────────────
  // Jugador: Subir foto
  // ───────────────────────────────
  const uploadFoto = async (): Promise<string | null> => {
    if (!fotoLocalUri) return fotoUrl || null;

    try {
      setUploadingFoto(true);
      
      // Verificar autenticación antes de subir
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
      }
      
      const filename = `players/${Date.now()}-${Math.random()}.jpg`;
      const mimeType = "image/jpeg";
      
      // Eliminar foto anterior si existe
      if (fotoUrl && jugadorEditId) {
        const oldFilename = fotoUrl.split("/").pop();
        if (oldFilename) {
          try {
            const oldPath = oldFilename.includes("players/") ? oldFilename : `players/${oldFilename}`;
            await supabase.storage.from("videos1").remove([oldPath]);
          } catch (removeError) {
            console.warn("Error eliminando foto anterior:", removeError);
          }
        }
      }

      // Usar método diferenciado por plataforma
      if (Platform.OS === "web") {
        const resp = await fetch(fotoLocalUri);
    const blob = await resp.blob();
        const { error } = await supabase.storage
          .from("videos1")
          .upload(filename, blob, { contentType: mimeType, upsert: false });
        if (error) throw error;
      } else {
        const base64Data = await FileSystem.readAsStringAsync(fotoLocalUri, {
          encoding: "base64",
        });
        const arrayBuffer = decode(base64Data);
        const { error } = await supabase.storage
          .from("videos1")
          .upload(filename, arrayBuffer, { contentType: mimeType, upsert: false });
    if (error) throw error;
      }
      
    const { data } = supabase.storage.from("videos1").getPublicUrl(filename);
    return data.publicUrl;
    } catch (error: any) {
      console.error("Error subiendo foto:", error);
      throw error;
    } finally {
      setUploadingFoto(false);
    }
  };

  // ───────────────────────────────
  // Jugador: Guardar (optimizado)
  // ───────────────────────────────
  const guardarJugador = async () => {
    if (!nombre.trim()) {
      if (Platform.OS === 'web') {
        window.alert('❌ Error\n\nEl nombre es obligatorio');
      } else {
        Alert.alert("Error", "El nombre es obligatorio");
      }
      return;
    }

    try {
      setLoading(true);
      
      // Crear payload base inmediatamente
      const payload: any = {
        nombre: nombre.trim(),
        ano_nacimiento: añoNacimiento ? parseInt(añoNacimiento) : null,
        posicion: posicion || null,
        pie_habil: pieHabil || null,
        club: club.trim() || null,
        estatura: estatura ? parseFloat(estatura) : null,
        peso: peso ? parseFloat(peso) : null,
        equipo_id: equipoId || null,
      };

      // Subir foto en paralelo si existe, pero no bloquear la creación
      let finalFoto = fotoUrl || null;
      if (fotoLocalUri) {
        // Subir foto en background, no bloquear
        uploadFoto().then((url) => {
          if (url && jugadorEditId) {
            // Actualizar foto después si es edición
            supabase.from("jugadores")
              .update({ foto_url: url })
              .eq("id", jugadorEditId)
              .then(() => fetchData());
          }
        }).catch((err) => {
          console.warn("Error subiendo foto (no crítico):", err);
        });
      }

      // Guardar inmediatamente sin esperar la foto
      if (jugadorEditId) {
        const { error } = await supabase
          .from("jugadores")
          .update(payload)
          .eq("id", jugadorEditId);
        if (error) throw error;
        if (Platform.OS === 'web') {
          window.alert('✅ Jugador actualizado correctamente');
        } else {
          Alert.alert("Éxito", "Jugador actualizado correctamente");
        }
      } else {
        const { error } = await supabase.from("jugadores").insert(payload);
        if (error) throw error;
        if (Platform.OS === 'web') {
          window.alert('✅ Jugador creado correctamente');
        } else {
          Alert.alert("Éxito", "Jugador creado correctamente");
        }
      }

      setJugadorDialogVisible(false);
      // Refrescar datos sin esperar
      fetchData();
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(`❌ Error\n\n${err?.message || String(err)}`);
      } else {
        Alert.alert("Error", err?.message || String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // ───────────────────────────────
  // Jugador: Eliminar
  // ───────────────────────────────
  const confirmDeleteJugador = (jugador: Jugador) => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm(
        `¿Estás seguro de eliminar al jugador "${jugador.nombre}"?\n\nEsta acción no se puede deshacer.`
      );
      if (confirmar) {
        handleDeleteJugador(jugador);
      }
    } else {
      Alert.alert(
        "Confirmar eliminación",
        `¿Estás seguro de eliminar al jugador "${jugador.nombre}"?\n\nEsta acción no se puede deshacer.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => handleDeleteJugador(jugador),
          },
        ]
      );
    }
  };

  const handleDeleteJugador = async (jugador: Jugador) => {
    setProcessingDelete(true);
    try {
      // Eliminar foto del storage si existe
      if (jugador.foto_url) {
        const filename = jugador.foto_url.split("/").pop();
        if (filename) {
          try {
            const pathToRemove = filename.includes("players/") ? filename : `players/${filename}`;
            await supabase.storage.from("videos1").remove([pathToRemove]);
          } catch (removeError) {
            console.warn("Error eliminando foto:", removeError);
          }
        }
      }

      const { error } = await supabase.from("jugadores").delete().eq("id", jugador.id);
      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert("✅ Jugador eliminado correctamente");
      } else {
        Alert.alert("Éxito", "Jugador eliminado correctamente");
      }
      await fetchData();
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(`❌ Error\n\n${err?.message || String(err)}`);
      } else {
        Alert.alert("Error", err?.message || String(err));
      }
    } finally {
      setProcessingDelete(false);
    }
  };

  // ───────────────────────────────
  // Render item
  // ───────────────────────────────
  const renderItem = ({ item }: { item: Jugador }) => {
    const equipoNombre = teams.find((t) => t.id === item.equipo_id)?.nombre || "Sin equipo";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {item.foto_url && (
              <Image source={{ uri: item.foto_url }} style={styles.fotoImage} />
            )}
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>{item.nombre}</Text>
              <View style={styles.cardInfoRow}>
                {item.posicion && (
                  <Chip style={styles.infoChip} textStyle={styles.infoChipText}>
                    {item.posicion}
                  </Chip>
                )}
                {item.equipo_id && (
                  <Chip style={styles.infoChip} textStyle={styles.infoChipText}>
                    {equipoNombre}
                  </Chip>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardDetails}>
          {item.ano_nacimiento && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Año nacimiento:</Text>
              <Text style={styles.detailValue}>{item.ano_nacimiento}</Text>
            </View>
          )}
          {item.pie_habil && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Pie hábil:</Text>
              <Text style={styles.detailValue}>{item.pie_habil}</Text>
            </View>
          )}
          {item.club && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Club:</Text>
              <Text style={styles.detailValue}>{item.club}</Text>
            </View>
          )}
          {(item.estatura || item.peso) && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Físico:</Text>
              <Text style={styles.detailValue}>
                {item.estatura ? `${item.estatura} cm` : ""}
                {item.estatura && item.peso ? " / " : ""}
                {item.peso ? `${item.peso} kg` : ""}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardButtons}>
          <Button
            mode="contained"
            onPress={() => abrirEditarJugador(item)}
            style={styles.editButton}
            labelStyle={styles.buttonLabel}
            icon="pencil"
          >
            Editar
          </Button>
          <Button
            mode="outlined"
            onPress={() => confirmDeleteJugador(item)}
            style={styles.deleteButton}
            labelStyle={styles.deleteButtonLabel}
            icon="delete"
            disabled={processingDelete}
          >
            Eliminar
          </Button>
        </View>
      </View>
    );
  };

  // Calcular el paddingTop necesario para que el contenido quede debajo del banner
  const statusBarHeight = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0);
  const bannerHeight = 56;
  const paddingTopNecesario = statusBarHeight + bannerHeight + 20;

  // ───────────────────────────────
  // UI
  // ───────────────────────────────
  return (
    <View style={styles.container}>
      <HeaderLogo />
      <ScrollView
        {...(Platform.OS === 'web' ? { 'data-scrollview-web': true } : {})}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: paddingTopNecesario, paddingBottom: Platform.OS === 'web' ? 100 : 40 }}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Crear jugador arriba */}
        <Button
          mode="contained"
          style={styles.createButton}
          onPress={abrirCrearJugador}
          icon="account-plus"
          labelStyle={styles.createButtonLabel}
        >
          Crear jugador
      </Button>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            mode="outlined"
            placeholder="Buscar por nombre, club o posición"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            textColor={Platform.OS === 'web' ? '#000' : undefined}
            left={<TextInput.Icon icon="magnify" />}
            theme={{
              colors: {
                primary: "#00AA00",
                text: "#000",
                placeholder: "#666",
                background: "#fff",
              },
            }}
          />
        </View>

        {/* Estadísticas */}
        <View style={styles.statsRow}>
          <Chip style={styles.statChip} textStyle={styles.statChipText}>
            Total jugadores: {jugadores.length}
          </Chip>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00AA00" />
          </View>
        ) : filteredJugadores.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="user-x" size={48} color="#666" />
            <Text style={styles.emptyText}>
              {search ? "No hay jugadores que coincidan" : "No hay jugadores registrados"}
            </Text>
                </View>
        ) : (
          <View>
            {filteredJugadores.map((item) => (
              <View key={item.id}>{renderItem({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Dialog: Crear/Editar Jugador */}
      <Portal>
        <Dialog
          visible={jugadorDialogVisible}
          onDismiss={() => setJugadorDialogVisible(false)}
          style={{ backgroundColor: "#121212" }}
        >
          <Dialog.Title style={{ color: "#fff" }}>
            {jugadorEditId ? "Editar jugador" : "Crear jugador"}
          </Dialog.Title>
          <Dialog.Content style={{ maxHeight: Platform.OS === 'web' ? 600 : 500 }}>
            <ScrollView 
              style={{ maxHeight: Platform.OS === 'web' ? 550 : 450 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                mode="outlined"
                label="Nombre *"
                value={nombre}
                onChangeText={setNombre}
                style={[styles.dialogInput, Platform.OS === 'web' && { backgroundColor: '#fff' }]}
                textColor={Platform.OS === 'web' ? '#000' : undefined}
                theme={{
                  colors: {
                    primary: "#00AA00",
                    text: Platform.OS === 'web' ? "#000" : "#fff",
                    placeholder: "#666",
                    background: Platform.OS === 'web' ? "#fff" : "#121212",
                  },
                }}
              />
              <View style={{ height: 12 }} />

              <TextInput
                mode="outlined"
                label="Año de nacimiento"
                value={añoNacimiento}
                onChangeText={setAñoNacimiento}
                keyboardType="numeric"
                style={[styles.dialogInput, Platform.OS === 'web' && { backgroundColor: '#fff' }]}
                textColor={Platform.OS === 'web' ? '#000' : undefined}
                theme={{
                  colors: {
                    primary: "#00AA00",
                    text: Platform.OS === 'web' ? "#000" : "#fff",
                    placeholder: "#666",
                    background: Platform.OS === 'web' ? "#fff" : "#121212",
                  },
                }}
              />
              <View style={{ height: 12 }} />

              <Text style={{ color: "#fff", marginBottom: 8, fontSize: 14, fontWeight: "600" }}>
                Posición
              </Text>
              <View style={styles.chipsContainer}>
                {POSICIONES.map((pos) => (
                  <Chip
                    key={pos}
                    selected={posicion === pos}
                    onPress={() => setPosicion(posicion === pos ? "" : pos)}
                    style={[
                      styles.chip,
                      posicion === pos && { backgroundColor: "#00AA00" },
                    ]}
                    textStyle={styles.chipText}
                  >
                    {pos}
                  </Chip>
                ))}
              </View>
              <View style={{ height: 12 }} />

              <Text style={{ color: "#fff", marginBottom: 8, fontSize: 14, fontWeight: "600" }}>
                Pie hábil
              </Text>
              <View style={styles.chipsContainer}>
                {PIES_HABILES.map((pie) => (
                  <Chip
                    key={pie}
                    selected={pieHabil === pie}
                    onPress={() => setPieHabil(pieHabil === pie ? "" : pie)}
                    style={[
                      styles.chip,
                      pieHabil === pie && { backgroundColor: "#00AA00" },
                    ]}
                    textStyle={styles.chipText}
                  >
                    {pie}
                  </Chip>
                ))}
              </View>
              <View style={{ height: 12 }} />

              <TextInput
                mode="outlined"
                label="Club"
                value={club}
                onChangeText={setClub}
                style={[styles.dialogInput, Platform.OS === 'web' && { backgroundColor: '#fff' }]}
                textColor={Platform.OS === 'web' ? '#000' : undefined}
                theme={{
                  colors: {
                    primary: "#00AA00",
                    text: Platform.OS === 'web' ? "#000" : "#fff",
                    placeholder: "#666",
                    background: Platform.OS === 'web' ? "#fff" : "#121212",
                  },
                }}
              />
              <View style={{ height: 12 }} />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    mode="outlined"
                    label="Estatura (cm)"
                    value={estatura}
                    onChangeText={setEstatura}
                    keyboardType="decimal-pad"
                    style={[styles.dialogInput, Platform.OS === 'web' && { backgroundColor: '#fff' }]}
                    textColor={Platform.OS === 'web' ? '#000' : undefined}
                    theme={{
                      colors: {
                        primary: "#00AA00",
                        text: Platform.OS === 'web' ? "#000" : "#fff",
                        placeholder: "#666",
                        background: Platform.OS === 'web' ? "#fff" : "#121212",
                      },
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    mode="outlined"
                    label="Peso (kg)"
                    value={peso}
                    onChangeText={setPeso}
                    keyboardType="decimal-pad"
                    style={[styles.dialogInput, Platform.OS === 'web' && { backgroundColor: '#fff' }]}
                    textColor={Platform.OS === 'web' ? '#000' : undefined}
                    theme={{
                      colors: {
                        primary: "#00AA00",
                        text: Platform.OS === 'web' ? "#000" : "#fff",
                        placeholder: "#666",
                        background: Platform.OS === 'web' ? "#fff" : "#121212",
                      },
                    }}
                  />
                </View>
              </View>
              <View style={{ height: 12 }} />

              <Text style={{ color: "#fff", marginBottom: 8, fontSize: 14, fontWeight: "600" }}>
                Equipo (Opcional)
              </Text>
              {teams.length === 0 ? (
                <Text style={{ color: "#aaa", fontSize: 12, marginBottom: 8 }}>
                  No hay equipos disponibles.
                </Text>
              ) : (
                <MultiSelectDropdown
                  label="Seleccionar Equipo"
                  items={[
                    { label: "Sin equipo", value: "null" },
                    ...teams.map((t) => ({ label: t.nombre, value: t.id })),
                  ]}
                  selectedValues={equipoId ? [equipoId] : ["null"]}
                  onValueChange={(selected) => {
                    const valor = selected[0];
                    setEquipoId(valor === "null" ? null : valor);
                  }}
                  singleSelect={true}
                  searchable={true}
                  searchPlaceholder="Buscar equipos..."
                />
              )}
              <View style={{ height: 16 }} />

              <Button
                mode="outlined"
                onPress={pickFoto}
                style={styles.fotoButton}
                labelStyle={{ color: "#fff" }}
                icon="image"
              >
                {fotoLocalUri || fotoUrl ? "Cambiar foto" : "Seleccionar foto de perfil"}
              </Button>
              {(fotoLocalUri || fotoUrl) && (
                <View style={styles.fotoPreview}>
                  <Image
                    source={{ uri: fotoLocalUri || fotoUrl || "" }}
                    style={styles.fotoPreviewImage}
                  />
                </View>
              )}
              {uploadingFoto && (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color="#00AA00" />
                  <Text style={{ color: "#aaa", marginTop: 8 }}>Subiendo foto...</Text>
                </View>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button onPress={() => setJugadorDialogVisible(false)} textColor="#fff">
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={guardarJugador}
              loading={loading}
              style={{ backgroundColor: "#00AA00" }}
              labelStyle={{ color: "#fff" }}
            >
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

export default GestionJugadores;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  createButton: {
    backgroundColor: "#00AA00",
    marginBottom: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createButtonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: "#fff",
    height: 50,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  statChip: {
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#333",
  },
  statChipText: {
    color: "#fff",
    fontSize: 13,
  },
  card: {
    backgroundColor: "#1F1F1F",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#333",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  fotoImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#333",
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 18,
    color: "#fff",
    marginBottom: 4,
    flexWrap: "wrap",
    flexShrink: 1,
  },
  cardInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  infoChip: {
    backgroundColor: "#00AA00",
    alignSelf: "flex-start",
  },
  infoChipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  cardDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  detailItem: {
    flexDirection: "row",
    marginBottom: 8,
  },
  detailLabel: {
    color: "#aaa",
    fontSize: 13,
    marginRight: 8,
    fontWeight: "600",
    minWidth: 120,
  },
  detailValue: {
    color: "#fff",
    fontSize: 13,
    flex: 1,
  },
  cardButtons: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  editButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#00AA00",
  },
  deleteButton: {
    flex: 1,
    minWidth: 100,
    borderColor: "#d32f2f",
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 13,
  },
  deleteButtonLabel: {
    color: "#d32f2f",
    fontSize: 13,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#aaa",
    fontSize: 16,
    marginTop: 12,
  },
  dialogInput: {
    backgroundColor: "#fff",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#333",
  },
  chipText: {
    color: "#fff",
    fontSize: 12,
  },
  fotoButton: {
    borderColor: "#666",
  },
  fotoPreview: {
    marginTop: 12,
    alignItems: "center",
  },
  fotoPreviewImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#333",
  },
  uploadingContainer: {
    marginTop: 12,
    alignItems: "center",
  },
});
