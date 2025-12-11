import React, { useState, useEffect } from 'react';
import { View, Alert, Platform, ScrollView } from 'react-native';
import { Button, TextInput, ActivityIndicator, Text, ProgressBar } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../utils/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { subirVideoAYoutube } from '../../utils/youtubeUpload';
import HeaderLogo from '../../components/HeaderLogo';

type SubirVideoParams = {
  SubirVideo: {
    tipo?: 'entrenamiento' | 'partido' | 'analisis' | 'futpro';
    equipoId?: string;
    categoriaId?: string;
    jugadorId?: string;
  };
};

type FileOrAsset = DocumentPicker.DocumentPickerAsset | File;

const generarNombreArchivo = (extension: string) => {
  const randomString = Math.random().toString(36).substring(2, 10);
  return `${Date.now()}_${randomString}.${extension}`;
};

export default function SubirVideo() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<SubirVideoParams, 'SubirVideo'>>();

  const { tipo = 'entrenamiento', equipoId = '', categoriaId = '', jugadorId } = route.params || {};

  const [videoFile, setVideoFile] = useState<FileOrAsset | null>(null);
  const [pdfFile, setPdfFile] = useState<FileOrAsset | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [destino, setDestino] = useState<'supabase' | 'youtube'>('youtube');
  const [canalAsignado, setCanalAsignado] = useState<string | null>(null);
  const [privacidad, setPrivacidad] = useState<'private' | 'unlisted'>('unlisted');

  // Verificar canal asignado al equipo
  useEffect(() => {
    const verificarCanal = async () => {
      if (!equipoId) {
        setCanalAsignado(null);
        return;
      }
      
      try {
        const { data: equipo } = await supabase
          .from('teams')
          .select(`
            youtube_canal_id,
            youtube_canales:youtube_canal_id (
              nombre_canal
            )
          `)
          .eq('id', equipoId)
          .single();
        
        if (equipo?.youtube_canal_id) {
          const canal = equipo.youtube_canales as any;
          setCanalAsignado(canal?.nombre_canal || 'Canal asignado');
        } else {
          setCanalAsignado(null);
        }
      } catch (error) {
        console.error('Error al verificar canal del equipo:', error);
        setCanalAsignado(null);
      }
    };
    verificarCanal();
  }, [equipoId]);

  const seleccionarArchivo = async (tipoArchivo: 'video' | 'pdf') => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = tipoArchivo === 'video' ? 'video/*' : 'application/pdf';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) tipoArchivo === 'video' ? setVideoFile(file) : setPdfFile(file);
        };
        input.click();
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: tipoArchivo === 'video' ? 'video/*' : 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && (result as any).assets?.length > 0) {
        const asset = (result as any).assets[0] as DocumentPicker.DocumentPickerAsset;
        tipoArchivo === 'video' ? setVideoFile(asset) : setPdfFile(asset);
      }
    } catch (err: any) {
      Alert.alert('Error', `No se pudo seleccionar el archivo: ${err?.message ?? err}`);
    }
  };

  const subirArchivo = async (file: FileOrAsset, bucket: string, carpeta: string) => {
    try {
      const originalName =
        Platform.OS === 'web'
          ? (file as File).name
          : (file as DocumentPicker.DocumentPickerAsset).name;

      const extension = (originalName?.split('.').pop() || 'bin').toLowerCase();
      const fileName = generarNombreArchivo(extension);
      const filePath = `${carpeta}/${fileName}`;
      const mimeType =
        Platform.OS === 'web'
          ? (file as File).type || 'application/octet-stream'
          : (file as DocumentPicker.DocumentPickerAsset).mimeType || 'application/octet-stream';

      if (Platform.OS === 'web') {
        const webFile = file as File;
        const { error } = await supabase.storage.from(bucket).upload(filePath, webFile, { contentType: mimeType, upsert: false });
        if (error) throw error;
      } else {
        const asset = file as DocumentPicker.DocumentPickerAsset;
        const base64Data = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        const arrayBuffer = decode(base64Data);
        const { error } = await supabase.storage.from(bucket).upload(filePath, arrayBuffer, { contentType: mimeType, upsert: false });
        if (error) throw error;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { url: data?.publicUrl ?? '', path: filePath };
    } catch (err: any) {
      throw err;
    }
  };

  const handleSubir = async () => {
    if (!videoFile) {
      Alert.alert('Error', 'Debes seleccionar un video antes de subir.');
      return;
    }

    setLoading(true);
    setProgreso(0);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) throw new Error('No se pudo obtener el usuario.');

      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('correo', authData.user.email)
        .single();

      if (perfilError || !perfil) throw new Error('No se encontró el perfil del usuario.');

      const creado_por = perfil.id;

      let video_url: string;
      let video_path: string | null = null;
      let youtube_video_id: string | null = null;
      let es_youtube = false;

      if (destino === 'youtube') {
        if (!equipoId) {
          throw new Error('Debes seleccionar un equipo para subir videos a YouTube.');
        }
        
        if (!canalAsignado) {
          throw new Error('El equipo seleccionado no tiene un canal de YouTube asignado. Contacta al administrador.');
        }

        // Subir directamente a YouTube (el video NO pasa por tu backend)
        // Usar descripción como título, si no hay descripción usar un título por defecto
        const titulo = descripcion.trim() || `Video ${tipo} - ${new Date().toLocaleDateString()}`;
        
        const result = await subirVideoAYoutube(
          videoFile,
          titulo, // Título = descripción
          descripcion.trim() || '', // Descripción
          privacidad,
          equipoId, // Pasar equipoId
          (progress) => setProgreso(progress) // Callback de progreso
        );

        youtube_video_id = result.videoId;
        video_url = result.videoUrl;
        es_youtube = true;
        
        // Guardar inmediatamente después de recibir videoId (sin esperar procesamiento completo)
        setProgreso(90);
        if (tipo === 'futpro') {
          const { error: insertError } = await supabase.from('analisisjugadores').insert([{
            jugador_id: jugadorId,
            equipo_id: equipoId || null,
            categoria_id: categoriaId || null,
            descripcion: descripcion.trim() || null,
            video_url,
            video_path: null,
            youtube_video_id,
            es_youtube,
            informe_url: null,
            informe_path: null,
            analista_id: creado_por,
            fecha: new Date(),
          }]);
          if (insertError) throw insertError;
        } else {
          const { error: insertError } = await supabase.from('videos_entrenadores').insert([{
            tipo,
            descripcion: descripcion.trim() || null,
            equipo_id: equipoId || null,
            categoria_id: categoriaId || null,
            creado_por,
            video_url,
            video_path: null,
            youtube_video_id,
            es_youtube,
            informe_url: null,
            informe_path: null,
            creado_en: new Date().toISOString(),
          }]);
          if (insertError) throw insertError;
        }
        
        setProgreso(100);
        if (Platform.OS === 'web') {
          window.alert(`✅ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} subido correctamente.\n\nEl video está siendo procesado por YouTube y aparecerá en la aplicación.`);
          navigation.goBack();
          return;
        } else {
          Alert.alert('Éxito', `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} subido correctamente.\n\nEl video está siendo procesado por YouTube y aparecerá en la aplicación.`);
          navigation.goBack();
          return;
        }
      } else {
        // Código existente para Supabase
        const carpeta = jugadorId ? `jugadores/${jugadorId}` : equipoId ? `equipos/${equipoId}` : tipo;
        setProgreso(10);
        const result = await subirArchivo(videoFile, 'videos1', carpeta);
        video_url = result.url;
        video_path = result.path;
        setProgreso(60);
      }

      let informe_url: string | null = null;
      let informe_path: string | null = null;
      // No permitir PDF para partidos completos
      if (tipo !== 'partido' && pdfFile) {
        const carpeta = jugadorId ? `jugadores/${jugadorId}` : equipoId ? `equipos/${equipoId}` : tipo;
        const pdfData = await subirArchivo(pdfFile, 'informes', carpeta);
        informe_url = pdfData.url;
        informe_path = pdfData.path;
      }
      setProgreso(90);

      if (tipo === 'futpro') {
        const { error: insertError } = await supabase.from('analisisjugadores').insert([{
          jugador_id: jugadorId,
          equipo_id: equipoId || null,
          categoria_id: categoriaId || null,
          descripcion: descripcion.trim() || null,
          video_url,
          video_path,
          youtube_video_id,
          es_youtube,
          informe_url,
          informe_path,
          analista_id: creado_por,
          fecha: new Date(),
        }]);
        if (insertError) throw insertError;
      } else {
        const { error: insertError } = await supabase.from('videos_entrenadores').insert([{
          tipo,
          descripcion: descripcion.trim() || null,
          equipo_id: equipoId || null,
          categoria_id: categoriaId || null,
          creado_por,
          video_url,
          video_path,
          youtube_video_id,
          es_youtube,
          informe_url,
          informe_path,
          creado_en: new Date().toISOString(),
        }]);
        if (insertError) throw insertError;
      }

      setProgreso(100);
      if (Platform.OS === 'web') {
        window.alert(`✅ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} subido correctamente.`);
        navigation.goBack();
      } else {
        Alert.alert('Éxito', `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} subido correctamente.`);
        navigation.goBack();
      }
    } catch (err: any) {
      console.error('Error en handleSubir:', err);
      Alert.alert('Error', err?.message ?? 'Error desconocido al subir.');
    } finally {
      setLoading(false);
      setProgreso(0);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <HeaderLogo />
      <ScrollView 
        {...(Platform.OS === 'web' ? { 'data-scrollview-web': true } : {})}
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          padding: 20, 
          paddingTop: 100,
          paddingBottom: Platform.OS === 'web' ? 100 : 40
        }}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ 
          marginBottom: 24, 
          fontWeight: 'bold', 
          color: '#fff', 
          fontSize: 24,
          textAlign: 'center'
        }}>
          Subir nuevo {tipo}
        </Text>

        <TextInput
          label="Descripción"
          value={descripcion}
          onChangeText={setDescripcion}
          style={{ marginBottom: 20, backgroundColor: '#fff' }}
          mode="outlined"
          multiline
          numberOfLines={3}
          textColor={Platform.OS === 'web' ? '#000' : undefined}
          theme={{
            colors: {
              primary: "#00AA00",
              text: Platform.OS === 'web' ? "#000" : undefined,
              placeholder: "#666",
              background: "#fff",
            },
          }}
        />

        {/* Selector de destino */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ marginBottom: 12, color: '#fff', fontWeight: '600', fontSize: 16 }}>
            Destino del video
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              mode={destino === 'supabase' ? 'contained' : 'outlined'}
              onPress={() => setDestino('supabase')}
              style={{ 
                flex: 1,
                backgroundColor: destino === 'supabase' ? '#00AA00' : 'transparent',
                borderColor: destino === 'supabase' ? '#00AA00' : '#666',
                borderWidth: 1
              }}
              labelStyle={{ 
                color: destino === 'supabase' ? '#fff' : '#fff',
                fontWeight: '600'
              }}
              disabled={loading}
            >
              Supabase
            </Button>
            <Button
              mode={destino === 'youtube' ? 'contained' : 'outlined'}
              onPress={() => setDestino('youtube')}
              style={{ 
                flex: 1,
                backgroundColor: destino === 'youtube' ? '#FF0000' : 'transparent',
                borderColor: destino === 'youtube' ? '#FF0000' : '#666',
                borderWidth: 1
              }}
              labelStyle={{ 
                color: destino === 'youtube' ? '#fff' : '#fff',
                fontWeight: '600'
              }}
              disabled={loading || !canalAsignado}
            >
              YouTube {canalAsignado ? '✓' : ''}
            </Button>
          </View>
          {canalAsignado && destino === 'youtube' && (
            <View style={{ 
              marginTop: 8, 
              padding: 10, 
              backgroundColor: '#1F1F1F', 
              borderRadius: 8,
              borderLeftWidth: 3,
              borderLeftColor: '#00AA00'
            }}>
              <Text style={{ color: '#00AA00', fontSize: 12, fontWeight: '500' }}>
                Canal asignado: {canalAsignado}
              </Text>
            </View>
          )}
          {!canalAsignado && destino === 'youtube' && (
            <View style={{ 
              marginTop: 8, 
              padding: 10, 
              backgroundColor: '#2F1F1F', 
              borderRadius: 8,
              borderLeftWidth: 3,
              borderLeftColor: '#FFA500'
            }}>
              <Text style={{ color: '#FFA500', fontSize: 12 }}>
                ⚠️ El equipo seleccionado no tiene un canal de YouTube asignado. Contacta al administrador.
              </Text>
            </View>
          )}
        </View>

        {/* Selector de privacidad (solo para YouTube) */}
        {destino === 'youtube' && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ marginBottom: 12, color: '#fff', fontWeight: '600', fontSize: 16 }}>
              Privacidad del video
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                mode={privacidad === 'unlisted' ? 'contained' : 'outlined'}
                onPress={() => setPrivacidad('unlisted')}
                style={{ 
                  flex: 1,
                  backgroundColor: privacidad === 'unlisted' ? '#00AA00' : 'transparent',
                  borderColor: privacidad === 'unlisted' ? '#00AA00' : '#666',
                  borderWidth: 1
                }}
                labelStyle={{ 
                  color: privacidad === 'unlisted' ? '#fff' : '#fff',
                  fontWeight: '600'
                }}
                disabled={loading}
              >
                Oculto
              </Button>
              <Button
                mode={privacidad === 'private' ? 'contained' : 'outlined'}
                onPress={() => setPrivacidad('private')}
                style={{ 
                  flex: 1,
                  backgroundColor: privacidad === 'private' ? '#00AA00' : 'transparent',
                  borderColor: privacidad === 'private' ? '#00AA00' : '#666',
                  borderWidth: 1
                }}
                labelStyle={{ 
                  color: privacidad === 'private' ? '#fff' : '#fff',
                  fontWeight: '600'
                }}
                disabled={loading}
              >
                Privado
              </Button>
            </View>
            <View style={{ 
              marginTop: 8, 
              padding: 10, 
              backgroundColor: '#1F1F1F', 
              borderRadius: 8
            }}>
              <Text style={{ color: '#aaa', fontSize: 12 }}>
                {privacidad === 'unlisted' 
                  ? '🔗 Visible solo con el enlace directo' 
                  : '🔒 Solo tú puedes verlo'}
              </Text>
            </View>
          </View>
        )}

        <View style={{ marginBottom: 20 }}>
          <Button
            mode="outlined"
            onPress={() => seleccionarArchivo('video')}
            style={{ 
              marginBottom: 12,
              backgroundColor: videoFile ? '#1F3F1F' : '#1F1F1F',
              borderColor: videoFile ? '#00AA00' : '#666',
              borderWidth: 2,
              paddingVertical: 12
            }}
            labelStyle={{ 
              color: '#fff',
              fontWeight: '600',
              fontSize: 15
            }}
            icon={videoFile ? 'check-circle' : 'video'}
            disabled={loading}
          >
            {videoFile ? 'Video seleccionado ✓' : 'Seleccionar video'}
          </Button>

          {/* No mostrar opción de PDF para partidos completos */}
          {tipo !== 'partido' && (
            <Button 
              mode="outlined" 
              onPress={() => seleccionarArchivo('pdf')} 
              style={{ 
                backgroundColor: pdfFile ? '#1F3F1F' : '#1F1F1F',
                borderColor: pdfFile ? '#00AA00' : '#666',
                borderWidth: 2,
                paddingVertical: 12
              }}
              labelStyle={{ 
                color: '#fff',
                fontWeight: '600',
                fontSize: 15
              }}
              icon={pdfFile ? 'check-circle' : 'file-document'}
              disabled={loading}
            >
              {pdfFile ? 'Informe PDF seleccionado ✓' : 'Adjuntar informe'}
            </Button>
          )}
        </View>

        {loading && (
          <View style={{ 
            marginBottom: 20,
            padding: 16,
            backgroundColor: '#1F1F1F',
            borderRadius: 12
          }}>
            <ProgressBar progress={progreso / 100} color="#00AA00" style={{ height: 8, borderRadius: 4 }} />
            <Text style={{ 
              marginTop: 12, 
              textAlign: 'center', 
              color: '#fff',
              fontSize: 16,
              fontWeight: '600'
            }}>
              {Math.round(progreso)}%
            </Text>
            <Text style={{ 
              marginTop: 4, 
              textAlign: 'center', 
              color: '#aaa',
              fontSize: 12
            }}>
              Subiendo video...
            </Text>
          </View>
        )}

        {loading ? (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <ActivityIndicator animating={true} size="large" color="#00AA00" />
          </View>
        ) : (
          <Button 
            mode="contained" 
            onPress={handleSubir} 
            style={{ 
              backgroundColor: '#00AA00',
              paddingVertical: 12,
              borderRadius: 8,
              elevation: 4
            }}
            labelStyle={{ 
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 16
            }}
            icon="upload"
            disabled={!videoFile || (destino === 'youtube' && !canalAsignado)}
          >
            Subir {tipo}
          </Button>
        )}
      </ScrollView>
    </View>
  );
}
