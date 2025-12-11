// src/screens/entrenador/EditarVideo.tsx
import React, { useEffect, useState } from 'react';
import { View, Alert, ScrollView, Platform, StatusBar } from 'react-native';
import { TextInput, Button, ActivityIndicator, Text } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../utils/supabase';
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { actualizarVideoYouTube, obtenerInfoVideoYouTube } from '../../utils/youtubeUpdate';
import { eliminarVideoYouTube } from '../../utils/youtubeDelete';
import HeaderLogo from '../../components/HeaderLogo';

type RouteParams = {
  params: { videoId: string };
};

type FileOrAsset = DocumentPicker.DocumentPickerAsset | File;

const generarNombreArchivo = (extension: string) => {
  const randomString = Math.random().toString(36).substring(2, 10);
  return `${Date.now()}_${randomString}.${extension}`;
};

export default function EditarVideo() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'params'>>();
  const { videoId } = route.params;

  const [descripcion, setDescripcion] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPath, setVideoPath] = useState('');
  const [nuevoVideo, setNuevoVideo] = useState<FileOrAsset | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Estados para videos de YouTube
  const [esYoutube, setEsYoutube] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [tituloYouTube, setTituloYouTube] = useState('');
  const [privacidadYouTube, setPrivacidadYouTube] = useState<'private' | 'unlisted' | 'public'>('unlisted');
  const [madeForKids, setMadeForKids] = useState(false);
  const [cargandoInfoYouTube, setCargandoInfoYouTube] = useState(false);

  useEffect(() => {
    const cargarVideo = async () => {
      try {
        const { data, error } = await supabase
          .from('videos_entrenadores')
          .select('descripcion, video_url, video_path, youtube_video_id, es_youtube, equipo_id')
          .eq('id', videoId)
          .single();

        if (error || !data) {
          Alert.alert('Error', 'No se pudo cargar la información del video');
          return;
        }

        setDescripcion(data.descripcion || '');
        setVideoUrl(data.video_url || '');
        setVideoPath(data.video_path || '');
        
        // Verificar si es video de YouTube
        if (data.es_youtube && data.youtube_video_id) {
          setEsYoutube(true);
          setYoutubeVideoId(data.youtube_video_id);
          
          // Cargar información del video de YouTube (necesita equipoId)
          setCargandoInfoYouTube(true);
          try {
            const equipoId = data.equipo_id || '';
            if (!equipoId) {
              throw new Error('equipoId es requerido para obtener información de YouTube');
            }
            const infoYouTube = await obtenerInfoVideoYouTube(data.youtube_video_id, equipoId);
            setTituloYouTube(infoYouTube.title || data.descripcion || '');
            setPrivacidadYouTube(infoYouTube.privacyStatus as 'private' | 'unlisted' | 'public');
            setMadeForKids(infoYouTube.selfDeclaredMadeForKids || false);
          } catch (err: any) {
            console.error('Error al cargar info de YouTube:', err);
            Alert.alert('Error', `Error al cargar info de YouTube: ${err.message || 'Error desconocido'}`);
            // Si falla, usar valores por defecto
            setTituloYouTube(data.descripcion || '');
            setPrivacidadYouTube('unlisted');
            setMadeForKids(false);
          } finally {
            setCargandoInfoYouTube(false);
          }
        }
      } catch (err: any) {
        console.error('Error al cargar video:', err);
        Alert.alert('Error', 'No se pudo cargar la información del video');
      }
    };

    cargarVideo();
  }, [videoId]);

  const seleccionarNuevoVideo = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) setNuevoVideo(file);
        };
        input.click();
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setNuevoVideo(result.assets[0]);
      }
    } catch (err: any) {
      Alert.alert('Error', `No se pudo seleccionar el archivo: ${err?.message ?? err}`);
    }
  };

  const subirNuevoVideo = async (file: FileOrAsset): Promise<{ url: string; path: string } | null> => {
    if (!file) return null;
    try {
      const originalName = Platform.OS === 'web' ? (file as File).name : (file as DocumentPicker.DocumentPickerAsset).name;
      const extension = (originalName?.split('.').pop() || 'mp4').toLowerCase();
      const newFileName = generarNombreArchivo(extension);
      const carpeta = 'entrenamientos';
      const fullPath = `${carpeta}/${newFileName}`;

      if (Platform.OS === 'web') {
        const webFile = file as File;
        const { error } = await supabase.storage.from('videos1').upload(fullPath, webFile, {
          contentType: webFile.type || 'video/mp4',
          upsert: false,
        });
        if (error) throw error;
      } else {
        const asset = file as DocumentPicker.DocumentPickerAsset;
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        const arrayBuffer = decode(base64);
        const { error } = await supabase.storage.from('videos1').upload(fullPath, arrayBuffer, {
          contentType: asset.mimeType || 'video/mp4',
          upsert: false,
        });
        if (error) throw error;
      }

      const { data } = supabase.storage.from('videos1').getPublicUrl(fullPath);
      return { url: data?.publicUrl ?? '', path: fullPath };
    } catch (err: any) {
      Alert.alert('Error', `Hubo un problema al subir el video: ${err?.message ?? err}`);
      return null;
    }
  };

  const actualizarVideo = async () => {
    setLoading(true);
    try {
      // Para videos de YouTube, solo actualizar la descripción en la BD local
      if (esYoutube) {
        const { error } = await supabase
          .from('videos_entrenadores')
          .update({
            descripcion: descripcion,
          })
          .eq('id', videoId);

        if (error) throw error;

        Alert.alert('Éxito', 'Descripción actualizada correctamente');
        navigation.goBack();
        return;
      }

      // Para videos de Supabase, actualizar todo
      let nuevaUrl = videoUrl;
      let nuevoPath = videoPath;

      if (nuevoVideo) {
        const nuevoArchivo = await subirNuevoVideo(nuevoVideo);
        if (!nuevoArchivo) {
          setLoading(false);
          return;
        }
        nuevaUrl = nuevoArchivo.url;
        nuevoPath = nuevoArchivo.path;
      }

      const { error } = await supabase
        .from('videos_entrenadores')
        .update({
          descripcion: descripcion,
          video_url: nuevaUrl,
          video_path: nuevoPath,
        })
        .eq('id', videoId);

      if (error) throw error;

      Alert.alert('Éxito', 'Video actualizado correctamente');
      navigation.goBack();
    } catch (err: any) {
      console.error('Error actualizarVideo:', err);
      Alert.alert('Error', err?.message ?? 'No se pudo actualizar el video');
    } finally {
      setLoading(false);
    }
  };

  const borrarVideo = async () => {
    Alert.alert(
      'Confirmar',
      '¿Seguro que quieres borrar este video?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Si es video de YouTube, eliminarlo primero de YouTube
              if (esYoutube && youtubeVideoId) {
                try {
                  await eliminarVideoYouTube(youtubeVideoId);
                  console.log('[EditarVideo] Video eliminado de YouTube exitosamente');
                } catch (err: any) {
                  console.error('[EditarVideo] Error al eliminar de YouTube:', err);
                  // Continuar con la eliminación de la BD aunque falle YouTube
                  Alert.alert('Advertencia', `El video se eliminó de la base de datos, pero hubo un problema al eliminarlo de YouTube: ${err.message || 'Error desconocido'}`);
                }
              } else if (videoPath) {
                // Si es video de Supabase, eliminarlo del storage
                console.log('Intentando borrar del bucket:', videoPath);
                const { error: storageError } = await supabase.storage.from('videos1').remove([videoPath]);
                if (storageError) {
                  console.warn('Error al eliminar del storage (continuando con BD):', storageError);
                }
              }

              // Eliminar registro de la base de datos
              console.log('Eliminando registro en BD...');
              const { error: dbError } = await supabase
                .from('videos_entrenadores')
                .delete()
                .eq('id', videoId);

              if (dbError) throw dbError;

              Alert.alert('Éxito', 'Video eliminado correctamente.');
              navigation.goBack();
            } catch (err: any) {
              console.error('Error borrarVideo:', err);
              Alert.alert('Error', err?.message ?? 'No se pudo borrar el video');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const videoPreviewUri = nuevoVideo
    ? Platform.OS === 'web'
      ? URL.createObjectURL(nuevoVideo as File)
      : (nuevoVideo as DocumentPicker.DocumentPickerAsset).uri
    : videoUrl;

  // Calcular el paddingTop necesario para que el contenido quede debajo del banner
  const statusBarHeight = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0);
  const bannerHeight = 56; // Altura del HeaderLogo
  const paddingTopNecesario = statusBarHeight + bannerHeight + 20; // 20px de espacio adicional

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <HeaderLogo />
      <ScrollView 
        {...(Platform.OS === 'web' ? { 'data-scrollview-web': true } : {})}
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          padding: Platform.OS === 'web' ? 24 : 20, 
          paddingTop: paddingTopNecesario,
          paddingBottom: Platform.OS === 'web' ? 100 : 40,
          width: '100%',
          maxWidth: '100%',
        }}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
      <Text variant="titleLarge" style={{ marginBottom: 16, color: '#fff' }}>
        Editar Video {esYoutube && '(YouTube)'}
      </Text>

      {cargandoInfoYouTube ? (
        <View style={{ marginBottom: 16 }}>
          <ActivityIndicator animating />
          <Text style={{ color: '#fff', marginTop: 8 }}>Cargando información de YouTube...</Text>
        </View>
      ) : null}

      {esYoutube ? (
        <>
          {/* Información de video de YouTube */}
          <View style={{ 
            backgroundColor: '#1F1F1F', 
            padding: 16, 
            borderRadius: 8, 
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#333'
          }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              Video de YouTube
            </Text>
            <Text style={{ color: '#aaa', fontSize: 14, marginBottom: 4 }}>
              Título: {tituloYouTube || 'Sin título'}
            </Text>
            <Text style={{ color: '#aaa', fontSize: 14, marginBottom: 8 }}>
              Privacidad: {privacidadYouTube === 'unlisted' ? 'Oculto' : privacidadYouTube === 'private' ? 'Privado' : 'Público'}
            </Text>
            <Text style={{ color: '#FFA500', fontSize: 12, fontStyle: 'italic', marginBottom: 16 }}>
              ⚠️ El video de YouTube no se puede editar desde la aplicación. 
              Para editar el video, ve directamente a YouTube.
            </Text>
          </View>

          {/* Descripción editable para videos de YouTube */}
          <TextInput
            label="Descripción (en la aplicación)"
            value={descripcion}
            onChangeText={setDescripcion}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={{ marginBottom: 16, backgroundColor: '#fff' }}
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
        </>
      ) : (
        <>
          {/* Campos para videos de Supabase */}
          <TextInput
            label="Descripción"
            value={descripcion}
            onChangeText={setDescripcion}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={{ marginBottom: 16, backgroundColor: '#fff' }}
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

          <Button mode="outlined" onPress={seleccionarNuevoVideo} style={{ marginBottom: 16 }}>
            {nuevoVideo ? '✅ Video seleccionado' : 'Seleccionar nuevo video'}
          </Button>
        </>
      )}

      {videoPreviewUri && !esYoutube ? (
        <View style={{ height: 200, marginBottom: 16 }}>
          <Video source={{ uri: videoPreviewUri }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={{ flex: 1, borderRadius: 10 }} />
        </View>
      ) : null}

      {esYoutube && videoUrl ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: '#fff', marginBottom: 8 }}>Video de YouTube:</Text>
          <Text style={{ color: '#aaa', fontSize: 12 }}>{videoUrl}</Text>
        </View>
      ) : null}

      <Button 
        mode="contained" 
        onPress={actualizarVideo} 
        disabled={loading || cargandoInfoYouTube} 
        style={{ marginBottom: 12, backgroundColor: '#00AA00' }}
      >
        {loading ? <ActivityIndicator animating color="white" /> : 'Actualizar'}
      </Button>

      <Button mode="contained" buttonColor="red" onPress={borrarVideo} disabled={loading}>
        {loading ? <ActivityIndicator animating color="white" /> : 'Borrar'}
      </Button>
      </ScrollView>
    </View>
  );
}
