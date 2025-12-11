import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert, FlatList, TouchableOpacity, Platform } from "react-native";
import { Text, Button, Dialog, Portal, TextInput, DataTable, ActivityIndicator } from "react-native-paper";
import { supabase } from "@/utils/supabase";
import { useNavigation } from "@react-navigation/native";

type Team = { id: number; nombre: string };
type Categoria = { id: number; nombre: string; equipo_id: number };

export default function GestionCategorias() {
  const navigation = useNavigation<any>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [list, setList] = useState<(Categoria & { team?: Team })[]>([]);
  const [loading, setLoading] = useState(false);

  const [visible, setVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [teamSelectVisible, setTeamSelectVisible] = useState(false);

  const cargarTeams = async () => {
    const { data, error } = await supabase.from("teams").select("id, nombre").order("nombre");
    if (!error) setTeams((data as any) || []);
  };

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("categorías").select("*, teams:teams(id, nombre)").order("nombre");
    setLoading(false);
    if (!error) setList((data as any) || []);
  };

  useEffect(() => {
    cargarTeams();
    cargar();
  }, []);

  const abrirCrear = () => { navigation.navigate("CrearUsuario", { mode: "categoria" }); };
  const abrirEditar = (c: Categoria) => { setEditId(c.id); setNombre(c.nombre || ""); setTeamId(c.equipo_id || null); setVisible(true); };

  const guardar = async () => {
    if (!nombre) return Alert.alert("Faltan datos", "El nombre es requerido");
    try {
      setLoading(true);
      const payload = { nombre, equipo_id: teamId };
      const q = editId ? supabase.from("categorías").update(payload).eq("id", editId) : supabase.from("categorías").insert(payload);
      const { error } = await q;
      setLoading(false);
      if (error) return Alert.alert("Error", error.message);
      setVisible(false);
      cargar();
    } catch (e: any) {
      setLoading(false);
      Alert.alert("Error", e.message);
    }
  };

  const eliminar = (id: number) => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm(
        `¿Estás seguro de eliminar la categoría?\n\nEsta acción no se puede deshacer.`
      );
      if (confirmar) {
        handleEliminar(id);
      }
    } else {
      Alert.alert("Confirmar", "¿Eliminar categoría?", [
        { text: "Cancelar" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => handleEliminar(id),
        },
      ]);
    }
  };

  const handleEliminar = async (id: number) => {
    try {
      setLoading(true);
      const { error } = await supabase.from("categorías").delete().eq("id", id);
      setLoading(false);
      if (error) {
        if (Platform.OS === 'web') {
          window.alert(`❌ Error\n\n${error.message}`);
        } else {
          Alert.alert("Error", error.message);
        }
        return;
      }
      if (Platform.OS === 'web') {
        window.alert("✅ Categoría eliminada correctamente");
      } else {
        Alert.alert("Éxito", "Categoría eliminada correctamente");
      }
      cargar();
    } catch (e: any) {
      setLoading(false);
      if (Platform.OS === 'web') {
        window.alert(`❌ Error\n\n${e.message}`);
      } else {
        Alert.alert("Error", e.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestión de Categorías</Text>

      <Button mode="contained" onPress={abrirCrear} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
        + Crear categoría
      </Button>

      {loading ? (
        <ActivityIndicator animating />
      ) : (
        <DataTable>
          <DataTable.Header>
            <DataTable.Title>Nombre</DataTable.Title>
            <DataTable.Title>Equipo</DataTable.Title>
            <DataTable.Title>Acciones</DataTable.Title>
          </DataTable.Header>

          {list.map((c) => (
            <DataTable.Row key={c.id}>
              <DataTable.Cell>{c.nombre}</DataTable.Cell>
              <DataTable.Cell>{c.team?.nombre || "-"}</DataTable.Cell>
              <DataTable.Cell>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button onPress={() => abrirEditar(c)}>Editar</Button>
                  <Button textColor="red" onPress={() => eliminar(c.id)}>Eliminar</Button>
                </View>
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable>
      )}

      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>{editId ? "Editar categoría" : "Crear categoría"}</Dialog.Title>
          <Dialog.Content>
            <TextInput 
              label="Nombre" 
              value={nombre} 
              onChangeText={setNombre}
              style={Platform.OS === 'web' ? { backgroundColor: '#fff' } : undefined}
              textColor={Platform.OS === 'web' ? '#000' : undefined}
              theme={{
                colors: {
                  primary: "#00AA00",
                  text: Platform.OS === 'web' ? "#000" : undefined,
                  placeholder: "#666",
                  background: Platform.OS === 'web' ? "#fff" : undefined,
                },
              }}
            />
            <View style={{ height: 8 }} />
            <TextInput 
              label="Equipo ID " 
              value={teamId ? String(teamId) : ""} 
              onChangeText={(t) => setTeamId(t ? Number(t) : null)}
              style={Platform.OS === 'web' ? { backgroundColor: '#fff' } : undefined}
              textColor={Platform.OS === 'web' ? '#000' : undefined}
              theme={{
                colors: {
                  primary: "#00AA00",
                  text: Platform.OS === 'web' ? "#000" : undefined,
                  placeholder: "#666",
                  background: Platform.OS === 'web' ? "#fff" : undefined,
                },
              }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)}>Cancelar</Button>
            <Button mode="contained" onPress={guardar} loading={loading}>Guardar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
});
