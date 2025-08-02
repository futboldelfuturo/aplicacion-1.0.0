import React, { useState } from 'react';
import { View, Text, Button, TextInput, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';

interface Props {
  equipoSeleccionado: string;
  categoriaSeleccionada: string;
}

export default function SubirVideo({
  equipoSeleccionado,
  categoriaSeleccionada,
}: Props) {
  const [videoFile, setVideoFile] = useState<any>(null);
  const [descripcion, setDescripcion] = useState('');

  const pickVideo = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'video/*' });
    if (result.assets?.[0]) {
      const file = result.assets[0];
      setVideoFile({
        uri: file.uri,
        name: file.name ?? `video_${Date.now()}.mp4`,
        type: file.mimeType ?? 'video/mp4',
      });
    }
  };

  const uploadFileAsBase64 = async (
    bucket: string,
    path: string,
    uri: string,
    contentType: string
  ): Promise<string | null> => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { error } = await supabase.storage.from(bucket).upload(path, base64, {
      contentType,
      upsert: false,
    });

    if (error) {
      console.error(`❌ Error subiendo a ${bucket}:`, error.message);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl ?? null;
  };

  const handleUpload = async () => {
    if (!videoFile || !descripcion) {
      Alert.alert('Faltan datos', 'Selecciona un video y escribe una descripción.');
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) {
        Alert.alert('Error', 'Usuario no autenticado');
        return;
      }

      const timestamp = Date.now();
      const safeName = videoFile.name.replace(/\s+/g, '_');
      const path = `videos/${timestamp}_${safeName}`;

      const videoUrl = await uploadFileAsBase64('videos1', path, videoFile.uri, videoFile.type);
      if (!videoUrl) {
        Alert.alert('Error', 'No se pudo subir el video');
        return;
      }

      const { error } = await supabase.from('videos').insert({
        tipo: 'partido',
        descripcion,
        video_url: videoUrl,
        equipo_id: equipoSeleccionado,
        categoria_id: categoriaSeleccionada,
        creado_por: userId,
        created_at: new Date().toISOString(),
        informe_url: null,
      });

      if (error) {
        console.error('❌ Error guardando en DB:', error.message);
        Alert.alert('Error en base de datos', 'No se pudo guardar el video');
        return;
      }

      Alert.alert('✅ Éxito', 'Video subido correctamente');
      setVideoFile(null);
      setDescripcion('');
    } catch (err) {
      console.error('❌ Error inesperado:', err);
      Alert.alert('Error inesperado', 'No se pudo completar la subida');
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Descripción</Text>
      <TextInput
        placeholder="Ej: Gol de tiro libre vs Bogotá"
        value={descripcion}
        onChangeText={setDescripcion}
        style={{ borderWidth: 1, padding: 8, marginBottom: 16 }}
      />

      <Button title="Seleccionar Video" onPress={pickVideo} />
      {videoFile && <Text>🎥 {videoFile.name}</Text>}

      <Button title="Subir Video" onPress={handleUpload} />
    </View>
  );
}
