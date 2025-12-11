import React, { useEffect, useState } from 'react';
import { View, Alert, ScrollView, Platform, Modal, TouchableOpacity, FlatList, StatusBar } from 'react-native';
import { TextInput, Button, ActivityIndicator, Text, Menu, Divider } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../utils/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { actualizarVideoYouTube, obtenerInfoVideoYouTube } from '../../utils/youtubeUpdate';
import { eliminarVideoYouTube } from '../../utils/youtubeDelete';
import HeaderLogo from '../../components/HeaderLogo';
import { Feather } from '@expo/vector-icons';

type RouteParams = {
  params: { analisisId: string };
};

type FileOrAsset = DocumentPicker.DocumentPickerAsset | File;

const generarNombreArchivo = (extension: string) => {
  const randomString = Math.random().toString(36).substring(2, 10);
  return `${Date.now()}_${randomString}.${extension}`;
};

export default function EditarAnalisis() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'params'>>();
  const { analisisId } = route.params;

  const [descripcion, setDescripcion] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [partidoId, setPartidoId] = useState<string | null>(null);
  const [nuevoVideo, setNuevoVideo] = useState<FileOrAsset | null>(null);
  const [nuevoPdf, setNuevoPdf] = useState<FileOrAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [partidosDisponibles, setPartidosDisponibles] = useState<{ id: string | null; descripcion: string }[]>([]);
  const [equipoId, setEquipoId] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<string>('');
  
  // Estados para videos de YouTube
  const [esYoutube, setEsYoutube] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [tituloYouTube, setTituloYouTube] = useState('');
  const [privacidadYouTube, setPrivacidadYouTube] = useState<'private' | 'unlisted' | 'public'>('unlisted');
  const [madeForKids, setMadeForKids] = useState(false);
  const [cargandoInfoYouTube, setCargandoInfoYouTube] = useState(false);

  // Estados para el modal de búsqueda de partidos
  const [modalPartidoVisible, setModalPartidoVisible] = useState(false);
  const [busquedaPartido, setBusquedaPartido] = useState('');

  // Cargar partidos disponibles
  const fetchPartidosDisponibles = async (equipoId: string, categoriaId: string) => {
    try {
      const { data, error } = await supabase
        .from('videos_entrenadores')
        .select('id, descripcion, creado_en, video_url')
        .eq('equipo_id', equipoId)
        .eq('categoria_id', categoriaId)
        .eq('tipo', 'partido')
        .order('creado_en', { ascending: false });

      if (error) {
        console.warn('Error cargando partidos disponibles:', error);
        setPartidosDisponibles([]);
        return;
      }

      setPartidosDisponibles([{ id: null, descripcion: 'Sin partido asociado' }, ...(data || [])]);
    } catch (err) {
      console.error(err);
      setPartidosDisponibles([]);
    }
  };

  useEffect(() => {
    const cargarAnalisis = async () => {
      try {
        const { data, error } = await supabase
          .from('analisispartidos')
          .select('descripcion, video_url, pdf_url, partido_id, equipo_id, categoria_id')
          .eq('id', analisisId)
          .single();

        if (error || !data) {
          console.error('Error cargando análisis:', error);
          Alert.alert('Error', 'No se pudo cargar la información del análisis');
          return;
        }

        setDescripcion(data.descripcion || '');
        setVideoUrl(data.video_url || '');
        setPdfUrl(data.pdf_url || '');
        setPartidoId(data.partido_id || null);
        setEquipoId(data.equipo_id || '');
        setCategoriaId(data.categoria_id || '');
        
        // Cargar partidos disponibles
        if (data.equipo_id && data.categoria_id) {
          await fetchPartidosDisponibles(data.equipo_id, data.categoria_id);
        }
        
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
        console.error('Error al cargar análisis:', err);
        Alert.alert('Error', 'No se pudo cargar la información del análisis');
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
          if (file) setNuevoPdf(file);
        };
        input.click();
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setNuevoPdf(result.assets[0]);
      }
    } catch (err: any) {
      Alert.alert('Error', `No se pudo seleccionar el archivo: ${err?.message ?? err}`);
    }
  };

  const subirArchivo = async (file: FileOrAsset, bucket: string, carpeta: string): Promise<{ url: string; path: string }> => {
    const originalName = Platform.OS === 'web' ? (file as File).name : (file as DocumentPicker.DocumentPickerAsset).name;
    const extension = (originalName?.split('.').pop() || 'bin').toLowerCase();
    const fileName = generarNombreArchivo(extension);
    const filePath = `${carpeta}/${fileName}`;
    const mimeType = Platform.OS === 'web'
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
  };

  const actualizarAnalisis = async () => {
    setLoading(true);
    try {
      // Obtener el análisis actual para eliminar PDF antiguo si es necesario
      const { data: analisisActual, error: fetchError } = await supabase
        .from('analisispartidos')
        .select('pdf_url')
        .eq('id', analisisId)
        .single();

      if (fetchError) {
        console.warn('No se pudo obtener análisis actual:', fetchError);
      }

      const updates: any = {
        descripcion: descripcion.trim() || null,
        partido_id: partidoId || null,
      };

      // Manejar actualización de PDF (tanto para YouTube como Supabase)
      if (nuevoPdf) {
        // Eliminar PDF antiguo del storage si existe
        if (analisisActual?.pdf_url) {
          try {
            // Extraer el path del PDF desde la URL
            const urlParts = analisisActual.pdf_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            // Buscar en la carpeta analisis
            const pdfPath = `analisis/${fileName}`;
            
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
        const nuevoPdfArchivo = await subirArchivo(nuevoPdf, 'informes', 'analisis');
        updates.pdf_url = nuevoPdfArchivo.url;
      }

      // Para videos de YouTube, solo actualizar descripción, partido y PDF
      if (esYoutube) {
        const { error } = await supabase
          .from('analisispartidos')
          .update(updates)
          .eq('id', analisisId);

        if (error) throw error;

        Alert.alert('Éxito', 'Análisis actualizado correctamente');
        navigation.goBack();
        return;
      }

      // Para videos de Supabase, actualizar video también si se seleccionó uno nuevo
      if (nuevoVideo) {
        const nuevoArchivo = await subirArchivo(nuevoVideo, 'videos1', 'analisis');
        updates.video_url = nuevoArchivo.url;
      }

      const { error } = await supabase
        .from('analisispartidos')
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

  // Estados para el modal de búsqueda de partidos (ya están definidos arriba)

  // Calcular el paddingTop necesario para que el contenido quede debajo del banner
  const statusBarHeight = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0);
  const bannerHeight = 56; // Altura del HeaderLogo
  const paddingTopNecesario = statusBarHeight + bannerHeight + 20; // 20px de espacio adicional

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <HeaderLogo />
      <ScrollView 
        {...(Platform.OS === 'web' ? { 'data-scrollview-web': true } : {})}
        contentContainerStyle={{ 
          padding: 20, 
          paddingTop: paddingTopNecesario,
          paddingBottom: Platform.OS === 'web' ? 100 : 40,
        }}
        style={{ flex: 1 }}
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
          {/* Información de video de YouTube - igual que en EditarVideo */}
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
            textColor={Platform.OS === 'web' ? '#000' : undefined}
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
            textColor={Platform.OS === 'web' ? '#000' : undefined}
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

      {/* Selector de partido asociado */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: '#fff', marginBottom: 12, fontSize: 16, fontWeight: '600' }}>
          Partido asociado
        </Text>
        <Button
          mode="outlined"
          onPress={() => {
            if (partidosDisponibles.length > 0) {
              setModalPartidoVisible(true);
            } else {
              Alert.alert('Info', 'No hay partidos disponibles para este equipo y categoría');
            }
          }}
          style={{ 
            backgroundColor: partidoId ? '#1F3F1F' : '#1F1F1F',
            borderColor: partidoId ? '#00AA00' : '#666',
            borderWidth: 2,
            paddingVertical: 12
          }}
          labelStyle={{ 
            color: '#fff',
            fontWeight: '600',
            fontSize: 15
          }}
          icon={partidoId ? 'check-circle' : 'soccer'}
          disabled={loading}
        >
          {partidoId 
            ? partidosDisponibles.find(p => p.id === partidoId)?.descripcion || 'Partido seleccionado'
            : 'Seleccionar partido asociado'
          }
        </Button>
      </View>

      {/* Modal de búsqueda de partidos */}
      <Modal
        visible={modalPartidoVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalPartidoVisible(false);
          setBusquedaPartido('');
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: '#121212',
            borderRadius: 10,
            padding: 20,
            width: '90%',
            maxHeight: '80%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                padding: 5,
                zIndex: 1,
              }}
              onPress={() => {
                setModalPartidoVisible(false);
                setBusquedaPartido('');
              }}
            >
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' }}>
              Seleccionar Partido
            </Text>
            <TextInput
              label="Buscar partido"
              value={busquedaPartido}
              onChangeText={setBusquedaPartido}
              mode="outlined"
              style={[Platform.OS === 'web' ? { marginBottom: 15, backgroundColor: '#fff', borderRadius: 5 } : { marginBottom: 15, backgroundColor: '#1F1F1F', borderRadius: 5 }]}
              textColor={Platform.OS === 'web' ? '#000' : undefined}
              theme={{ 
                colors: { 
                  primary: '#00AA00', 
                  text: Platform.OS === 'web' ? '#000' : '#fff', 
                  placeholder: Platform.OS === 'web' ? '#666' : '#aaa', 
                  background: Platform.OS === 'web' ? '#fff' : '#1F1F1F' 
                } 
              }}
            />

            <FlatList
              data={partidosDisponibles.filter(p => 
                !busquedaPartido || 
                p.descripcion?.toLowerCase().includes(busquedaPartido.toLowerCase())
              )}
              keyExtractor={(item) => item.id || 'null'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setPartidoId(item.id);
                    setModalPartidoVisible(false);
                    setBusquedaPartido('');
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#333',
                    backgroundColor: partidoId === item.id ? '#00AA00' : 'transparent',
                    borderRadius: partidoId === item.id ? 5 : 0,
                  }}
                >
                  <Text style={{ 
                    color: '#fff', 
                    fontSize: 16,
                    fontWeight: partidoId === item.id ? 'bold' : 'normal'
                  }}>
                    {item.descripcion || 'Sin descripción'}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 20 }}>
                  {busquedaPartido ? 'No se encontraron partidos' : 'No hay partidos disponibles'}
                </Text>
              }
            />
            {partidoId && (
              <Button
                mode="outlined"
                onPress={() => {
                  setPartidoId(null);
                  setModalPartidoVisible(false);
                  setBusquedaPartido('');
                }}
                style={{ marginTop: 20, backgroundColor: '#FF6347' }}
              >
                Quitar asociación
              </Button>
            )}
          </View>
        </View>
      </Modal>

      {/* PDF siempre disponible para editar */}
      <View style={{ marginBottom: 20 }}>
        <Button 
          mode="outlined" 
          onPress={seleccionarNuevoPdf} 
          style={{ 
            backgroundColor: nuevoPdf ? '#1F3F1F' : '#1F1F1F',
            borderColor: nuevoPdf ? '#00AA00' : '#666',
            borderWidth: 2,
            paddingVertical: 12
          }}
          labelStyle={{ 
            color: '#fff',
            fontWeight: '600',
            fontSize: 15
          }}
          icon={nuevoPdf ? 'check-circle' : 'file-document'}
          disabled={loading}
        >
          {nuevoPdf ? 'PDF seleccionado ✓' : pdfUrl ? 'Cambiar PDF' : 'Seleccionar PDF'}
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

