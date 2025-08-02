import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, Alert, Linking, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

type VideoItem = {
  id: string;
  tipo: string;
  descripcion: string;
  video_url: string;
  informe_url?: string | null;
  creado_en: string;
};

export default function ListaVideos() {
  const [videos, setVideos] = useState<VideoItem[]>([]);

  useEffect(() => {
    const fetchVideos = async () => {
      const { data, error } = await supabase
        .from('videos_entrenadores')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('❌ Error cargando videos:', error.message);
        Alert.alert('Error', 'No se pudieron cargar los videos');
        return;
      }

      setVideos(data || []);
    };

    fetchVideos();
  }, []);

  const abrirPDF = (url: string | null | undefined) => {
    if (!url) {
      Alert.alert('Sin informe', 'Este video no tiene un PDF asociado.');
      return;
    }

    Alert.alert('Abrir PDF', '¿Quieres abrir el informe en el navegador?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Abrir', onPress: () => Linking.openURL(url) },
    ]);
  };

  const abrirVideo = (url: string) => {
    if (!url) {
      Alert.alert('Video no disponible');
      return;
    }

    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'No se pudo abrir el video en el navegador.')
    );
  };

  const renderItem = ({ item }: { item: VideoItem }) => (
    <View style={styles.card}>
      <Text style={styles.tipo}>📽️ {item.tipo.toUpperCase()}</Text>
      <Text style={styles.descripcion}>📝 {item.descripcion}</Text>
      <Text style={styles.fecha}>📅 {new Date(item.creado_en).toLocaleString()}</Text>

      <Button title="🎬 Ver Video" onPress={() => abrirVideo(item.video_url)} />

      <View style={{ marginTop: 8 }}>
        <Button title="📄 Ver informe PDF" onPress={() => abrirPDF(item.informe_url)} />
      </View>
    </View>
  );

  return (
    <FlatList
      data={videos}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={{ padding: 16 }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
  },
  tipo: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  descripcion: {
    marginBottom: 4,
  },
  fecha: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
});
