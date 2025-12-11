import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  Platform,
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
  creado_en?: string;
};

type Categoria = {
  id: string;
  nombre: string;
  equipo_id: string;
  creado_en?: string;
};

const GestionEquipos = () => {
  const navigation = useNavigation<any>();

  const [equipos, setEquipos] = useState<Team[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  // Dialog para equipo
  const [equipoDialogVisible, setEquipoDialogVisible] = useState(false);
  const [equipoEditId, setEquipoEditId] = useState<string | null>(null);
  const [equipoNombre, setEquipoNombre] = useState("");
  const [escudoLocalUri, setEscudoLocalUri] = useState<string | null>(null);
  const [escudoUrl, setEscudoUrl] = useState<string | null>(null);
  const [uploadingEscudo, setUploadingEscudo] = useState(false);
  const [canales, setCanales] = useState<any[]>([]);
  const [canalSeleccionado, setCanalSeleccionado] = useState<string | null>(null);

  // Dialog para categoría
  const [categoriaDialogVisible, setCategoriaDialogVisible] = useState(false);
  const [categoriaEditId, setCategoriaEditId] = useState<string | null>(null);
  const [categoriaNombre, setCategoriaNombre] = useState("");
  const [categoriaEquipoId, setCategoriaEquipoId] = useState<string | null>(null);

  // Info dialog
  const [infoDialogVisible, setInfoDialogVisible] = useState(false);
  const [equipoInfo, setEquipoInfo] = useState<Team | null>(null);
  const [equipoCategorias, setEquipoCategorias] = useState<Categoria[]>([]);

  const [processingDelete, setProcessingDelete] = useState(false);

  // ───────────────────────────────
  // Load equipos y categorias
  // ───────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: equiposData, error: equiposError } = await supabase
        .from("teams")
        .select("*")
        .order("nombre", { ascending: true });
      if (equiposError) throw equiposError;

      const { data: categoriasData, error: categoriasError } = await supabase
        .from("categorias")
        .select("*")
        .order("nombre", { ascending: true });
      if (categoriasError) throw categoriasError;

      setEquipos(equiposData || []);
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

  // Refrescar datos cuando se vuelve a la pantalla
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  // Actualizar categorías del equipo cuando cambien las categorías y el diálogo esté abierto
  useEffect(() => {
    if (infoDialogVisible && equipoInfo) {
      const categoriasDelEquipo = categorias.filter((c) => c.equipo_id === equipoInfo.id);
      setEquipoCategorias(categoriasDelEquipo);
    }
  }, [categorias, infoDialogVisible, equipoInfo]);

  // ───────────────────────────────
  // Apply filters (client-side)
  // ───────────────────────────────
  const filteredEquipos = useMemo(() => {
    return equipos.filter((e) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || e.nombre?.toLowerCase().includes(q);
      return matchSearch;
    });
  }, [equipos, search]);

  // ───────────────────────────────
  // Estadísticas: categorías por equipo
  // ───────────────────────────────
  const categoriasPorEquipo = useMemo(() => {
    const counts: Record<string, number> = {};
    categorias.forEach((c) => {
      counts[c.equipo_id] = (counts[c.equipo_id] || 0) + 1;
    });
    return counts;
  }, [categorias]);

  // ───────────────────────────────
  // Cargar canales de YouTube
  // ───────────────────────────────
  const cargarCanales = async () => {
    try {
      const { data } = await supabase
        .from('youtube_canales')
        .select('id, nombre_canal')
        .eq('activo', true)
        .order('nombre_canal', { ascending: true });
      setCanales(data || []);
    } catch (e: any) {
      console.error('Error al cargar canales:', e);
    }
  };

  // ───────────────────────────────
  // Equipo: Abrir crear/editar
  // ───────────────────────────────
  const abrirCrearEquipo = async () => {
    setEquipoEditId(null);
    setEquipoNombre("");
    setEscudoLocalUri(null);
    setEscudoUrl(null);
    setCanalSeleccionado(null);
    await cargarCanales();
    setEquipoDialogVisible(true);
  };

  const abrirEditarEquipo = async (equipo: Team) => {
    setEquipoEditId(equipo.id);
    setEquipoNombre(equipo.nombre || "");
    setEscudoUrl(equipo.escudo_url || null);
    setEscudoLocalUri(null);
    
    // Cargar canal del equipo
    try {
      const { data } = await supabase
        .from('teams')
        .select('youtube_canal_id')
        .eq('id', equipo.id)
        .single();
      setCanalSeleccionado(data?.youtube_canal_id || null);
    } catch (e: any) {
      console.error('Error al cargar canal del equipo:', e);
      setCanalSeleccionado(null);
    }
    
    await cargarCanales();
    setEquipoDialogVisible(true);
  };

  // ───────────────────────────────
  // Equipo: Seleccionar escudo
  // ───────────────────────────────
  const pickEscudo = async () => {
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
        setEscudoLocalUri(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // ───────────────────────────────
  // Equipo: Subir escudo
  // ───────────────────────────────
  const uploadEscudo = async (): Promise<string | null> => {
    if (!escudoLocalUri) return escudoUrl || null;

    try {
      setUploadingEscudo(true);
      
      // Verificar autenticación antes de subir
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
      }
      
      const filename = `teams/${Date.now()}-${Math.random()}.jpg`;
      const mimeType = "image/jpeg";
      
      // Eliminar escudo anterior si existe
      if (escudoUrl && equipoEditId) {
        const oldFilename = escudoUrl.split("/").pop();
        if (oldFilename) {
          try {
            // Intentar eliminar el archivo anterior
            const oldPath = oldFilename.includes("teams/") ? oldFilename : `teams/${oldFilename}`;
            await supabase.storage.from("videos1").remove([oldPath]);
          } catch (removeError) {
            console.warn("Error eliminando escudo anterior:", removeError);
            // Continuar aunque falle la eliminación
          }
        }
      }

      // Usar método diferenciado por plataforma (como en SubirVideo y SubirAnalisis)
      if (Platform.OS === "web") {
        // Para web, usar fetch y blob
        const resp = await fetch(escudoLocalUri);
        const blob = await resp.blob();
        const { error } = await supabase.storage
          .from("videos1")
          .upload(filename, blob, { contentType: mimeType, upsert: false });
        if (error) throw error;
      } else {
        // Para móvil, usar FileSystem y base64 (método correcto para ImagePicker)
        const base64Data = await FileSystem.readAsStringAsync(escudoLocalUri, {
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
      console.error("Error subiendo escudo:", error);
      throw error;
    } finally {
      setUploadingEscudo(false);
    }
  };

  // ───────────────────────────────
  // Equipo: Guardar (optimizado)
  // ───────────────────────────────
  const guardarEquipo = async () => {
    if (!equipoNombre.trim()) {
      if (Platform.OS === 'web') {
        window.alert('❌ Error\n\nEl nombre del equipo es obligatorio');
      } else {
        Alert.alert("Error", "El nombre del equipo es obligatorio");
      }
      return;
    }

    try {
      setLoading(true);
      
      // Crear payload base inmediatamente
      const payload: any = { nombre: equipoNombre.trim() };
      if (canalSeleccionado) payload.youtube_canal_id = canalSeleccionado;

      // Subir escudo en paralelo si existe, pero no bloquear la creación
      let finalEscudo = escudoUrl || null;
      if (escudoLocalUri) {
        // Subir escudo en background, no bloquear
        uploadEscudo().then((url) => {
          if (url && equipoEditId) {
            // Actualizar escudo después si es edición
            supabase.from("teams")
              .update({ escudo_url: url })
              .eq("id", equipoEditId)
              .then(() => fetchData());
          }
        }).catch((err) => {
          console.warn("Error subiendo escudo (no crítico):", err);
        });
      }

      // Guardar inmediatamente sin esperar la foto
      if (equipoEditId) {
        const { error } = await supabase
          .from("teams")
          .update(payload)
          .eq("id", equipoEditId);
        if (error) throw error;
        if (Platform.OS === 'web') {
          window.alert('✅ Equipo actualizado correctamente');
        } else {
          Alert.alert("Éxito", "Equipo actualizado correctamente");
        }
      } else {
        const { error } = await supabase.from("teams").insert(payload);
        if (error) throw error;
        if (Platform.OS === 'web') {
          window.alert('✅ Equipo creado correctamente');
        } else {
          Alert.alert("Éxito", "Equipo creado correctamente");
        }
      }

      setEquipoDialogVisible(false);
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
  // Equipo: Eliminar
  // ───────────────────────────────
  const confirmDeleteEquipo = (equipo: Team) => {
    // Verificar si tiene categorías
    const categoriasDelEquipo = categorias.filter((c) => c.equipo_id === equipo.id);
    if (categoriasDelEquipo.length > 0) {
      if (Platform.OS === 'web') {
        window.alert(
          `⚠️ No se puede eliminar\n\nEste equipo tiene ${categoriasDelEquipo.length} categoría(s) asociada(s). Por favor, elimina primero las categorías antes de eliminar el equipo.`
        );
      } else {
        Alert.alert(
          "No se puede eliminar",
          `Este equipo tiene ${categoriasDelEquipo.length} categoría(s) asociada(s). Por favor, elimina primero las categorías antes de eliminar el equipo.`
        );
      }
      return;
    }

    if (Platform.OS === 'web') {
      const confirmar = window.confirm(
        `¿Estás seguro de eliminar el equipo "${equipo.nombre}"?\n\nEsta acción no se puede deshacer.`
      );
      if (confirmar) {
        handleDeleteEquipo(equipo);
      }
    } else {
      Alert.alert(
        "Confirmar eliminación",
        `¿Estás seguro de eliminar el equipo "${equipo.nombre}"?\n\nEsta acción no se puede deshacer.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => handleDeleteEquipo(equipo),
          },
        ]
      );
    }
  };

  const handleDeleteEquipo = async (equipo: Team) => {
    setProcessingDelete(true);
    try {
      // Eliminar escudo del storage si existe
      if (equipo.escudo_url) {
        const filename = equipo.escudo_url.split("/").pop();
        if (filename) {
          try {
            // La ruta puede ser teams/filename o solo filename
            const pathToRemove = filename.includes("teams/") ? filename : `teams/${filename}`;
            await supabase.storage.from("videos1").remove([pathToRemove]);
          } catch (removeError) {
            console.warn("Error eliminando escudo:", removeError);
            // Continuar aunque falle la eliminación
          }
        }
      }

      const { error } = await supabase.from("teams").delete().eq("id", equipo.id);
      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert("✅ Equipo eliminado correctamente");
      } else {
        Alert.alert("Éxito", "Equipo eliminado correctamente");
      }
      if (infoDialogVisible) {
        setInfoDialogVisible(false);
        setEquipoInfo(null);
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
  // Categoría: Abrir crear/editar
  // ───────────────────────────────
  const abrirCrearCategoria = (equipoId: string) => {
    setCategoriaEditId(null);
    setCategoriaNombre("");
    setCategoriaEquipoId(equipoId);
    setCategoriaDialogVisible(true);
  };

  const abrirEditarCategoria = (categoria: Categoria) => {
    setCategoriaEditId(categoria.id);
    setCategoriaNombre(categoria.nombre || "");
    setCategoriaEquipoId(categoria.equipo_id);
    setCategoriaDialogVisible(true);
  };

  // ───────────────────────────────
  // Categoría: Guardar
  // ───────────────────────────────
  const guardarCategoria = async () => {
    if (!categoriaNombre.trim()) {
      Alert.alert("Error", "El nombre de la categoría es obligatorio");
      return;
    }

    if (!categoriaEquipoId) {
      Alert.alert("Error", "Debes seleccionar un equipo");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        nombre: categoriaNombre.trim(),
        equipo_id: categoriaEquipoId,
      };

      if (categoriaEditId) {
        const { error } = await supabase
          .from("categorias")
          .update(payload)
          .eq("id", categoriaEditId);
        if (error) throw error;
        Alert.alert("Éxito", "Categoría actualizada correctamente");
      } else {
        const { error } = await supabase.from("categorias").insert(payload);
        if (error) throw error;
        Alert.alert("Éxito", "Categoría creada correctamente");
      }

      setCategoriaDialogVisible(false);
      await fetchData();
    } catch (err: any) {
      Alert.alert("Error", err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // ───────────────────────────────
  // Categoría: Eliminar
  // ───────────────────────────────
  const confirmDeleteCategoria = (categoria: Categoria) => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm(
        `¿Estás seguro de eliminar la categoría "${categoria.nombre}"?\n\nEsta acción no se puede deshacer.`
      );
      if (confirmar) {
        handleDeleteCategoria(categoria);
      }
    } else {
      Alert.alert(
        "Confirmar eliminación",
        `¿Estás seguro de eliminar la categoría "${categoria.nombre}"?\n\nEsta acción no se puede deshacer.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => handleDeleteCategoria(categoria),
          },
        ]
      );
    }
  };

  const handleDeleteCategoria = async (categoria: Categoria) => {
    setProcessingDelete(true);
    try {
      const { error } = await supabase
        .from("categorias")
        .delete()
        .eq("id", categoria.id);
      if (error) throw error;

      // Si el diálogo de información está abierto y la categoría eliminada pertenece al equipo mostrado,
      // actualizar la lista de categorías del equipo inmediatamente
      if (infoDialogVisible && equipoInfo && categoria.equipo_id === equipoInfo.id) {
        const categoriasActualizadas = equipoCategorias.filter((c) => c.id !== categoria.id);
        setEquipoCategorias(categoriasActualizadas);
      }

      if (Platform.OS === 'web') {
        window.alert("✅ Categoría eliminada correctamente");
      } else {
        Alert.alert("Éxito", "Categoría eliminada correctamente");
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
  // Info: Abrir modal con categorías del equipo
  // ───────────────────────────────
  const openInfo = (equipo: Team) => {
    setEquipoInfo(equipo);
    const categoriasDelEquipo = categorias.filter((c) => c.equipo_id === equipo.id);
    setEquipoCategorias(categoriasDelEquipo);
    setInfoDialogVisible(true);
  };

  const closeInfo = () => {
    setInfoDialogVisible(false);
    setEquipoInfo(null);
    setEquipoCategorias([]);
  };

  // ───────────────────────────────
  // Render item
  // ───────────────────────────────
  const renderItem = ({ item }: { item: Team }) => {
    const categoriasCount = categoriasPorEquipo[item.id] || 0;
    const categoriasDelEquipo = categorias.filter((c) => c.equipo_id === item.id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {item.escudo_url && (
              <Image source={{ uri: item.escudo_url }} style={styles.escudoImage} />
            )}
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>{item.nombre}</Text>
              <Chip
                style={styles.categoriaChip}
                textStyle={styles.categoriaChipText}
              >
                {categoriasCount} categoría{categoriasCount !== 1 ? "s" : ""}
              </Chip>
            </View>
          </View>
        </View>

        {categoriasDelEquipo.length > 0 && (
          <View style={styles.categoriasPreview}>
            <Text style={styles.categoriasPreviewLabel}>Categorías:</Text>
            <View style={styles.categoriasPreviewList}>
              {categoriasDelEquipo.slice(0, 3).map((cat) => (
                <Chip key={cat.id} style={styles.categoriaTag} textStyle={styles.categoriaTagText}>
                  {cat.nombre}
                </Chip>
              ))}
              {categoriasDelEquipo.length > 3 && (
                <Text style={styles.moreText}>+{categoriasDelEquipo.length - 3} más</Text>
              )}
            </View>
          </View>
        )}

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
            onPress={() => abrirEditarEquipo(item)}
            style={styles.editButton}
            labelStyle={styles.buttonLabel}
            icon="pencil"
          >
            Editar
          </Button>
          <Button
            mode="outlined"
            onPress={() => confirmDeleteEquipo(item)}
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
        {/* Crear equipo arriba */}
        <Button
          mode="contained"
          style={styles.createButton}
          onPress={abrirCrearEquipo}
          icon="account-plus"
          labelStyle={styles.createButtonLabel}
        >
          Crear equipo
        </Button>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            mode="outlined"
            placeholder="Buscar por nombre de equipo"
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
            Total equipos: {equipos.length}
          </Chip>
          <Chip style={styles.statChip} textStyle={styles.statChipText}>
            Total categorías: {categorias.length}
          </Chip>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00AA00" />
          </View>
        ) : filteredEquipos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color="#666" />
            <Text style={styles.emptyText}>
              {search ? "No hay equipos que coincidan" : "No hay equipos registrados"}
            </Text>
          </View>
        ) : (
          <View>
            {filteredEquipos.map((item) => (
              <View key={item.id}>{renderItem({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Dialog: Crear/Editar Equipo */}
      <Portal>
        <Dialog
          visible={equipoDialogVisible}
          onDismiss={() => setEquipoDialogVisible(false)}
          style={{ backgroundColor: "#121212" }}
        >
          <Dialog.Title style={{ color: "#fff" }}>
            {equipoEditId ? "Editar equipo" : "Crear equipo"}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Nombre del equipo"
              value={equipoNombre}
              onChangeText={setEquipoNombre}
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
            <View style={{ height: 16 }} />
            <Button
              mode="outlined"
              onPress={pickEscudo}
              style={styles.escudoButton}
              labelStyle={{ color: "#fff" }}
              icon="image"
            >
              {escudoLocalUri || escudoUrl ? "Cambiar escudo" : "Seleccionar escudo"}
            </Button>
            {(escudoLocalUri || escudoUrl) && (
              <View style={styles.escudoPreview}>
                <Image
                  source={{ uri: escudoLocalUri || escudoUrl || "" }}
                  style={styles.escudoPreviewImage}
                />
              </View>
            )}
            {uploadingEscudo && (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color="#00AA00" />
                <Text style={{ color: "#aaa", marginTop: 8 }}>Subiendo escudo...</Text>
              </View>
            )}
            <View style={{ height: 16 }} />
            {canales.length === 0 ? (
              <Text style={{ color: "#aaa", fontSize: 12, marginBottom: 8 }}>
                No hay canales disponibles. Crea uno en "Gestión de Canales YouTube".
              </Text>
            ) : (
              <MultiSelectDropdown
                label="Canal de YouTube (Opcional)"
                items={[
                  { label: "Sin canal", value: "null" },
                  ...canales.map((c) => ({ label: c.nombre_canal, value: c.id })),
                ]}
                selectedValues={canalSeleccionado ? [canalSeleccionado] : ["null"]}
                onValueChange={(selected) => {
                  const valor = selected[0];
                  setCanalSeleccionado(valor === "null" ? null : valor);
                }}
                singleSelect={true}
                searchable={true}
                searchPlaceholder="Buscar canal..."
              />
            )}
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button onPress={() => setEquipoDialogVisible(false)} textColor="#fff">
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={guardarEquipo}
              loading={loading}
              style={{ backgroundColor: "#00AA00" }}
              labelStyle={{ color: "#fff" }}
            >
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog: Crear/Editar Categoría */}
      <Portal>
        <Dialog
          visible={categoriaDialogVisible}
          onDismiss={() => setCategoriaDialogVisible(false)}
          style={{ backgroundColor: "#121212" }}
        >
          <Dialog.Title style={{ color: "#fff" }}>
            {categoriaEditId ? "Editar categoría" : "Crear categoría"}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Nombre de la categoría"
              value={categoriaNombre}
              onChangeText={setCategoriaNombre}
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
            <View style={{ height: 16 }} />
            {categoriaEquipoId ? (
              <View style={styles.equipoSeleccionadoContainer}>
                <Text style={{ color: "#fff", marginBottom: 8, fontSize: 14, fontWeight: "600" }}>
                  Equipo seleccionado:
                </Text>
                <Chip
                  style={styles.equipoSeleccionadoChip}
                  textStyle={styles.equipoSeleccionadoChipText}
                >
                  {equipos.find((e) => e.id === categoriaEquipoId)?.nombre || "No seleccionado"}
                </Chip>
              </View>
            ) : (
              <>
                <Text style={{ color: "#aaa", marginBottom: 8, fontSize: 12 }}>
                  Selecciona un equipo:
                </Text>
                <View style={styles.equiposList}>
                  {equipos.map((equipo) => (
                    <Chip
                      key={equipo.id}
                      selected={categoriaEquipoId === equipo.id}
                      onPress={() => setCategoriaEquipoId(equipo.id)}
                      style={[
                        styles.equipoChip,
                        categoriaEquipoId === equipo.id && { backgroundColor: "#00AA00" },
                      ]}
                      textStyle={styles.equipoChipText}
                    >
                      {equipo.nombre}
                    </Chip>
                  ))}
                </View>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button onPress={() => setCategoriaDialogVisible(false)} textColor="#fff">
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={guardarCategoria}
              loading={loading}
              style={{ backgroundColor: "#00AA00" }}
              labelStyle={{ color: "#fff" }}
            >
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Info Dialog */}
      <Portal>
        <Dialog
          visible={infoDialogVisible}
          onDismiss={closeInfo}
          style={{ backgroundColor: "#121212" }}
        >
          <Dialog.Title style={{ color: "#fff" }}>Información del Equipo</Dialog.Title>
          <Dialog.Content>
            <ScrollView>
              {equipoInfo && (
                <>
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Nombre</Text>
                    <Text style={styles.infoValue}>{equipoInfo.nombre}</Text>
                  </View>
                  {equipoInfo.escudo_url && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Escudo</Text>
                      <Image
                        source={{ uri: equipoInfo.escudo_url }}
                        style={styles.infoEscudoImage}
                      />
                    </View>
                  )}
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Categorías ({equipoCategorias.length})</Text>
                    {equipoCategorias.length === 0 ? (
                      <Text style={styles.infoValue}>No hay categorías</Text>
                    ) : (
                      <View style={styles.categoriasList}>
                        {equipoCategorias.map((cat) => (
                          <View key={cat.id} style={styles.categoriaItem}>
                            <Text style={styles.categoriaItemText}>{cat.nombre}</Text>
                            <View style={styles.categoriaItemActions}>
                              <IconButton
                                icon="pencil"
                                size={18}
                                iconColor="#00AA00"
                                onPress={() => {
                                  closeInfo();
                                  abrirEditarCategoria(cat);
                                }}
                              />
                              <IconButton
                                icon="delete"
                                size={18}
                                iconColor="#d32f2f"
                                onPress={() => confirmDeleteCategoria(cat)}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <Button
                    mode="contained"
                    onPress={() => {
                      closeInfo();
                      abrirCrearCategoria(equipoInfo.id);
                    }}
                    style={{
                      marginTop: 16,
                      backgroundColor: "#00AA00",
                      paddingVertical: 8,
                    }}
                    labelStyle={{ color: "#fff" }}
                    icon="plus"
                  >
                    Agregar Categoría
                  </Button>
                </>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button onPress={closeInfo} textColor="#fff">
              Cerrar
            </Button>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                mode="contained"
                onPress={() => {
                  if (equipoInfo) {
                    closeInfo();
                    confirmDeleteEquipo(equipoInfo);
                  }
                }}
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
                  if (equipoInfo) {
                    closeInfo();
                    abrirEditarEquipo(equipoInfo);
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

export default GestionEquipos;

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
  escudoImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  categoriaChip: {
    backgroundColor: "#00AA00",
    alignSelf: "flex-start",
  },
  categoriaChipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  categoriasPreview: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  categoriasPreviewLabel: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  categoriasPreviewList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  categoriaTag: {
    backgroundColor: "#333",
  },
  categoriaTagText: {
    color: "#fff",
    fontSize: 11,
  },
  moreText: {
    color: "#aaa",
    fontSize: 11,
    fontStyle: "italic",
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
  dialogInput: {
    backgroundColor: "#fff",
  },
  equipoSeleccionadoContainer: {
    marginTop: 8,
  },
  equipoSeleccionadoChip: {
    backgroundColor: "#00AA00",
    alignSelf: "flex-start",
  },
  equipoSeleccionadoChipText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  escudoButton: {
    borderColor: "#666",
  },
  escudoPreview: {
    marginTop: 12,
    alignItems: "center",
  },
  escudoPreviewImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#333",
  },
  uploadingContainer: {
    marginTop: 12,
    alignItems: "center",
  },
  equiposList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  equipoChip: {
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#333",
  },
  equipoChipText: {
    color: "#fff",
    fontSize: 12,
    flexWrap: "wrap",
    flexShrink: 1,
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
    flexWrap: "wrap",
    flexShrink: 1,
  },
  infoEscudoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#333",
    marginTop: 8,
  },
  categoriasList: {
    marginTop: 8,
  },
  categoriaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoriaItemText: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
  },
  categoriaItemActions: {
    flexDirection: "row",
  },
});
