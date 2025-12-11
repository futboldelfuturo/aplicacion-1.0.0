// src/screens/entrenador/SubirDeNube.tsx
import React, { useEffect, useState } from 'react';
import { View, Alert, ScrollView, Platform, StatusBar, FlatList, TouchableOpacity, Image, ActivityIndicator as RNActivityIndicator } from 'react-native';
import { TextInput, Button, ActivityIndicator, Text } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../utils/supabase';
import { listarVideosYouTube, YouTubeVideo } from '../../utils/youtubeList';
import HeaderLogo from '../../components/HeaderLogo';
import { Feather } from '@expo/vector-icons';
import { EntrenadorStackParamList } from '../../types';

export default function SubirDeNube() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<EntrenadorStackParamList, 'SubirDeNube'>>();
  const { tipo = 'entrenamiento', equipoId = '', categoriaId = '', jugadorId } = route.params || {};

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [videosFiltrados, setVideosFiltrados] = useState<YouTubeVideo[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(false);
  const [cargandoVideos, setCargandoVideos] = useState(true);
  const [videoSeleccionado, setVideoSeleccionado] = useState<YouTubeVideo | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [canalAsignado, setCanalAsignado] = useState<string | null>(null);
  const [verificandoCanal, setVerificandoCanal] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [prevPageToken, setPrevPageToken] = useState<string | undefined>();

  // Verificar canal asignado al equipo
  useEffect(() => {
    const verificarCanal = async () => {
      if (!equipoId) {
        setCanalAsignado(null);
        setVerificandoCanal(false);
        return;
      }
      
      setVerificandoCanal(true);
      try {
        const { data: equipo, error } = await supabase
          .from('teams')
          .select(`
            youtube_canal_id,
            youtube_canales:youtube_canal_id (
              nombre_canal
            )
          `)
          .eq('id', equipoId)
          .single();
        
        if (error) {
          console.error('Error al verificar canal del equipo:', error);
          setCanalAsignado(null);
        } else if (equipo?.youtube_canal_id) {
          const canal = equipo.youtube_canales as any;
          setCanalAsignado(canal?.nombre_canal || 'Canal asignado');
        } else {
          setCanalAsignado(null);
        }
      } catch (error) {
        console.error('Error al verificar canal del equipo:', error);
        setCanalAsignado(null);
      } finally {
        setVerificandoCanal(false);
      }
    };
    verificarCanal();
  }, [equipoId]);

  // Cargar videos del canal cuando el canal esté verificado
  useEffect(() => {
    if (canalAsignado && equipoId) {
      cargarVideos();
    }
  }, [canalAsignado, equipoId]);

  // Filtrar videos cuando cambia la búsqueda
  useEffect(() => {
    if (busqueda.trim() === '') {
      setVideosFiltrados(videos);
    } else {
      const filtrados = videos.filter(video =>
        video.title.toLowerCase().includes(busqueda.toLowerCase()) ||
        video.description.toLowerCase().includes(busqueda.toLowerCase())
      );
      setVideosFiltrados(filtrados);
    }
  }, [busqueda, videos]);

  const cargarVideos = async (pageToken?: string) => {
    if (!equipoId) {
      Alert.alert('Error', 'No hay equipo seleccionado.');
      return;
    }

    // Si no hay pageToken, verificar el canal antes de cargar (para la primera carga)
    // Si hay pageToken, asumimos que el canal ya está verificado
    if (!pageToken && !canalAsignado) {
      // Verificar el canal directamente antes de cargar videos
      let tieneCanal = false;
      try {
        const { data: equipo } = await supabase
          .from('teams')
          .select(`
            youtube_canal_id,
            youtube_canales:youtube_canal_id (
              nombre_canal,
              channel_id
            )
          `)
          .eq('id', equipoId)
          .single();
        
        if (equipo?.youtube_canal_id) {
          tieneCanal = true;
          const canal = equipo.youtube_canales as any;
          setCanalAsignado(canal?.nombre_canal || 'Canal asignado');
        }
      } catch (error) {
        console.error('Error al verificar canal:', error);
      }

      if (!tieneCanal) {
        Alert.alert('Error', 'El equipo seleccionado no tiene un canal de YouTube asignado.');
        return;
      }
    }

    setCargandoVideos(true);
    try {
      const result = await listarVideosYouTube(equipoId, 50, pageToken);
      if (pageToken) {
        // Agregar a la lista existente
        setVideos(prev => [...prev, ...result.videos]);
      } else {
        // Reemplazar la lista
        setVideos(result.videos);
      }
      setVideosFiltrados(result.videos);
      setNextPageToken(result.nextPageToken);
      setPrevPageToken(result.prevPageToken);
    } catch (error: any) {
      console.error('Error al cargar videos:', error);
      Alert.alert('Error', `No se pudieron cargar los videos: ${error.message || 'Error desconocido'}`);
    } finally {
      setCargandoVideos(false);
    }
  };

  const handleSeleccionarVideo = (video: YouTubeVideo) => {
    setVideoSeleccionado(video);
    setDescripcion(video.description || video.title);
  };

  const handleAsignarVideo = async () => {
    if (!videoSeleccionado) {
      if (Platform.OS === 'web') {
        window.alert('❌ Error\n\nPor favor selecciona un video.');
      } else {
        Alert.alert('Error', 'Por favor selecciona un video.');
      }
      return;
    }

    if (!equipoId) {
      if (Platform.OS === 'web') {
        window.alert('❌ Error\n\nFalta el equipo seleccionado.');
      } else {
        Alert.alert('Error', 'Falta el equipo seleccionado.');
      }
      return;
    }

    // Para futpro, se requiere jugadorId
    if (tipo === 'futpro' && !jugadorId) {
      if (Platform.OS === 'web') {
        window.alert('❌ Error\n\nFalta el jugador seleccionado.');
      } else {
        Alert.alert('Error', 'Falta el jugador seleccionado.');
      }
      return;
    }

    // Para otros tipos, se requiere categoriaId
    if (tipo !== 'futpro' && !categoriaId) {
      if (Platform.OS === 'web') {
        window.alert('❌ Error\n\nFalta la categoría seleccionada.');
      } else {
        Alert.alert('Error', 'Falta la categoría seleccionada.');
      }
      return;
    }

    setLoading(true);
    try {
      // Verificar si el video ya existe en la base de datos
      if (tipo === 'analisis') {
        // Para análisis, verificar por video_url ya que no hay youtube_video_id
        const { data: videoExistente } = await supabase
          .from('analisispartidos')
          .select('id')
          .eq('video_url', videoSeleccionado.videoUrl)
          .eq('equipo_id', equipoId)
          .eq('categoria_id', categoriaId)
          .maybeSingle();

        if (videoExistente) {
          if (Platform.OS === 'web') {
            window.alert('⚠️ Aviso\n\nEste video ya está asignado a esta categoría.');
          } else {
            Alert.alert('Aviso', 'Este video ya está asignado a esta categoría.');
          }
          setLoading(false);
          return;
        }
      } else if (tipo === 'futpro') {
        // Para futpro, verificar por video_url y jugador_id
        const { data: videoExistente } = await supabase
          .from('analisisjugadores')
          .select('id')
          .eq('video_url', videoSeleccionado.videoUrl)
          .eq('jugador_id', jugadorId)
          .eq('equipo_id', equipoId)
          .maybeSingle();

        if (videoExistente) {
          if (Platform.OS === 'web') {
            window.alert('⚠️ Aviso\n\nEste video ya está asignado a este jugador.');
          } else {
            Alert.alert('Aviso', 'Este video ya está asignado a este jugador.');
          }
          setLoading(false);
          return;
        }
      } else {
        const { data: videoExistente } = await supabase
          .from('videos_entrenadores')
          .select('id')
          .eq('youtube_video_id', videoSeleccionado.id)
          .eq('equipo_id', equipoId)
          .eq('categoria_id', categoriaId)
          .maybeSingle();

        if (videoExistente) {
          if (Platform.OS === 'web') {
            window.alert('⚠️ Aviso\n\nEste video ya está asignado a esta categoría.');
          } else {
            Alert.alert('Aviso', 'Este video ya está asignado a esta categoría.');
          }
          setLoading(false);
          return;
        }
      }

      // Insertar el video en la base de datos
      if (tipo === 'analisis') {
        // Obtener el ID del usuario actual (analista) - REQUERIDO
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (Platform.OS === 'web') {
            window.alert('❌ Error\n\nNo hay usuario autenticado.');
          } else {
            Alert.alert('Error', 'No hay usuario autenticado.');
          }
          setLoading(false);
          return;
        }

        // La tabla analisispartidos NO tiene campos youtube_video_id ni es_youtube
        const { error } = await supabase
          .from('analisispartidos')
          .insert({
            equipo_id: equipoId,
            categoria_id: categoriaId,
            analista_id: user.id, // REQUERIDO - agregar analista_id
            descripcion: descripcion.trim() || videoSeleccionado.title,
            video_url: videoSeleccionado.videoUrl, // URL de YouTube
            fecha: new Date().toISOString(),
            pdf_url: '', // Análisis de nube no tiene PDF inicialmente (requerido NOT NULL)
          });
        
        if (error) {
          throw error;
        }
      } else if (tipo === 'futpro') {
        // Obtener el ID del usuario actual (analista)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (Platform.OS === 'web') {
            window.alert('❌ Error\n\nNo hay usuario autenticado.');
          } else {
            Alert.alert('Error', 'No hay usuario autenticado.');
          }
          setLoading(false);
          return;
        }

        // Insertar en analisisjugadores
        const payload: any = {
          equipo_id: equipoId,
          jugador_id: jugadorId,
          analista_id: user.id, // ID del usuario actual
          descripcion: descripcion.trim() || videoSeleccionado.title,
          video_url: videoSeleccionado.videoUrl,
          fecha: new Date().toISOString(),
        };
        
        // Solo agregar categoria_id si está presente y no está vacío
        if (categoriaId && categoriaId.trim() !== '') {
          payload.categoria_id = categoriaId;
        }
        
        const { error } = await supabase
          .from('analisisjugadores')
          .insert(payload);
        
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('videos_entrenadores')
          .insert({
            equipo_id: equipoId,
            categoria_id: categoriaId,
            tipo: tipo,
            descripcion: descripcion.trim() || videoSeleccionado.title,
            video_url: videoSeleccionado.videoUrl,
            youtube_video_id: videoSeleccionado.id,
            es_youtube: true,
            creado_en: new Date().toISOString(),
          });
        
        if (error) {
          throw error;
        }
      }

      if (Platform.OS === 'web') {
        window.alert('✅ Video asignado correctamente a la aplicación.');
        navigation.goBack();
      } else {
        Alert.alert('Éxito', 'Video asignado correctamente a la aplicación.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error: any) {
      console.error('Error al asignar video:', error);
      if (Platform.OS === 'web') {
        window.alert(`❌ Error\n\nNo se pudo asignar el video: ${error.message || 'Error desconocido'}`);
      } else {
        Alert.alert('Error', `No se pudo asignar el video: ${error.message || 'Error desconocido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Calcular el paddingTop necesario para que el contenido quede debajo del banner
  const statusBarHeight = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0);
  const bannerHeight = 56;
  const paddingTopNecesario = statusBarHeight + bannerHeight + 20;

  const renderVideoItem = ({ item }: { item: YouTubeVideo }) => {
    const isSelected = videoSeleccionado?.id === item.id;
    
    return (
      <TouchableOpacity
        style={{
          backgroundColor: isSelected ? '#1F3F1F' : '#1F1F1F',
          borderRadius: 12,
          padding: Platform.OS === 'web' ? 16 : 12,
          marginBottom: 12,
          borderWidth: 2,
          borderColor: isSelected ? '#00AA00' : '#333',
          width: '100%',
          maxWidth: '100%',
        }}
        onPress={() => handleSeleccionarVideo(item)}
      >
        <View style={{ flexDirection: 'row', flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap' }}>
          {item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              style={{ 
                width: Platform.OS === 'web' ? 160 : 120, 
                height: Platform.OS === 'web' ? 120 : 90, 
                borderRadius: 8, 
                marginRight: 12,
                flexShrink: 0,
              }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ 
              width: Platform.OS === 'web' ? 160 : 120, 
              height: Platform.OS === 'web' ? 120 : 90, 
              borderRadius: 8, 
              marginRight: 12, 
              backgroundColor: '#333', 
              justifyContent: 'center', 
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <Feather name="video" size={32} color="#666" />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#fff', fontSize: Platform.OS === 'web' ? 15 : 14, fontWeight: '600', marginBottom: 4 }} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={{ color: '#aaa', fontSize: Platform.OS === 'web' ? 13 : 12, marginBottom: 4 }} numberOfLines={2}>
              {item.description || 'Sin descripción'}
            </Text>
            <Text style={{ color: '#666', fontSize: Platform.OS === 'web' ? 12 : 11 }}>
              {new Date(item.publishedAt).toLocaleDateString('es-ES')}
            </Text>
            {isSelected && (
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="check-circle" size={16} color="#00AA00" />
                <Text style={{ color: '#00AA00', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
                  Seleccionado
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
        <Text style={{
          marginBottom: 24,
          fontWeight: 'bold',
          color: '#fff',
          fontSize: 24,
          textAlign: 'center'
        }}>
          +Youtube - {tipo}
        </Text>

        {verificandoCanal ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <RNActivityIndicator size="large" color="#00AA00" />
            <Text style={{ color: '#fff', marginTop: 12 }}>Verificando canal del equipo...</Text>
          </View>
        ) : !canalAsignado ? (
          <View style={{
            backgroundColor: '#FFA500',
            padding: 16,
            borderRadius: 12,
            marginBottom: 20,
            borderLeftWidth: 4,
            borderLeftColor: '#FF8C00'
          }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              ⚠️ El equipo seleccionado no tiene un canal de YouTube asignado. Contacta al administrador.
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              label="Buscar video"
              value={busqueda}
              onChangeText={setBusqueda}
              mode="outlined"
              style={{ marginBottom: 20, backgroundColor: '#fff' }}
              textColor={Platform.OS === 'web' ? '#000' : undefined}
              left={<TextInput.Icon icon="magnify" />}
              placeholder="Buscar por título o descripción..."
              theme={{
                colors: {
                  primary: "#00AA00",
                  text: Platform.OS === 'web' ? "#000" : undefined,
                  placeholder: "#666",
                  background: "#fff",
                },
              }}
            />

            {/* Sección de video seleccionado - aparece justo después del buscador */}
            {videoSeleccionado && (
              <View style={{
                backgroundColor: '#1F1F1F',
                padding: Platform.OS === 'web' ? 20 : 16,
                borderRadius: 12,
                marginBottom: 20,
                borderLeftWidth: 4,
                borderLeftColor: '#00AA00',
                width: '100%',
                maxWidth: '100%',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Feather name="check-circle" size={20} color="#00AA00" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                    Video seleccionado
                  </Text>
                </View>
                <Text style={{ color: '#aaa', fontSize: 14, marginBottom: 12 }} numberOfLines={2}>
                  {videoSeleccionado.title}
                </Text>
                <TextInput
                  label="Descripción (opcional)"
                  value={descripcion}
                  onChangeText={setDescripcion}
                  mode="outlined"
                  multiline
                  numberOfLines={4}
                  style={{ marginBottom: 16, backgroundColor: '#fff' }}
                  textColor={Platform.OS === 'web' ? '#000' : undefined}
                  placeholder="Agrega una descripción para el video en la aplicación"
                  theme={{
                    colors: {
                      primary: "#00AA00",
                      text: Platform.OS === 'web' ? "#000" : undefined,
                      placeholder: "#666",
                      background: "#fff",
                    },
                  }}
                />
                <Button
                  mode="contained"
                  onPress={handleAsignarVideo}
                  disabled={loading}
                  style={{
                    backgroundColor: '#00AA00',
                    paddingVertical: 8,
                  }}
                  loading={loading}
                >
                  {loading ? 'Asignando...' : 'Asignar video a la aplicación'}
                </Button>
              </View>
            )}

            {cargandoVideos ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <RNActivityIndicator size="large" color="#00AA00" />
                <Text style={{ color: '#fff', marginTop: 12 }}>Cargando videos del canal...</Text>
              </View>
            ) : videosFiltrados.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Feather name="video-off" size={48} color="#666" />
                <Text style={{ color: '#aaa', marginTop: 12, textAlign: 'center' }}>
                  {busqueda.trim() ? 'No se encontraron videos con ese criterio' : 'No hay videos en el canal'}
                </Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={videosFiltrados}
                  renderItem={renderVideoItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ListFooterComponent={
                    <View style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
                      {prevPageToken && (
                        <Button
                          mode="outlined"
                          onPress={() => cargarVideos(prevPageToken)}
                          style={{ flex: 1, marginRight: 8 }}
                        >
                          Anterior
                        </Button>
                      )}
                      {nextPageToken && (
                        <Button
                          mode="outlined"
                          onPress={() => cargarVideos(nextPageToken)}
                          style={{ flex: 1, marginLeft: 8 }}
                        >
                          Siguiente
                        </Button>
                      )}
                    </View>
                  }
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

