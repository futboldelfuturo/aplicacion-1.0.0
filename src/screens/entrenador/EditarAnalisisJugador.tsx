import React, { useEffect, useState } from 'react';
import { View, Alert, ScrollView, Platform, StatusBar } from 'react-native';
import { TextInput, Button, ActivityIndicator, Text } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../utils/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { obtenerInfoVideoYouTube } from '../../utils/youtubeUpdate';
import HeaderLogo from '../../components/HeaderLogo';
import { RootStackParamList } from '../../types';

type RouteParams = {
  params: { analisisId: string };
};

type FileOrAsset = DocumentPicker.DocumentPickerAsset | File;

const generarNombreArchivo = (extension: string) => {
  const randomString = Math.random().toString(36).substring(2, 10);
  return `${Date.now()}_${randomString}.${extension}`;
};

export default function EditarAnalisisJugador() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'params'>>();
  const { analisisId } = route.params;

  const [descripcion, setDescripcion] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [informeUrl, setInformeUrl] = useState('');
  const [nuevoVideo, setNuevoVideo] = useState<FileOrAsset | null>(null);
  const [nuevoInforme, setNuevoInforme] = useState<FileOrAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [equipoId, setEquipoId] = useState<string>('');
  
  // Estados para videos de YouTube
  const [esYoutube, setEsYoutube] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [tituloYouTube, setTituloYouTube] = useState('');
  const [privacidadYouTube, setPrivacidadYouTube] = useState<'private' | 'unlisted' | 'public'>('unlisted');
  const [madeForKids, setMadeForKids] = useState(false);
  const [cargandoInfoYouTube, setCargandoInfoYouTube] = useState(false);

  const subirArchivo = async (file: FileOrAsset, bucket: string, carpeta: string) => {
    try {
      let originalName: string;
      let mimeType: string;
      
      if (Platform.OS === 'web') {
        const webFile = file as File;
        originalName = webFile.name;
        mimeType = webFile.type || 'application/octet-stream';
      } else {
        const asset = file as DocumentPicker.DocumentPickerAsset;
        originalName = asset?.name ?? (asset?.uri ?? '').split('/').pop() ?? 'file';
        mimeType = asset?.mimeType || 'application/octet-stream';
      }
      
      const extension = (originalName?.split('.').pop() || 'bin').toString().toLowerCase();
      const fileName = generarNombreArchivo(extension);
      const filePath = `${carpeta}/${fileName}`;

      if (Platform.OS === 'web') {
        const webFile = file as File;
        const { error } = await supabase.storage.from(bucket).upload(filePath, webFile, {
          contentType: mimeType,
          upsert: false,
        });
        if (error) throw error;
      } else {
        const asset = file as DocumentPicker.DocumentPickerAsset;
        const uri = asset.uri;
        if (!uri) throw new Error('URI del archivo no disponible.');
        const base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        const arrayBuffer = decode(base64Data);
        const { error } = await supabase.storage.from(bucket).upload(filePath, arrayBuffer, {
          contentType: mimeType,
          upsert: false,
        });
        if (error) throw error;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { url: data?.publicUrl ?? '', path: filePath };
    } catch (err: any) {
      throw err;
    }
  };

  useEffect(() => {
    const cargarAnalisis = async () => {
      try {
        const { data, error } = await supabase
          .from('analisisjugadores')
          .select('descripcion, video_url, informe_url, equipo_id')
          .eq('id', analisisId)
          .single();

        if (error || !data) {
          console.error('Error cargando análisis:', error);
          Alert.alert('Error', 'No se pudo cargar la información del análisis');
          return;
        }

        setDescripcion(data.descripcion || '');
        setVideoUrl(data.video_url || '');
        setInformeUrl(data.informe_url || '');
        setEquipoId(data.equipo_id || '');
        
        // Verificar si es video de YouTube (por URL)
        const esYoutubePorUrl = data.video_url?.includes('youtube.com') || data.video_url?.includes('youtu.be');
        if (esYoutubePorUrl) {
          setEsYoutube(true);
          const videoId = data.video_url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1];
          
          if (videoId) {
            setYoutubeVideoId(videoId);
            
            // Cargar información del video de YouTube (necesita equipoId)
            setCargandoInfoYouTube(true);
            try {
              const equipoIdParaYouTube = data.equipo_id || '';
              if (!equipoIdParaYouTube) {
                throw new Error('equipoId es requerido para obtener información de YouTube');
              }
              const infoYouTube = await obtenerInfoVideoYouTube(videoId, equipoIdParaYouTube);
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
        }
      } catch (err: any) {
        console.error('Error:', err);
        Alert.alert('Error', 'No se pudo cargar la información');
      } finally {
        setCargando(false);
      }
    };

    cargarAnalisis();
  }, [analisisId]);

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

  const seleccionarNuevoPdf = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) setNuevoInforme(file);
        };
        input.click();
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setNuevoInforme(result.assets[0]);
      }
    } catch (err: any) {
      Alert.alert('Error', `No se pudo seleccionar el archivo: ${err?.message ?? err}`);
    }
  };

  const actualizarAnalisis = async () => {
    setLoading(true);
    try {
      // Obtener el análisis actual para eliminar PDF antiguo si es necesario
      const { data: analisisActual, error: fetchError } = await supabase
        .from('analisisjugadores')
        .select('informe_url')
        .eq('id', analisisId)
        .single();

      if (fetchError) {
        console.warn('No se pudo obtener análisis actual:', fetchError);
      }

      const updates: any = {
        descripcion: descripcion.trim() || null,
      };

      // Manejar actualización de PDF (tanto para YouTube como Supabase)
      if (nuevoInforme) {
        // Eliminar PDF antiguo del storage si existe
        if (analisisActual?.informe_url) {
          try {
            // Extraer el path del PDF desde la URL
            const urlParts = analisisActual.informe_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            // Buscar en la carpeta informes
            const pdfPath = `informes/${fileName}`;
            
            const { error: deleteError } = await supabase.storage
              .from('informes')
              .remove([pdfPath]);
            
            if (deleteError) {
              console.warn('No se pudo eliminar PDF antiguo:', deleteError);
            } else {
              console.log('PDF antiguo eliminado correctamente');
            }
          } catch (e) {
            console.warn('Error al eliminar PDF antiguo:', e);
          }
        }

        // Subir nuevo PDF
        const nuevoInformeArchivo = await subirArchivo(nuevoInforme, 'informes', 'analisis');
        updates.informe_url = nuevoInformeArchivo.url;
      }

      // Para videos de YouTube, solo actualizar descripción y PDF
      if (esYoutube) {
        const { error } = await supabase
          .from('analisisjugadores')
          .update(updates)
          .eq('id', analisisId);

        if (error) throw error;

        Alert.alert('Éxito', 'Análisis actualizado correctamente');
        navigation.goBack();
        return;
      }

      // Para videos de Supabase, actualizar video también si se seleccionó uno nuevo
      if (nuevoVideo) {
        // Eliminar video antiguo si existe
        if (videoUrl && !videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
          try {
            const urlParts = videoUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const filePath = `futpro/${fileName}`;
            await supabase.storage.from('videos1').remove([filePath]);
          } catch (e) {
            console.warn('No se pudo eliminar el video antiguo:', e);
          }
        }

        const nuevoArchivo = await subirArchivo(nuevoVideo, 'videos1', 'futpro');
        updates.video_url = nuevoArchivo.url;
      }

      const { error } = await supabase
        .from('analisisjugadores')
        .update(updates)
        .eq('id', analisisId);

      if (error) throw error;

      Alert.alert('Éxito', 'Análisis actualizado correctamente');
      navigation.goBack();
    } catch (err: any) {
      console.error('Error actualizarAnalisis:', err);
      Alert.alert('Error', err?.message ?? 'No se pudo actualizar el análisis');
    } finally {
      setLoading(false);
    }
  };

  const statusBarHeight = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0);
  const bannerHeight = 56;
  const paddingTopNecesario = statusBarHeight + bannerHeight + 20;

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00AA00" />
        <Text style={{ color: '#fff', marginTop: 12 }}>Cargando...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <HeaderLogo />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: paddingTopNecesario,
          paddingBottom: 40,
        }}
        style={{ flex: 1 }}
      >
        <Text style={{ 
          marginBottom: 24, 
          fontWeight: 'bold', 
          color: '#fff', 
          fontSize: 24,
          textAlign: 'center'
        }}>
          Editar Análisis {esYoutube && '(YouTube)'}
        </Text>

        {cargandoInfoYouTube ? (
          <View style={{ marginBottom: 20, alignItems: 'center', padding: 16 }}>
            <ActivityIndicator animating size="large" color="#00AA00" />
            <Text style={{ color: '#fff', marginTop: 12, fontSize: 14 }}>Cargando información de YouTube...</Text>
          </View>
        ) : null}

        {esYoutube ? (
          <>
            {/* Información de video de YouTube - igual que en EditarAnalisis */}
            <View style={{ 
              backgroundColor: '#1F1F1F', 
              padding: 16, 
              borderRadius: 12, 
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#333',
              borderLeftWidth: 3,
              borderLeftColor: '#FFA500'
            }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
                Video de YouTube
              </Text>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: '#aaa', fontSize: 13, marginBottom: 4 }}>
                  Título:
                </Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>
                  {tituloYouTube || 'Sin título'}
                </Text>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: '#aaa', fontSize: 13, marginBottom: 4 }}>
                  Privacidad:
                </Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>
                  {privacidadYouTube === 'unlisted' ? '🔗 Video oculto' : privacidadYouTube === 'private' ? '🔒 Video privado' : '🌐 Público'}
                </Text>
              </View>
              <View style={{ 
                backgroundColor: '#2F1F1F', 
                padding: 10, 
                borderRadius: 8,
                borderLeftWidth: 3,
                borderLeftColor: '#FFA500'
              }}>
                <Text style={{ color: '#FFA500', fontSize: 12, fontStyle: 'italic' }}>
                  ⚠️ El video de YouTube no se puede editar desde la aplicación. 
                  Para editar el video, ve directamente a YouTube.
                </Text>
              </View>
            </View>

            {/* Descripción editable para videos de YouTube */}
            <TextInput
              label="Descripción"
              value={descripcion}
              onChangeText={setDescripcion}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={{ marginBottom: 20, backgroundColor: '#fff', color: '#000' }}
              theme={{ colors: { primary: '#00AA00', text: '#000', placeholder: '#666', background: '#fff' } }}
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
              style={{ marginBottom: 20, backgroundColor: '#fff', color: '#000' }}
              theme={{ colors: { primary: '#00AA00', text: '#000', placeholder: '#666', background: '#fff' } }}
            />

            <Button 
              mode="outlined" 
              onPress={seleccionarNuevoVideo} 
              style={{ 
                marginBottom: 20,
                backgroundColor: nuevoVideo ? '#1F3F1F' : '#1F1F1F',
                borderColor: nuevoVideo ? '#00AA00' : '#666',
                borderWidth: 2,
                paddingVertical: 12
              }}
              labelStyle={{ 
                color: '#fff',
                fontWeight: '600',
                fontSize: 15
              }}
              icon={nuevoVideo ? 'check-circle' : 'video'}
              disabled={loading}
            >
              {nuevoVideo ? 'Video seleccionado ✓' : 'Seleccionar nuevo video'}
            </Button>
          </>
        )}

        {/* PDF siempre disponible para editar */}
        <View style={{ marginBottom: 20 }}>
          <Button 
            mode="outlined" 
            onPress={seleccionarNuevoPdf} 
            style={{ 
              backgroundColor: nuevoInforme ? '#1F3F1F' : '#1F1F1F',
              borderColor: nuevoInforme ? '#00AA00' : '#666',
              borderWidth: 2,
              paddingVertical: 12
            }}
            labelStyle={{ 
              color: '#fff',
              fontWeight: '600',
              fontSize: 15
            }}
            icon={nuevoInforme ? 'check-circle' : 'file-document'}
            disabled={loading}
          >
            {nuevoInforme ? 'PDF seleccionado ✓' : informeUrl ? 'Cambiar PDF' : 'Seleccionar PDF'}
          </Button>
        </View>

        {esYoutube && videoUrl ? (
          <View style={{ 
            marginBottom: 20,
            padding: 12,
            backgroundColor: '#1F1F1F',
            borderRadius: 8,
            borderLeftWidth: 3,
            borderLeftColor: '#00AA00'
          }}>
            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>URL del video:</Text>
            <Text style={{ color: '#fff', fontSize: 13 }}>{videoUrl}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <ActivityIndicator animating={true} size="large" color="#00AA00" />
          </View>
        ) : (
          <Button 
            mode="contained" 
            onPress={actualizarAnalisis} 
            disabled={loading || cargandoInfoYouTube} 
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
            icon="content-save"
          >
            Actualizar análisis
          </Button>
        )}
      </ScrollView>
    </View>
  );
}
