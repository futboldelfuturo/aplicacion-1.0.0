import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Alert,
  FlatList,
  TextInput as RNTextInput,
  Platform,
  ScrollView,
} from "react-native";
import {
  Text,
  Button,
  ActivityIndicator,
  Dialog,
  Portal,
  Subheading,
  Paragraph,
  Chip,
  IconButton,
  TextInput,
} from "react-native-paper";
import { supabase } from "@/utils/supabase";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import HeaderLogo from "../../components/HeaderLogo";
import { Feather } from "@expo/vector-icons";

type Usuario = {
  id: string;
  nombre: string;
  correo: string;
  rol_principal?: string;
  roles?: string[];
  equipo_id?: string[] | string | null;
  categoria_id?: string[] | string | null;
  creado_en?: string;
};

type Team = { id: string; nombre: string; escudo_url?: string };
type Categoria = { id: string; nombre: string; equipo_id?: string };

const GestionUsuarios = () => {
  const navigation = useNavigation<any>();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [search, setSearch] = useState("");
  const [rolFilter, setRolFilter] = useState<string | null>(null);
  const [equiposFilter, setEquiposFilter] = useState<string[]>([]);

  // Filter dialog
  const [filterDialogVisible, setFilterDialogVisible] = useState(false);
  const [dialogRole, setDialogRole] = useState<string | null>(null);
  const [dialogEquipos, setDialogEquipos] = useState<string[]>([]);

  const [dialogVisible, setDialogVisible] = useState(false); // info dialog
  const [usuarioInfo, setUsuarioInfo] = useState<Usuario | null>(null);
  const [stats, setStats] = useState<{
    entrenadorTotal: number;
    entrenadorMes: number;
    analistaTotal: number;
    analistaMes: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [processingDelete, setProcessingDelete] = useState(false);
  const [mostrarStats, setMostrarStats] = useState(false);

  // ───────────────────────────────
  // Load usuarios / equipos / categorias
  // ───────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: usuariosData, error: usuariosError } = await supabase
        .from("usuarios")
        .select("*")
        .order("creado_en", { ascending: false });
      if (usuariosError) throw usuariosError;

      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .order("nombre", { ascending: true });
      if (teamsError) throw teamsError;

      const { data: categoriasData, error: categoriasError } = await supabase
        .from("categorias")
        .select("*")
        .order("nombre", { ascending: true });
      if (categoriasError) throw categoriasError;

      setUsuarios(usuariosData || []);
      setTeams(teamsData || []);
      setCategorias(categoriasData || []);
    } catch (err: any) {
      Alert.alert("Error", err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refrescar datos cuando se vuelve a la pantalla (después de editar)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  // ───────────────────────────────
  // Apply filters (client-side)
  // ───────────────────────────────
  const filteredUsuarios = useMemo(() => {
    return usuarios.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        u.nombre?.toLowerCase().includes(q) ||
        u.correo?.toLowerCase().includes(q);

      // rol principal o dentro de roles secundarios
      const matchRol = rolFilter
        ? u.rol_principal === rolFilter || u.roles?.includes(rolFilter)
        : true;

      const matchEquipos =
        equiposFilter.length > 0
          ? (Array.isArray(u.equipo_id) ? u.equipo_id : [u.equipo_id]).some((id) =>
              equiposFilter.includes(String(id || ""))
            )
          : true;

      return matchSearch && matchRol && matchEquipos;
    });
  }, [usuarios, search, rolFilter, equiposFilter]);

  // ───────────────────────────────
  // Role counts
  // ───────────────────────────────
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { admin: 0, entrenador: 0, analista: 0 };
    usuarios.forEach((u) => {
      if (u.rol_principal && counts[u.rol_principal] !== undefined) {
        counts[u.rol_principal]++;
      }
      u.roles?.forEach((r) => {
        if (counts[r] !== undefined) counts[r]++;
      });
    });
    return counts;
  }, [usuarios]);

  // ───────────────────────────────
  // Info: abrir modal sin cargar stats
  // ───────────────────────────────
  const openInfo = (usuario: Usuario) => {
    setUsuarioInfo(usuario);
    setDialogVisible(true);
    setMostrarStats(false);
    setStats(null);
  };

  // ───────────────────────────────
  // Cargar estadísticas cuando se presiona el botón
  // ───────────────────────────────
  const cargarEstadisticas = async () => {
    if (!usuarioInfo) return;
    
    setMostrarStats(true);
    setStatsLoading(true);

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { count: entrenadorTotal } = await supabase
        .from("videos_entrenadores")
        .select("*", { count: "exact", head: true })
        .eq("creado_por", usuarioInfo.id);

      const { count: entrenadorMes } = await supabase
        .from("videos_entrenadores")
        .select("*", { count: "exact", head: true })
        .eq("creado_por", usuarioInfo.id)
        .gte("creado_en", startOfMonth.toISOString());

      const { count: analisisJugTotal } = await supabase
        .from("analisisjugadores")
        .select("*", { count: "exact", head: true })
        .eq("analista_id", usuarioInfo.id);

      const { count: analisisJugMes } = await supabase
        .from("analisisjugadores")
        .select("*", { count: "exact", head: true })
        .eq("analista_id", usuarioInfo.id)
        .gte("creado_en", startOfMonth.toISOString());

      const { count: analisisPartTotal } = await supabase
        .from("analisispartidos")
        .select("*", { count: "exact", head: true })
        .eq("analista_id", usuarioInfo.id);

      const { count: analisisPartMes } = await supabase
        .from("analisispartidos")
        .select("*", { count: "exact", head: true })
        .eq("analista_id", usuarioInfo.id)
        .gte("fecha", startOfMonth.toISOString());

      setStats({
        entrenadorTotal: entrenadorTotal || 0,
        entrenadorMes: entrenadorMes || 0,
        analistaTotal: (analisisJugTotal || 0) + (analisisPartTotal || 0),
        analistaMes: (analisisJugMes || 0) + (analisisPartMes || 0),
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  const closeInfo = () => {
    setDialogVisible(false);
    setUsuarioInfo(null);
    setStats(null);
    setMostrarStats(false);
  };

  // ───────────────────────────────
  // Edit: map usuario -> CrearUsuario expected shape and navigate
  // ───────────────────────────────
  const onEditUsuario = async (item: Usuario) => {
    // Cargar datos del usuario (sin canal, ya que ahora se asigna a equipos)

    // Limpiar y normalizar equipos
    let equiposNormalizados: string[] = [];
    if (Array.isArray(item.equipo_id)) {
      equiposNormalizados = item.equipo_id
        .filter((id): id is string => id !== null && id !== undefined && id !== "")
        .map(id => String(id));
    } else if (item.equipo_id) {
      equiposNormalizados = [String(item.equipo_id)];
    }

    // Limpiar y normalizar categorías
    let categoriasNormalizadas: string[] = [];
    if (Array.isArray(item.categoria_id)) {
      categoriasNormalizadas = item.categoria_id
        .filter((id): id is string => id !== null && id !== undefined && id !== "")
        .map(id => String(id));
    } else if (item.categoria_id) {
      categoriasNormalizadas = [String(item.categoria_id)];
    }

    const mapped = {
      id: item.id,
      nombre: item.nombre,
      email: item.correo,
      rolPrincipal: item.rol_principal ?? "entrenador",
      rolesSecundarios: item.roles ?? [],
      equipos: equiposNormalizados,
      categorias: categoriasNormalizadas,
    };
    navigation.navigate("CrearUsuario", { mode: "usuario", usuario: mapped });
  };

  // ───────────────────────────────
  // Render item
  // ───────────────────────────────
  const renderItem = ({ item }: { item: Usuario }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.rol_principal || '') }]}>
            <Text style={styles.roleBadgeText}>{item.rol_principal || 'N/A'}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.cardTitle}>{item.nombre}</Text>
      <Text style={styles.cardEmail}>{item.correo}</Text>
      <View style={styles.cardButtons}>
        <Button 
          mode="outlined" 
          onPress={() => openInfo(item)}
          style={styles.infoButton}
          labelStyle={styles.buttonLabel}
          icon="information"
        >
          Info
        </Button>
        <Button 
          mode="contained" 
          onPress={() => onEditUsuario(item)}
          style={styles.editButton}
          labelStyle={styles.buttonLabel}
          icon="pencil"
        >
          Editar
        </Button>
        <Button 
          mode="outlined" 
          onPress={() => confirmDeleteUser(item)}
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

  const getRoleColor = (rol: string) => {
    switch (rol) {
      case 'administrador': return '#FF6B35';
      case 'entrenador': return '#00AA00';
      case 'analista': return '#0a7cff';
      default: return '#666';
    }
  };

  // ───────────────────────────────
  // Filter dialog actions
  // ───────────────────────────────
  const openFilterDialog = () => {
    setDialogRole(rolFilter);
    setDialogEquipos([...equiposFilter]);
    setFilterDialogVisible(true);
  };

  const applyFiltersFromDialog = () => {
    setRolFilter(dialogRole);
    setEquiposFilter([...dialogEquipos]);
    setFilterDialogVisible(false);
  };

  const resetFiltersFromDialog = () => {
    setDialogRole(null);
    setDialogEquipos([]);
  };

  // ───────────────────────────────
  // Delete user using Edge Function
  // ───────────────────────────────
  const confirmDeleteUser = (usuario?: Usuario) => {
    const userToDelete = usuario || usuarioInfo;
    if (!userToDelete) return;
    if (Platform.OS === 'web') {
      const confirmar = window.confirm(
        `¿Estás seguro de eliminar a ${userToDelete.nombre}?\n\nEsta acción eliminará el usuario de Auth y de la base de datos. Esta acción no se puede deshacer.`
      );
      if (confirmar) {
        handleDeleteUser(userToDelete);
      }
    } else {
      Alert.alert(
        "Confirmar eliminación",
        `¿Estás seguro de eliminar a ${userToDelete.nombre}?\n\nEsta acción eliminará el usuario de Auth y de la base de datos. Esta acción no se puede deshacer.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => handleDeleteUser(userToDelete),
          },
        ]
      );
    }
  };

  const handleDeleteUser = async (u: Usuario) => {
    if (!u) return;
    setProcessingDelete(true);
    try {
      // Llamar a Edge Function para eliminar de Auth y BD
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa");

      const { data, error: edgeError } = await supabase.functions.invoke("delete-user", {
        body: { userId: u.id },
      });

      if (edgeError) {
        console.error("Error completo de Edge Function:", JSON.stringify(edgeError, null, 2));
        
        // Intentar obtener más detalles del error
        let errorMessage = edgeError.message || "Error desconocido";
        
        // Si el error contiene información del status code, mostrarla
        if ((edgeError as any).context?.status) {
          errorMessage = `Error ${(edgeError as any).context.status}: ${errorMessage}`;
        }
        
        console.warn("Intentando eliminar directamente de BD como fallback...");
        
        // Intentar eliminar directamente de la BD si falla la Edge Function
        const { error: directDeleteError } = await supabase
          .from("usuarios")
          .delete()
          .eq("id", u.id);
        
        if (directDeleteError) {
          throw new Error(
            `Error al eliminar usuario.\n\n` +
            `Edge Function: ${errorMessage}\n` +
            `BD directa: ${directDeleteError.message}\n\n` +
            `Verifica que la Edge Function 'delete-user' esté desplegada en Supabase.`
          );
        } else {
          // Si se eliminó de la BD, mostrar advertencia pero continuar
          if (Platform.OS === 'web') {
            window.alert(
              "⚠️ Advertencia\n\nUsuario eliminado de la base de datos, pero puede que aún exista en Auth.\n\n" +
              "Esto puede deberse a que la Edge Function no está desplegada o hay un error en ella.\n\n" +
              `Error: ${errorMessage}`
            );
          } else {
            Alert.alert(
              "Advertencia",
              "Usuario eliminado de la base de datos, pero puede que aún exista en Auth.\n\n" +
              "Esto puede deberse a que la Edge Function no está desplegada o hay un error en ella.\n\n" +
              `Error: ${errorMessage}`
            );
          }
        }
      } else {
        // Éxito completo
        if (Platform.OS === 'web') {
          window.alert("✅ Usuario eliminado correctamente de Auth y base de datos.");
        } else {
          Alert.alert("Éxito", "Usuario eliminado correctamente de Auth y base de datos.");
        }
      }

      // Cerrar modal si está abierto
      if (dialogVisible) {
        setDialogVisible(false);
        setUsuarioInfo(null);
      }

      // Refrescar lista inmediatamente
      await fetchData();
    } catch (err: any) {
      console.error("Error al eliminar usuario:", err);
      if (Platform.OS === 'web') {
        window.alert(`❌ Error al eliminar\n\n${err?.message || String(err)}`);
      } else {
        Alert.alert("Error al eliminar", err?.message || String(err));
      }
    } finally {
      setProcessingDelete(false);
    }
  };

  // ───────────────────────────────
  // UI
  // ───────────────────────────────
  return (
    <View style={styles.container}>
      <HeaderLogo />
      <ScrollView 
        {...(Platform.OS === 'web' ? { 'data-scrollview-web': true } : {})}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: Platform.OS === 'web' ? 100 : 40 }}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Crear usuario arriba */}
        <Button
          mode="contained"
          style={styles.createButton}
          onPress={() => navigation.navigate("CrearUsuario", { mode: "usuario" })}
          icon="account-plus"
          labelStyle={styles.createButtonLabel}
        >
          Crear usuario
        </Button>

        {/* Search + Filter in one row */}
        <View style={styles.searchContainer}>
          <TextInput
            mode="outlined"
            placeholder="Buscar por nombre o correo"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            left={<TextInput.Icon icon="magnify" />}
            theme={{ colors: { primary: '#00AA00', text: '#000', placeholder: '#666', background: '#fff' } }}
          />
          <Button 
            mode="outlined" 
            onPress={openFilterDialog}
            style={styles.filterButton}
            labelStyle={styles.filterButtonLabel}
            icon="filter"
          >
            Filtrar
          </Button>
        </View>

        {/* Rol chips */}
        <View style={styles.row}>
          {["admin", "entrenador", "analista"].map((rol) => (
            <Chip
              key={rol}
              selected={rolFilter === rol}
              onPress={() => setRolFilter(rolFilter === rol ? null : rol)}
              style={[
                styles.roleChip,
                rolFilter === rol && { backgroundColor: getRoleColor(rol) }
              ]}
              textStyle={styles.roleChipText}
            >
              {rol} ({roleCounts[rol] || 0})
            </Chip>
          ))}

          {equiposFilter.length > 0 && (
            <View style={styles.equiposFilterBadge}>
              <Text style={styles.equiposFilterText}>Equipos: {equiposFilter.length}</Text>
              <IconButton
                icon="close"
                size={18}
                iconColor="#fff"
                onPress={() => {
                  setEquiposFilter([]);
                  setRolFilter(null);
                }}
              />
            </View>
          )}
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00AA00" />
          </View>
        ) : filteredUsuarios.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color="#666" />
            <Text style={styles.emptyText}>No hay usuarios que coincidan</Text>
          </View>
        ) : (
          <View>
            {filteredUsuarios.map((item) => (
              <View key={item.id}>
                {renderItem({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Filter Dialog */}
      <Portal>
        <Dialog 
          visible={filterDialogVisible} 
          onDismiss={() => setFilterDialogVisible(false)}
          style={{ backgroundColor: "#121212" }}
        >
          <Dialog.Title style={{ color: "#fff" }}>Filtrar usuarios</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12, color: "#fff", fontSize: 16, fontWeight: "600" }}>Rol</Text>
            <ScrollView style={{ maxHeight: 160, marginBottom: 16 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {["admin", "entrenador", "analista"].map((r) => (
                  <Chip
                    key={r}
                    selected={dialogRole === r}
                    onPress={() => setDialogRole(dialogRole === r ? null : r)}
                    style={[
                      styles.filterChip,
                      dialogRole === r && { backgroundColor: getRoleColor(r) }
                    ]}
                    textStyle={styles.filterChipText}
                  >
                    {r} ({roleCounts[r] || 0})
                  </Chip>
                ))}
              </View>
            </ScrollView>

            <MultiSelectDropdown
              label="Equipos"
              items={teams.map((t) => ({ label: t.nombre, value: t.id }))}
              selectedValues={dialogEquipos}
              onValueChange={(vals) => setDialogEquipos(vals)}
              searchable
              searchPlaceholder="Buscar equipos..."
            />
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button 
              onPress={resetFiltersFromDialog}
              textColor="#fff"
            >
              Reset
            </Button>
            <Button 
              onPress={() => setFilterDialogVisible(false)}
              textColor="#fff"
            >
              Cancelar
            </Button>
            <Button 
              mode="contained"
              onPress={applyFiltersFromDialog}
              style={{ backgroundColor: "#00AA00" }}
              labelStyle={{ color: "#fff" }}
            >
              Aplicar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Info Dialog */}
      <Portal>
        <Dialog 
          visible={dialogVisible} 
          onDismiss={closeInfo}
          style={{ backgroundColor: "#121212" }}
        >
          <Dialog.Title style={{ color: "#fff" }}>Información del Usuario</Dialog.Title>
          <Dialog.Content>
            <ScrollView>
              {usuarioInfo && (
                <>
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Nombre</Text>
                    <Text style={styles.infoValue}>{usuarioInfo.nombre}</Text>
                  </View>
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Correo</Text>
                    <Text style={styles.infoValue}>{usuarioInfo.correo}</Text>
                  </View>
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Rol principal</Text>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(usuarioInfo.rol_principal || '') }]}>
                      <Text style={styles.roleBadgeText}>{usuarioInfo.rol_principal || 'N/A'}</Text>
                    </View>
                  </View>
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Roles secundarios</Text>
                    <Text style={styles.infoValue}>
                      {usuarioInfo.roles?.join(", ") || "Ninguno"}
                    </Text>
                  </View>
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Categorías</Text>
                    <Text style={styles.infoValue}>
                      {categorias
                        .filter((c) =>
                          (Array.isArray(usuarioInfo.categoria_id)
                            ? usuarioInfo.categoria_id
                            : [usuarioInfo.categoria_id]
                          ).includes(c.id)
                        )
                        .map((c) => c.nombre)
                        .join(", ") || "Ninguna"}
                    </Text>
                  </View>
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Equipos</Text>
                    <Text style={styles.infoValue}>
                      {teams
                        .filter((t) =>
                          (Array.isArray(usuarioInfo.equipo_id)
                            ? usuarioInfo.equipo_id
                            : [usuarioInfo.equipo_id]
                          ).includes(t.id)
                        )
                        .map((t) => t.nombre)
                        .join(", ") || "Ninguno"}
                    </Text>
                  </View>

                  {!mostrarStats ? (
                    <Button
                      mode="contained"
                      onPress={cargarEstadisticas}
                      style={{ 
                        marginTop: 16, 
                        backgroundColor: "#00AA00",
                        paddingVertical: 8,
                      }}
                      labelStyle={{ color: "#fff" }}
                      icon="chart-bar"
                    >
                      Ver Estadísticas
                    </Button>
                  ) : (
                    <View style={styles.statsSection}>
                      {statsLoading ? (
                        <View style={styles.statsLoading}>
                          <ActivityIndicator size="small" color="#00AA00" />
                          <Text style={{ color: "#aaa", marginTop: 8 }}>Cargando estadísticas...</Text>
                        </View>
                      ) : stats ? (
                        <>
                          <Subheading style={{ color: "#fff", marginBottom: 12 }}>📊 Estadísticas</Subheading>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Entrenador:</Text>
                            <Text style={styles.statValue}>
                              {stats.entrenadorTotal} totales / {stats.entrenadorMes} este mes
                            </Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Analista:</Text>
                            <Text style={styles.statValue}>
                              {stats.analistaTotal} totales / {stats.analistaMes} este mes
                            </Text>
                          </View>
                        </>
                      ) : null}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button 
              onPress={closeInfo}
              textColor="#fff"
            >
              Cerrar
            </Button>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                mode="contained"
                onPress={() => confirmDeleteUser()}
                loading={processingDelete}
                style={{ backgroundColor: "#d32f2f" }}
                labelStyle={{ color: "#fff" }}
                icon="delete"
              >
                Eliminar
              </Button>
              <Button 
                mode="contained"
                onPress={() => {
                  if (usuarioInfo) {
                    closeInfo();
                    onEditUsuario(usuarioInfo);
                  }
                }}
                style={{ backgroundColor: "#00AA00" }}
                labelStyle={{ color: "#fff" }}
                icon="pencil"
              >
                Editar
              </Button>
            </View>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

export default GestionUsuarios;

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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    height: 50,
  },
  filterButton: {
    borderColor: "#666",
    borderWidth: 1,
  },
  filterButtonLabel: {
    color: "#fff",
  },
  row: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  roleChip: {
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#333",
  },
  roleChipText: {
    color: "#fff",
    fontSize: 13,
  },
  equiposFilterBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  equiposFilterText: {
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
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 18,
    color: "#fff",
    marginBottom: 4,
  },
  cardEmail: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 12,
  },
  cardButtons: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
    flexWrap: "wrap",
  },
  infoButton: {
    flex: 1,
    minWidth: 80,
    borderColor: "#0a7cff",
  },
  editButton: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#00AA00",
  },
  deleteButton: {
    flex: 1,
    minWidth: 80,
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
  infoSection: {
    marginBottom: 16,
  },
  infoLabel: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  infoValue: {
    color: "#fff",
    fontSize: 16,
  },
  statsSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#1F1F1F",
    borderRadius: 8,
  },
  statItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statLabel: {
    color: "#aaa",
    fontSize: 14,
  },
  statValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  statsLoading: {
    padding: 20,
    alignItems: "center",
  },
  filterChip: {
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#333",
  },
  filterChipText: {
    color: "#fff",
    fontSize: 13,
  },
});
