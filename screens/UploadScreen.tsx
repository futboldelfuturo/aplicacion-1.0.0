import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';



type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'UploadScreen'>;
const navigation = useNavigation(); 

type Equipo = { id: string; nombre: string };
type Categoria = { id: string; nombre: string; equipo_id: string };
type FileAsset = { uri: string; name: string; type: string };

export default function UploadScreen() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedEquipo, setSelectedEquipo] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [tipoVideo, setTipoVideo] = useState<'partido' | 'entrenamiento' | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [videoFile, setVideoFile] = useState<FileAsset | null>(null);
  const [pdfFile, setPdfFile] = useState<FileAsset | null>(null);
 const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const fetchEquipos = async () => {
      const { data, error } = await supabase.from('teams').select();
      if (error) console.error('❌ Error cargando equipos:', error.message);
      else setEquipos(data || []);
    };
    fetchEquipos();
  }, []);

  useEffect(() => {
    const fetchCategorias = async () => {
      if (!selectedEquipo) return;
      const { data, error } = await supabase
        .from('categories')
        .select()
        .eq('equipo_id', selectedEquipo);
      if (error) console.error('❌ Error cargando categorías:', error.message);
      else setCategorias(data || []);
    };
    fetchCategorias();
  }, [selectedEquipo]);

  const pickVideo = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*',
      copyToCacheDirectory: true,
    });

    if (result.assets?.[0]) {
      const file = result.assets[0];
      setVideoFile({
        uri: file.uri,
        name: file.name ?? `video_${Date.now()}.mp4`,
        type: file.mimeType ?? 'video/mp4',
      });
    }
  };

  const pickPDF = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (result.assets?.[0]) {
      const file = result.assets[0];
      setPdfFile({
        uri: file.uri,
        name: file.name ?? `informe_${Date.now()}.pdf`,
        type: file.mimeType ?? 'application/pdf',
      });
    }
  };

  const uploadBase64File = async (
    uri: string,
    bucket: string,
    path: string,
    contentType: string
  ) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { error } = await supabase.storage.from(bucket).upload(path, base64, {
      contentType,
      upsert: false,
    });

    if (error) throw new Error(`Error subiendo a ${bucket}: ${error.message}`);

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl ?? null;
  };

  const handleUpload = async () => {
    if (!videoFile || !selectedEquipo || !selectedCategoria || !tipoVideo || !descripcion) {
      Alert.alert('Campos requeridos', 'Todos los campos menos el PDF son obligatorios');
      return;
    }

    try {
      const userResponse = await supabase.auth.getUser();
      const userId = userResponse.data.user?.id;

      if (!userId) {
        Alert.alert('Error', 'No se pudo obtener el ID del usuario');
        return;
      }

      const timestamp = Date.now();

      // Subir video
      const cleanVideoName = videoFile.name.replace(/\s+/g, '_');
      const videoPath = `videos/${timestamp}_${cleanVideoName}`;
      const videoUrl = await uploadBase64File(videoFile.uri, 'videos1', videoPath, videoFile.type);

      // Subir PDF (opcional)
      let pdfUrl: string | null = null;
      if (pdfFile) {
        const cleanPdfName = pdfFile.name.replace(/\s+/g, '_');
        const pdfPath = `informes/${timestamp}_${cleanPdfName}`;
        pdfUrl = await uploadBase64File(pdfFile.uri, 'informes', pdfPath, pdfFile.type);
      }

      // Insertar en la base de datos
      const { error: insertError } = await supabase.from('videos_entrenadores').insert({
        equipo_id: selectedEquipo,
        categoria_id: selectedCategoria,
        tipo: tipoVideo,
        descripcion,
        video_url: videoUrl,
        informe_url: pdfUrl,
        creado_por: userId,
        creado_en: new Date().toISOString(),
      });

      if (insertError) {
        console.error('❌ Error guardando en DB:', insertError.message);
        Alert.alert('Error', 'No se pudo guardar el registro en la base de datos');
        return;
      }

      Alert.alert('✅ Éxito', 'Video y PDF subidos correctamente');
      setVideoFile(null);
      setPdfFile(null);
      setDescripcion('');
    } catch (err) {
      console.error('❌ Error inesperado:', err);
      Alert.alert('Error inesperado', 'No se pudo subir el archivo');
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text>Tipo de Video</Text>
      <Picker selectedValue={tipoVideo} onValueChange={setTipoVideo}>
        <Picker.Item label="Seleccionar..." value="" />
        <Picker.Item label="Partido" value="partido" />
        <Picker.Item label="Entrenamiento" value="entrenamiento" />
      </Picker>

      <Text>Equipo</Text>
      <Picker selectedValue={selectedEquipo} onValueChange={setSelectedEquipo}>
        <Picker.Item label="Seleccionar equipo" value="" />
        {equipos.map((e) => (
          <Picker.Item key={e.id} label={e.nombre} value={e.id} />
        ))}
      </Picker>

      <Text>Categoría</Text>
      <Picker selectedValue={selectedCategoria} onValueChange={setSelectedCategoria}>
        <Picker.Item label="Seleccionar categoría" value="" />
        {categorias.map((c) => (
          <Picker.Item key={c.id} label={c.nombre} value={c.id} />
        ))}
      </Picker>

      <Text>Descripción</Text>
      <TextInput
        placeholder="Ej: Partido vs X"
        value={descripcion}
        onChangeText={setDescripcion}
        style={{ borderWidth: 1, padding: 8, marginBottom: 16 }}
      />

      <Button title="Seleccionar Video" onPress={pickVideo} />
      {videoFile && <Text>🎥 {videoFile.name}</Text>}

      <Button title="Seleccionar Informe PDF (opcional)" onPress={pickPDF} />
      {pdfFile && <Text>📄 {pdfFile.name}</Text>}

      <Button title="Subir Todo" onPress={handleUpload} />

      {/* Botón para ir a la lista de videos */}
      <View style={{ marginTop: 20 }}>
        <Button
          title="📂 Ver lista de videos"
          onPress={() => navigation.navigate('ListaVideos')}
        />
      </View>
    </View>
  );
}
