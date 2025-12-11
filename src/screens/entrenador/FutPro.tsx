import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  StatusBar,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, Button, ActivityIndicator, TextInput, Chip } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../../utils/supabase";
import { RootStackParamList } from "../../types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppContext } from "../../context/AppContext";
import HeaderLogo from "../../components/HeaderLogo";
import { Feather } from "@expo/vector-icons";
import { Dialog, Portal } from "react-native-paper";

type NavigationProps = NativeStackNavigationProp<RootStackParamList, "FutPro">;

type Jugador = {
  id: string;
  nombre: string;
  foto_url?: string | null;
  posicion?: string | null;
  ano_nacimiento?: number | null;
  pie_habil?: string | null;
  club?: string | null;
  estatura?: number | null;
  peso?: number | null;
  equipo_id?: string | null;
  equipo_nombre?: string | null;
  analisis_count?: number;
};

export default function FutPro() {
  const navigation = useNavigation<NavigationProps>();
  const { equipoId, rolActual } = useAppContext();

  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [infoDialogVisible, setInfoDialogVisible] = useState(false);
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState<Jugador | null>(null);

  // Calcular el paddingTop necesario para que el contenido quede debajo del banner
  const statusBarHeight = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0);
  const bannerHeight = 56;
  const paddingTopNecesario = statusBarHeight + bannerHeight + 20;

  /** 🔹 Traer jugadores del equipo seleccionado */
  const getJugadores = useCallback(async () => {
    try {
      if (!equipoId) {
        setJugadores([]);
        return;
      }
      setLoading(true);

      const { data: jugadoresData, error } = await supabase
        .from("jugadores")
        .select("id, nombre, foto_url, posicion, ano_nacimiento, pie_habil, club, estatura, peso, equipo_id")
        .eq("equipo_id", equipoId)
        .order("nombre", { ascending: true });

      if (error) throw error;

      // Agregar número de análisis y nombre del equipo a cada jugador
      const jugadoresConExtra = await Promise.all(
        (jugadoresData || []).map(async (j: any) => {
          const { count } = await supabase
            .from("analisisjugadores")
            .select("id", { count: "exact", head: true })
            .eq("jugador_id", j.id)
            .eq("equipo_id", equipoId);

          // Obtener nombre del equipo si tiene equipo_id
          let equipoNombre = null;
          if (j.equipo_id) {
            const { data: equipoData } = await supabase
              .from("teams")
              .select("nombre")
              .eq("id", j.equipo_id)
              .maybeSingle();
            equipoNombre = equipoData?.nombre || null;
          }

          return {
            ...j,
            analisis_count: count || 0,
            equipo_nombre: equipoNombre,
          };
        })
      );

      setJugadores(jugadoresConExtra);
    } catch (error) {
      console.error("Error al traer jugadores:", error);
      Alert.alert("Error", "No se pudieron cargar los jugadores");
    } finally {
      setLoading(false);
    }
  }, [equipoId]);

  // Filtrar jugadores por búsqueda
  const jugadoresFiltrados = useMemo(() => {
    if (!search.trim()) return jugadores;
    
    const searchLower = search.toLowerCase();
    return jugadores.filter((j) => {
      const nombreMatch = j.nombre?.toLowerCase().includes(searchLower);
      const posicionMatch = j.posicion?.toLowerCase().includes(searchLower);
      const clubMatch = j.club?.toLowerCase().includes(searchLower);
      const añoMatch = j.ano_nacimiento?.toString().includes(searchLower);
      
      return nombreMatch || posicionMatch || clubMatch || añoMatch;
    });
  }, [jugadores, search]);

  const handleVerInformacion = (jugador: Jugador) => {
    setJugadorSeleccionado(jugador);
    setInfoDialogVisible(true);
  };

  const handleSubirVideo = (jugador: Jugador) => {
    if (!equipoId) {
      Alert.alert("Error", "No hay equipo seleccionado");
      return;
    }
    navigation.navigate("SubirVideo", {
      tipo: "futpro",
      equipoId: equipoId,
      categoriaId: "", // Ya no usamos categoría
      jugadorId: jugador.id,
    });
  };

  const handleVerInformes = (jugador: Jugador) => {
    if (!equipoId) {
      Alert.alert("Error", "No hay equipo seleccionado");
      return;
    }
    navigation.navigate("InformesJugador", {
      equipoId: equipoId,
      categoriaId: "", // Ya no usamos categoría
      jugadorId: jugador.id,
      jugadorNombre: jugador.nombre,
    });
  };

  useEffect(() => {
    if (equipoId) {
      getJugadores();
    } else {
      setJugadores([]);
    }
  }, [getJugadores, equipoId]);

  if (!equipoId) {
    return (
      <View style={styles.container}>
        <HeaderLogo />
        <View style={[styles.emptyContainer, { paddingTop: paddingTopNecesario }]}>
          <Feather name="users" size={48} color="#666" />
          <Text style={styles.emptyText}>Selecciona un equipo para ver los jugadores</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderLogo />
      <ScrollView
        contentContainerStyle={{ paddingTop: paddingTopNecesario, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Buscador */}
        <View style={styles.searchContainer}>
          <TextInput
            mode="outlined"
            placeholder="Buscar por nombre, posición, club o año"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
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

        {/* Lista de jugadores */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00AA00" />
          </View>
        ) : jugadoresFiltrados.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="user-x" size={48} color="#666" />
            <Text style={styles.emptyText}>
              {search ? "No hay jugadores que coincidan" : "No hay jugadores registrados"}
            </Text>
          </View>
        ) : (
          <View>
            {jugadoresFiltrados.map((jugador) => (
              <View key={jugador.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    {jugador.foto_url ? (
                      <Image source={{ uri: jugador.foto_url }} style={styles.fotoImage} />
                    ) : (
                      <View style={styles.fotoPlaceholder}>
                        <Feather name="user" size={24} color="#666" />
                      </View>
                    )}
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>{jugador.nombre}</Text>
                      <View style={styles.cardSubtitle}>
                        {jugador.equipo_nombre && (
                          <Text style={styles.subtitleText}>{jugador.equipo_nombre}</Text>
                        )}
                        {jugador.equipo_nombre && jugador.posicion && (
                          <Text style={styles.subtitleSeparator}> • </Text>
                        )}
                        {jugador.posicion && (
                          <Text style={styles.subtitleText}>{jugador.posicion}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.cardButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.infoButton]}
                    onPress={() => handleVerInformacion(jugador)}
                  >
                    <Feather name="info" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Info</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.reportsButton]}
                    onPress={() => handleVerInformes(jugador)}
                  >
                    <Feather name="file-text" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Informes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Dialog de información del jugador */}
      <Portal>
        <Dialog
          visible={infoDialogVisible}
          onDismiss={() => setInfoDialogVisible(false)}
          style={{ backgroundColor: "#121212" }}
        >
          <Dialog.Title style={{ color: "#fff" }}>Información del Jugador</Dialog.Title>
          <Dialog.Content>
            <ScrollView>
              {jugadorSeleccionado && (
                <>
                  {jugadorSeleccionado.foto_url && (
                    <View style={styles.dialogImageContainer}>
                      <Image
                        source={{ uri: jugadorSeleccionado.foto_url }}
                        style={styles.dialogImage}
                      />
                    </View>
                  )}
                  
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Nombre</Text>
                    <Text style={styles.infoValue}>{jugadorSeleccionado.nombre}</Text>
                  </View>

                  {jugadorSeleccionado.posicion && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Posición</Text>
                      <Text style={styles.infoValue}>{jugadorSeleccionado.posicion}</Text>
                    </View>
                  )}

                  {jugadorSeleccionado.ano_nacimiento && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Año de nacimiento</Text>
                      <Text style={styles.infoValue}>{jugadorSeleccionado.ano_nacimiento}</Text>
                    </View>
                  )}

                  {jugadorSeleccionado.pie_habil && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Pie hábil</Text>
                      <Text style={styles.infoValue}>{jugadorSeleccionado.pie_habil}</Text>
                    </View>
                  )}

                  {jugadorSeleccionado.club && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Club</Text>
                      <Text style={styles.infoValue}>{jugadorSeleccionado.club}</Text>
                    </View>
                  )}

                  {(jugadorSeleccionado.estatura || jugadorSeleccionado.peso) && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Físico</Text>
                      <Text style={styles.infoValue}>
                        {jugadorSeleccionado.estatura ? `${jugadorSeleccionado.estatura} cm` : ""}
                        {jugadorSeleccionado.estatura && jugadorSeleccionado.peso ? " / " : ""}
                        {jugadorSeleccionado.peso ? `${jugadorSeleccionado.peso} kg` : ""}
                      </Text>
                    </View>
                  )}

                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Análisis realizados</Text>
                    <Text style={styles.infoValue}>{jugadorSeleccionado.analisis_count || 0}</Text>
                  </View>
                </>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button onPress={() => setInfoDialogVisible(false)} textColor="#fff">
              Cerrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
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
    marginBottom: 16,
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
  fotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 18,
    color: "#fff",
    marginBottom: 4,
  },
  cardSubtitle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  subtitleText: {
    color: "#aaa",
    fontSize: 14,
  },
  subtitleSeparator: {
    color: "#666",
    fontSize: 14,
  },
  cardButtons: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  infoButton: {
    backgroundColor: "#00AA00",
  },
  uploadButton: {
    backgroundColor: "#00AA00",
  },
  reportsButton: {
    backgroundColor: "#00AA00",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
    textAlign: "center",
  },
  infoSection: {
    marginBottom: 16,
    alignItems: "center",
  },
  infoLabel: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    fontWeight: "600",
    textAlign: "center",
  },
  infoValue: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
  dialogImageContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  dialogImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#333",
  },
});
