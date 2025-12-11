import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Text, Button, Card, Chip, Divider } from 'react-native-paper';
import { supabase } from '../../utils/supabase';
import { obtenerRefreshTokenParaCanal } from '../../utils/youtubeSetup';

type CanalYouTube = {
  id: string;
  channel_id: string;
  nombre_canal: string;
  activo: boolean;
  creado_en?: string;
};

export default function GestionCanalesYouTube() {
  const [canales, setCanales] = useState<CanalYouTube[]>([]);
  const [loading, setLoading] = useState(false);
  const [agregando, setAgregando] = useState(false);

  useEffect(() => {
    cargarCanales();
  }, []);

  const cargarCanales = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('youtube_canales')
        .select('id, channel_id, nombre_canal, activo, creado_en')
        .order('creado_en', { ascending: false });

      if (error) throw error;
      setCanales(data || []);
    } catch (error: any) {
      console.error('Error cargando canales:', error);
      Alert.alert('Error', 'No se pudieron cargar los canales');
    } finally {
      setLoading(false);
    }
  };

  const agregarCanal = async () => {
    Alert.alert(
      'Agregar Canal de YouTube',
      'Se abrirá una ventana para autenticarte con Google. Asegúrate de iniciar sesión con la cuenta del canal que deseas agregar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: async () => {
            setAgregando(true);
            try {
              const result = await obtenerRefreshTokenParaCanal();
              
              Alert.alert(
                '✅ Canal agregado exitosamente',
                `Canal: ${result.channel_name}\nID: ${result.channel_id}`,
                [{ text: 'OK', onPress: () => cargarCanales() }]
              );
            } catch (error: any) {
              console.error('Error agregando canal:', error);
              Alert.alert(
                'Error',
                error.message || 'No se pudo agregar el canal. Verifica que hayas completado la autenticación correctamente.'
              );
            } finally {
              setAgregando(false);
            }
          },
        },
      ]
    );
  };

  const toggleActivo = async (canalId: string, activoActual: boolean) => {
    try {
      const { error } = await supabase
        .from('youtube_canales')
        .update({ activo: !activoActual })
        .eq('id', canalId);

      if (error) throw error;

      // Actualizar estado local
      setCanales(canales.map(c => 
        c.id === canalId ? { ...c, activo: !activoActual } : c
      ));

      Alert.alert(
        'Éxito',
        `Canal ${!activoActual ? 'activado' : 'desactivado'} correctamente`
      );
    } catch (error: any) {
      console.error('Error actualizando canal:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado del canal');
    }
  };

  const eliminarCanal = async (canalId: string, nombreCanal: string) => {
    Alert.alert(
      '⚠️ Eliminar Canal',
      `¿Estás seguro de que deseas eliminar el canal "${nombreCanal}"?\n\nEsta acción no se puede deshacer y los equipos asignados a este canal perderán la capacidad de subir videos a YouTube.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Verificar si hay equipos asignados a este canal
              const { data: equipos, error: equiposError } = await supabase
                .from('teams')
                .select('id, nombre')
                .eq('youtube_canal_id', canalId);

              if (equiposError) throw equiposError;

              if (equipos && equipos.length > 0) {
                Alert.alert(
                  '⚠️ No se puede eliminar',
                  `Este canal está asignado a ${equipos.length} equipo(s):\n${equipos.map(e => `- ${e.nombre}`).join('\n')}\n\nPrimero debes desasignar el canal de estos equipos.`,
                  [{ text: 'OK' }]
                );
                return;
              }

              // Eliminar el canal
              const { error } = await supabase
                .from('youtube_canales')
                .delete()
                .eq('id', canalId);

              if (error) throw error;

              Alert.alert('Éxito', 'Canal eliminado correctamente');
              cargarCanales();
            } catch (error: any) {
              console.error('Error eliminando canal:', error);
              Alert.alert('Error', 'No se pudo eliminar el canal');
            }
          },
        },
      ]
    );
  };

  if (loading && canales.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00AA00" />
        <Text style={styles.loadingText}>Cargando canales...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestión de Canales de YouTube</Text>
        <Text style={styles.subtitle}>
          Administra los canales de YouTube disponibles para asignar a equipos
        </Text>
      </View>

      <Button
        mode="contained"
        onPress={agregarCanal}
        loading={agregando}
        disabled={agregando}
        style={styles.botonAgregar}
        buttonColor="#00AA00"
        icon="plus"
      >
        {agregando ? 'Agregando canal...' : 'Agregar Nuevo Canal'}
      </Button>

      <Divider style={styles.divider} />

      {canales.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay canales registrados</Text>
          <Text style={styles.emptySubtext}>
            Presiona "Agregar Nuevo Canal" para comenzar
          </Text>
        </View>
      ) : (
        <View style={styles.listaCanales}>
          {canales.map((canal) => (
            <Card key={canal.id} style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.canalNombre}>{canal.nombre_canal}</Text>
                    <Chip
                      style={[
                        styles.chip,
                        canal.activo ? styles.chipActivo : styles.chipInactivo,
                      ]}
                      textStyle={styles.chipText}
                    >
                      {canal.activo ? 'Activo' : 'Inactivo'}
                    </Chip>
                  </View>
                </View>

                <View style={styles.canalInfo}>
                  <Text style={styles.canalInfoLabel}>ID del Canal:</Text>
                  <Text style={styles.canalInfoValue}>{canal.channel_id}</Text>
                </View>

                {canal.creado_en && (
                  <View style={styles.canalInfo}>
                    <Text style={styles.canalInfoLabel}>Agregado:</Text>
                    <Text style={styles.canalInfoValue}>
                      {new Date(canal.creado_en).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                )}

                <View style={styles.cardActions}>
                  <Button
                    mode={canal.activo ? 'outlined' : 'contained'}
                    onPress={() => toggleActivo(canal.id, canal.activo)}
                    style={styles.botonAccion}
                    buttonColor={canal.activo ? undefined : '#00AA00'}
                  >
                    {canal.activo ? 'Desactivar' : 'Activar'}
                  </Button>

                  <Button
                    mode="outlined"
                    onPress={() => eliminarCanal(canal.id, canal.nombre_canal)}
                    style={styles.botonAccion}
                    textColor="#d32f2f"
                  >
                    Eliminar
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  botonAgregar: {
    marginBottom: 20,
  },
  divider: {
    marginVertical: 20,
    backgroundColor: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  listaCanales: {
    gap: 16,
  },
  card: {
    backgroundColor: '#1F1F1F',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  canalNombre: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  chip: {
    height: 28,
  },
  chipActivo: {
    backgroundColor: '#00AA00',
  },
  chipInactivo: {
    backgroundColor: '#666',
  },
  chipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  canalInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  canalInfoLabel: {
    fontSize: 14,
    color: '#aaa',
    marginRight: 8,
    minWidth: 100,
  },
  canalInfoValue: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  botonAccion: {
    flex: 1,
  },
});



