// src/screens/entrenador/ContenidoPorCategoria.tsx
import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  Animated,
  Image,
  Modal,
} from 'react-native';
import {
  useRoute,
  useNavigation,
  useFocusEffect,
  RouteProp,
} from '@react-navigation/native';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../utils/supabase';
import HeaderLogo from '../../components/HeaderLogo';
import {
  format,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  getYear,
  getMonth,
} from 'date-fns';
import { es } from 'date-fns/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EntrenadorStackParamList } from '../../types';
import VideoPreview from '../../components/VideoPreview';
import { Button, TextInput, Menu } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import * as Linking from 'expo-linking';
import { Feather } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;
const previewHeight = Platform.OS === 'web' ? 140 : 180;
// En web, usar un ancho más pequeño y centrado
const previewWidth = Platform.OS === 'web' 
  ? Math.min(280, (screenWidth - 120) / 2.5) 
  : Math.min(540, (screenWidth - 32 - 50) / 2);

type NavigationProp = NativeStackNavigationProp<
  EntrenadorStackParamList,
  'ContenidoPorCategoria'
>;

type RouteParams = RouteProp<EntrenadorStackParamList, 'ContenidoPorCategoria'>;

type VideoItemLocal = {
  id: string | null;
  descripcion?: string | null;
  creado_en?: string | null;
  video_url?: string | null;
  video_path?: string | null;
  informe_url?: string | null;
  informe_path?: string | null;
  partido_id?: string | null;
  analista_id?: string | null;
  fecha?: string | null;
  raw?: any;
  [key: string]: any;
};

const ContenidoPorCategoria: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();

  // Normalizamos route.params primero para evitar errores de TS/undefined
  const params = (route.params ?? {}) as RouteParams & {
    tipoContenido?: 'entrenamiento' | 'partido' | 'analisis';
    categoriaId: string;
    categoriaNombre?: string;
    permiteSubir?: boolean;
    equipoId?: string;
  };

  const {
    categoriaId,
    categoriaNombre,
    tipoContenido,
    permiteSubir,
    equipoId: equipoIdParam,
  } = params;

  const tipoStr = String(tipoContenido ?? '');

  const { equipoId: equipoIdContext, rolActual, initRoles } = useAppContext();
  const equipoId: string = (equipoIdParam ?? equipoIdContext ?? '') as string;

  const [videos, setVideos] = useState<VideoItemLocal[]>([]);
  const [videosOriginales, setVideosOriginales] = useState<VideoItemLocal[]>([]);
  const [agrupados, setAgrupados] = useState<{ [semana: string]: VideoItemLocal[] }>({});
  const [filtroDescripcion, setFiltroDescripcion] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState<string | null>(null); // formato: "YYYY-MM" o "todos"
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const [mesesDisponibles, setMesesDisponibles] = useState<{ mes: string; nombre: string; cantidad: number }[]>([]);
  const [analisisPorPartido, setAnalisisPorPartido] = useState<{ [partidoId: string]: { pdf_url: string } }>({});
  const [modalMesVisible, setModalMesVisible] = useState(false);
  const [busquedaMes, setBusquedaMes] = useState('');

  // ANALISIS state (solo para editar, la subida ahora es en pantalla separada)
  const [partidosDisponibles, setPartidosDisponibles] = useState<VideoItemLocal[]>([]);

  // Estados de edición de análisis eliminados - ahora se usa pantalla separada

  const generarNombreArchivo = (extension: string) => {
    const randomString = Math.random().toString(36).substring(2, 10);
    return `${Date.now()}_${randomString}.${extension}`;
  };

  const getFileName = (file: any) => {
    if (!file) return '';
    if (file?.assets?.length) {
      const asset = file.assets[0];
      if (asset?.name) return asset.name as string;
      if (asset?.uri) return String(asset.uri).split('/').pop() ?? String(asset.uri);
    }
    if (file?.name) return file.name as string;
    if (typeof file === 'string') return file.split('/').pop() || file;
    if (file?.uri) return String(file.uri).split('/').pop() ?? String(file.uri);
    return String(file);
  };

  const subirArchivo = async (file: any, bucket: string, carpeta: string) => {
    try {
      const normalized = file?.assets?.length ? file.assets[0] : file;
      const originalName =
        Platform.OS === 'web'
          ? (normalized as File).name
          : (normalized?.name ?? (normalized?.uri ?? '').split('/').pop());
      const extension = (originalName?.split('.').pop() || 'bin').toString().toLowerCase();
      const fileName = generarNombreArchivo(extension);
      const filePath = `${carpeta}/${fileName}`;

      const mimeType =
        Platform.OS === 'web'
          ? (normalized as File).type || 'application/octet-stream'
          : normalized?.mimeType || normalized?.type || 'application/octet-stream';

      if (Platform.OS === 'web') {
        const webFile = normalized as File;
        const { error } = await supabase.storage.from(bucket).upload(filePath, webFile, {
          contentType: mimeType,
          upsert: false,
        });
        if (error) throw error;
      } else {
        const uri = normalized?.uri;
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

  // Partidos disponibles (tipo = 'partido')
  const fetchPartidosDisponibles = async () => {
    try {
      if (!equipoId) return;
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

  // Cargar filtro guardado
  const cargarFiltroGuardado = async (): Promise<string | null> => {
    try {
      const key = `filtro_mes_${tipoStr}_${equipoId}_${categoriaId}`;
      const guardado = await AsyncStorage.getItem(key);
      if (guardado) {
        setMesSeleccionado(guardado);
        return guardado;
      }
      return null;
    } catch (e) {
      console.warn('Error cargando filtro guardado:', e);
      return null;
    }
  };

  // Guardar filtro
  const guardarFiltro = async (mes: string | null) => {
    try {
      const key = `filtro_mes_${tipoStr}_${equipoId}_${categoriaId}`;
      if (mes) {
        await AsyncStorage.setItem(key, mes);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Error guardando filtro:', e);
    }
  };

  // Calcular meses disponibles - todos los meses del año actual y anterior
  const calcularMesesDisponibles = (lista: VideoItemLocal[]) => {
    const mesesMap: { [key: string]: number } = {};
    
    lista.forEach((video) => {
      const fechaStr = video.creado_en ?? video.fecha ?? new Date().toISOString();
      const fecha = new Date(fechaStr);
      if (!isNaN(fecha.getTime())) {
        const mesKey = format(fecha, 'yyyy-MM');
        mesesMap[mesKey] = (mesesMap[mesKey] || 0) + 1;
      }
    });

    // Generar todos los meses del año actual y anterior
    const ahora = new Date();
    const meses: { mes: string; nombre: string; cantidad: number }[] = [];
    
    // Año actual
    for (let i = ahora.getMonth(); i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), i, 1);
      const mesKey = format(fecha, 'yyyy-MM');
      meses.push({
        mes: mesKey,
        nombre: format(fecha, 'MMMM yyyy', { locale: es }),
        cantidad: mesesMap[mesKey] || 0,
      });
    }
    
    // Año anterior completo
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear() - 1, i, 1);
      const mesKey = format(fecha, 'yyyy-MM');
      meses.push({
        mes: mesKey,
        nombre: format(fecha, 'MMMM yyyy', { locale: es }),
        cantidad: mesesMap[mesKey] || 0,
      });
    }

    setMesesDisponibles(meses);
  };

  // Fetch principal
  const fetchVideos = async () => {
    try {
      if (!equipoId) return;

      if (tipoStr === 'analisis') {
        const { data, error } = await supabase
          .from('analisispartidos')
          .select('*')
          .eq('equipo_id', equipoId)
          .eq('categoria_id', categoriaId)
          .order('fecha', { ascending: false });

        if (error) {
          console.error('Error cargando análisis:', error);
          setVideos([]);
          setVideosOriginales([]);
          setAgrupados({});
          return;
        }

        const mapped = (data || []).map((a: any) => ({
          id: a.id ?? null,
          descripcion: a.descripcion,
          creado_en: a.fecha ?? a.created_at ?? null,
          video_url: a.video_url ?? null,
          informe_url: a.pdf_url ?? a.informe_url ?? null,
          partido_id: a.partido_id ?? null,
          analista_id: a.analista_id ?? null,
          raw: a,
        }));
        setVideosOriginales(mapped);
        calcularMesesDisponibles(mapped);
        const filtroGuardado = await cargarFiltroGuardado();
        aplicarFiltroMes(mapped, filtroGuardado || mesSeleccionado);
      } else {
        const { data, error } = await supabase
          .from('videos_entrenadores')
          .select('*')
          .eq('equipo_id', equipoId)
          .eq('categoria_id', categoriaId)
          .eq('tipo', tipoStr)
          .order('creado_en', { ascending: false });
        if (error) throw error;
        
        // Si es tipo 'partido', cargar análisis asociados para obtener PDFs
        let analisisMap: { [partidoId: string]: { pdf_url: string } } = {};
        if (tipoStr === 'partido') {
          const partidoIds = (data || []).map((v: any) => v.id).filter(Boolean);
          if (partidoIds.length > 0) {
            const { data: analisisData } = await supabase
              .from('analisispartidos')
              .select('partido_id, pdf_url')
              .in('partido_id', partidoIds)
              .not('pdf_url', 'is', null);
            
            if (analisisData) {
              analisisData.forEach((a: any) => {
                if (a.partido_id && a.pdf_url) {
                  analisisMap[a.partido_id] = { pdf_url: a.pdf_url };
                }
              });
            }
          }
          setAnalisisPorPartido(analisisMap);
        }
        
        const mapped = (data || []).map((v: any) => ({
          id: v.id ?? null,
          descripcion: v.descripcion,
          creado_en: v.creado_en ?? v.created_at ?? null,
          video_url: v.video_url ?? null,
          video_path: v.video_path ?? null,
          // Para partidos, usar PDF del análisis asociado si existe
          informe_url: tipoStr === 'partido' 
            ? (analisisMap[v.id]?.pdf_url || null)
            : (v.informe_url ?? v.pdf_url ?? null),
          informe_path: v.informe_path ?? null,
          raw: v,
        }));
        setVideosOriginales(mapped);
        calcularMesesDisponibles(mapped);
        const filtroGuardado = await cargarFiltroGuardado();
        aplicarFiltroMes(mapped, filtroGuardado || mesSeleccionado);
      }
    } catch (err: any) {
      console.error('Error al cargar videos:', err?.message ?? err);
      Alert.alert('Error', 'No se pudieron cargar los videos.');
      setVideos([]);
      setVideosOriginales([]);
      setAgrupados({});
    }
  };

  // Aplicar filtro por mes
  const aplicarFiltroMes = (lista: VideoItemLocal[], mes: string | null) => {
    let filtrados = [...lista];

    if (filtroDescripcion.trim() !== '') {
      filtrados = filtrados.filter((v) =>
        (v.descripcion || '').toLowerCase().includes(filtroDescripcion.trim().toLowerCase())
      );
    }

    if (mes && mes !== 'todos') {
      const [year, month] = mes.split('-').map(Number);
      const inicio = startOfMonth(new Date(year, month - 1));
      const fin = endOfMonth(new Date(year, month - 1));
      
      filtrados = filtrados.filter((v) => {
        const fechaStr = v.creado_en ?? v.fecha ?? '';
        if (!fechaStr) return false;
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) return false;
        return isWithinInterval(fecha, { start: inicio, end: fin });
      });
    }

    setVideos(filtrados);
    agruparPorSemana(filtrados);
  };

  const agruparPorSemana = (lista: VideoItemLocal[]) => {
    const resultado: { [semana: string]: VideoItemLocal[] } = {};
    lista.forEach((video) => {
      const fechaStr = video.creado_en ?? video.fecha ?? new Date().toISOString();
      const fecha = isNaN(new Date(fechaStr).getTime()) ? new Date() : new Date(fechaStr);
      const inicio = startOfWeek(fecha, { weekStartsOn: 1 });
      const fin = endOfWeek(fecha, { weekStartsOn: 1 });
      const clave = `Semana del ${format(inicio, 'dd MMM', { locale: es })} al ${format(
        fin,
        'dd MMM',
        { locale: es }
      )}`;
      if (!resultado[clave]) resultado[clave] = [];
      resultado[clave].push(video);
    });
    setAgrupados(resultado);
  };

  // Aplicar filtros
  const aplicarFiltros = async () => {
    await guardarFiltro(mesSeleccionado);
    aplicarFiltroMes(videosOriginales, mesSeleccionado);
  };

  // Eliminar registro
  const eliminarRegistro = async (item: VideoItemLocal) => {
    try {
      if (!item.id) {
        Alert.alert('Error', 'ID no disponible para eliminar.');
        return;
      }
      if (tipoStr === 'analisis') {
        const { error } = await supabase.from('analisispartidos').delete().eq('id', item.id);
        if (error) throw error;
        Alert.alert('Éxito', 'Análisis eliminado correctamente.');
      } else {
        if (item.video_path) {
          await supabase.storage
            .from('videos1')
            .remove([item.video_path])
            .catch((e) => {
              console.warn('No se pudo eliminar archivo de storage:', e);
            });
        }
        const { error } = await supabase.from('videos_entrenadores').delete().eq('id', item.id);
        if (error) throw error;
        Alert.alert('Éxito', 'Video eliminado correctamente.');
      }
      fetchVideos();
    } catch (err: any) {
      console.error('Error eliminando:', err);
      Alert.alert('Error', 'No se pudo eliminar.');
    }
  };

  const confirmarEliminar = (item: VideoItemLocal) => {
    const tipoLabel = tipoStr === 'analisis' ? 'análisis' : 'video';
    if (!item.id) {
      Alert.alert('Error', 'ID no disponible para eliminar.');
      return;
    }
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar ${tipoLabel}? Esta acción no se puede deshacer.`)) {
        eliminarRegistro(item);
      }
    } else {
      Alert.alert(
        `¿Eliminar ${tipoLabel}?`,
        'Esta acción no se puede deshacer.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => eliminarRegistro(item) },
        ],
        { cancelable: true }
      );
    }
  };

  const verVideo = (item: VideoItemLocal) => {
    if (!item.video_url) {
      Alert.alert('No hay video disponible');
      return;
    }
    
    // Si es video de YouTube, abrir directamente en YouTube
    const esYoutube = item.video_url.includes('youtube.com') || item.video_url.includes('youtu.be');
    if (esYoutube) {
      if (Platform.OS === 'web') {
        window.open(item.video_url, '_blank');
      } else {
        Linking.openURL(item.video_url).catch(() => Alert.alert('Error', 'No se pudo abrir YouTube'));
      }
      return;
    }
    
    // Si no es YouTube, navegar a VideoPlayer como antes
    navigation.navigate('VideoPlayer', {
      videoUrl: item.video_url,
      titulo: item.descripcion || 'Video',
      descripcion: item.descripcion || '',
    });
  };

  const verPdf = (item: VideoItemLocal) => {
    const url = item.informe_url ?? item.pdf_url;
    if (!url) {
      if (Platform.OS === 'web') {
        window.alert('No hay informe PDF disponible');
      } else {
        Alert.alert('No hay informe PDF disponible');
      }
      return;
    }
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const abrirSubirAnalisis = () => {
    if (!equipoId) {
      Alert.alert('Error', 'No hay equipo seleccionado.');
      return;
    }
    navigation.navigate('SubirAnalisis', { equipoId, categoriaId });
  };


  // Función seleccionarArchivo eliminada - la edición de análisis ahora se hace en pantalla separada
  // Si se necesita en el futuro, se puede restaurar


  const abrirEditarAnalisis = (item: VideoItemLocal) => {
    if (!item.id) {
      Alert.alert('Error', 'ID del análisis no disponible.');
      return;
    }
    // Navegar a la pantalla de editar análisis
    navigation.navigate('EditarAnalisis', { analisisId: String(item.id) });
  };


  // useFocusEffect para recargar cuando vuelve a la pantalla
  useFocusEffect(
    useCallback(() => {
      // NO llamar initRoles aquí para evitar resetear el rol del usuario
      // Los roles ya están inicializados en AppContext

      // Si no hay equipo o categoría seleccionados, no intentamos fetchear contenido
      if (!equipoId || !categoriaId) {
        console.log('[ContenidoPorCategoria] Falta equipo o categoría seleccionados — no se carga contenido automáticamente');
        return;
      }

      if (tipoStr === 'analisis') {
        fetchPartidosDisponibles();
      }
      fetchVideos();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equipoId, categoriaId, tipoStr])
  );

  // ----- Permisos finos por rol -----
  const rolesPermitidosAnalisis = ['analista']; // Solo analista puede subir análisis
  const rolesPermitidosOtros = ['entrenador', 'analista', 'administrador'];

  const normalizadoRol = String(rolActual || '').trim().toLowerCase();
  const canUploadAnalisis =
    String(rolActual).trim().toLowerCase() === 'analista' &&
    tipoStr === 'analisis';


  const canUploadOtros =
    tipoStr !== 'analisis' && (rolesPermitidosOtros.includes(String(rolActual)) || !!permiteSubir);

  // Navegar a SubirVideo (entrenamiento/partido)
  const handleSubirVideo = () => {
    if (!equipoId) {
      Alert.alert('Error', 'No hay equipo seleccionado.');
      return;
    }
    navigation.navigate('SubirVideo', { equipoId, categoriaId, tipo: tipoStr as any });
  };

  // Navegar a SubirDeNube (solo para analistas)
  const handleSubirDeNube = () => {
    if (!equipoId) {
      Alert.alert('Error', 'No hay equipo seleccionado.');
      return;
    }
    navigation.navigate('SubirDeNube', { equipoId, categoriaId, tipo: tipoStr as any });
  };

  const goToEditarVideo = (videoId?: string | null) => {
    if (!videoId) {
      Alert.alert('Error', 'ID del video no disponible.');
      return;
    }
    navigation.navigate('EditarVideo', { videoId: String(videoId) });
  };


  // --- UI helpers: previews ---
  const AnimatedTouchable = useRef(Animated.createAnimatedComponent(TouchableOpacity)).current;

  const renderPreviews = (item: VideoItemLocal) => {
    const hasVideo = !!item.video_url;
    const hasPdf = !!(item.informe_url ?? item.pdf_url);

    // Si hay ambos, mostramos 2 previews lado a lado (video + pdf)
    if (hasVideo && hasPdf) {
      return (
        <View style={styles.previewsRow}>
          <View>
            <AnimatedTouchable
              style={[styles.previewTouchable, styles.previewHover]}
              onPress={() => verVideo(item)}
              activeOpacity={0.85}
            >
              <VideoPreview videoUrl={item.video_url ?? ''} style={{ width: previewWidth, height: previewHeight }} />
            </AnimatedTouchable>
            <Text style={styles.previewLabel}>Video</Text>
          </View>

          <View>
            <AnimatedTouchable
              style={[styles.previewTouchable, styles.previewHover]}
              onPress={() => verPdf(item)}
              activeOpacity={0.85}
            >
              <Image
                source={require('../../../assets/Flogo1.png')}
                style={{ width: previewWidth, height: previewHeight }}
                resizeMode="contain"
              />
            </AnimatedTouchable>
            <Text style={styles.previewLabel}>PDF</Text>
          </View>
        </View>
      );
    }

    // Si solo video -> single clickable preview
    if (hasVideo && !hasPdf) {
      return (
        <View style={styles.previewsRow}>
          <View>
            <AnimatedTouchable
              style={[styles.previewTouchableSingle, styles.previewHover]}
              onPress={() => verVideo(item)}
              activeOpacity={0.85}
            >
              <VideoPreview videoUrl={item.video_url ?? ''} style={{ width: previewWidth * 2 + 14, height: previewHeight }} />
            </AnimatedTouchable>
            <Text style={styles.previewLabel}>Video</Text>
          </View>
        </View>
      );
    }

    // Si solo pdf -> single clickable preview (imagen)
    if (!hasVideo && hasPdf) {
      return (
        <View style={styles.previewsRow}>
          <View>
            <AnimatedTouchable
              style={[styles.previewTouchableSingle, styles.previewHover]}
              onPress={() => verPdf(item)}
              activeOpacity={0.85}
            >
              <Image
                source={require('../../../assets/Flogo1.png')}
                style={{ width: previewWidth * 2 + 14, height: previewHeight }}
                resizeMode="contain"
              />
            </AnimatedTouchable>
            <Text style={styles.previewLabel}>PDF</Text>
          </View>
        </View>
      );
    }

    // Si no hay ninguno -> placeholder simple
    return (
      <View style={[styles.previewsRow, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={[styles.previewTouchableSingle, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#999' }}>Sin preview</Text>
        </View>
      </View>
    );
  };

  return (
    // Fondo general para que no aparezca "cuadrado blanco" al final
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <HeaderLogo />
      <ScrollView 
        {...(Platform.OS === 'web' ? { 'data-scrollview-web': true } : {})}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingTop: Platform.OS === 'web' ? 100 : 100 }]} 
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.titulo}>
            {tipoStr?.toUpperCase?.() ?? 'CONTENIDO'} - {categoriaNombre}
          </Text>
          {mesSeleccionado && (
            <View style={styles.filtroInfoContainer}>
              <Text style={styles.filtroInfoText}>
                {mesSeleccionado === 'todos' 
                  ? `Todos los videos (${videosOriginales.length})`
                  : mesesDisponibles.find(m => m.mes === mesSeleccionado) 
                    ? `${mesesDisponibles.find(m => m.mes === mesSeleccionado)?.nombre} (${videos.length} videos)`
                    : `Mes seleccionado (${videos.length} videos)`
                }
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8, alignItems: 'center' }}>
          {/* Para entrenamientos y partidos: primero el botón de subir, luego nube */}
          {canUploadOtros && (
            <TouchableOpacity style={[styles.botonSubir, { flex: 1 }]} onPress={handleSubirVideo}>
              <Text style={styles.textoBoton}>Subir</Text>
            </TouchableOpacity>
          )}

          {/* Para análisis: primero "Subir", luego "+Youtube" */}
          {canUploadAnalisis && (
            <TouchableOpacity style={[styles.botonSubir, { flex: 1 }]} onPress={abrirSubirAnalisis}>
              <Text style={styles.textoBoton}>Subir</Text>
            </TouchableOpacity>
          )}

          {/* Botón "Subir de nube" para analistas - aparece después del botón de subir correspondiente */}
          {String(rolActual).trim().toLowerCase() === 'analista' && (
            <TouchableOpacity style={[styles.botonSubirNube, { flex: 1 }]} onPress={handleSubirDeNube}>
              <Text style={styles.textoBoton}>+Youtube</Text>
            </TouchableOpacity>
          )}

          {/* Botón para abrir modal de filtro de meses */}
          <TouchableOpacity 
            style={[styles.filtrarBtn, { flex: 1 }]} 
            onPress={() => setModalMesVisible(true)}
          >
            <Text style={styles.filtrarText}>
              {mesSeleccionado === 'todos' 
                ? `Todos (${videosOriginales.length})` 
                : mesSeleccionado 
                  ? mesesDisponibles.find(m => m.mes === mesSeleccionado) 
                    ? `${mesesDisponibles.find(m => m.mes === mesSeleccionado)?.nombre} (${mesesDisponibles.find(m => m.mes === mesSeleccionado)?.cantidad || 0})`
                    : 'Seleccionar mes'
                  : 'Seleccionar mes'
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Modal de búsqueda de meses */}
        <Modal
          visible={modalMesVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setModalMesVisible(false);
            setBusquedaMes('');
          }}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}>
            <View style={{
              backgroundColor: '#1F1F1F',
              borderRadius: 12,
              padding: 20,
              width: '100%',
              maxWidth: 500,
              maxHeight: '80%',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Filtrar por mes</Text>
                <TouchableOpacity 
                  onPress={() => {
                    setModalMesVisible(false);
                    setBusquedaMes('');
                  }}
                  style={{ padding: 4 }}
                >
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="Buscar mes..."
                value={busquedaMes}
                onChangeText={setBusquedaMes}
                mode="outlined"
                style={{ marginBottom: 16, backgroundColor: '#fff' }}
                textColor={Platform.OS === 'web' ? '#000' : undefined}
                left={<TextInput.Icon icon="magnify" />}
                theme={{
                  colors: {
                    primary: "#00AA00",
                    text: Platform.OS === 'web' ? "#000" : undefined,
                    placeholder: "#666",
                    background: "#fff",
                  },
                }}
              />

              <FlatList
                data={[
                  { mes: 'todos', nombre: 'Todos', cantidad: videosOriginales.length },
                  ...mesesDisponibles
                ].filter(m => 
                  !busquedaMes || 
                  m.nombre?.toLowerCase().includes(busquedaMes.toLowerCase())
                )}
                keyExtractor={(item) => item.mes}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={async () => {
                      setMesSeleccionado(item.mes);
                      setModalMesVisible(false);
                      setBusquedaMes('');
                      await guardarFiltro(item.mes);
                      aplicarFiltroMes(videosOriginales, item.mes);
                    }}
                    style={{
                      padding: 16,
                      backgroundColor: mesSeleccionado === item.mes ? '#00AA00' : '#2F2F2F',
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 14, flex: 1 }}>
                        {item.nombre}
                      </Text>
                      <Text style={{ color: '#aaa', fontSize: 12 }}>
                        {item.cantidad} {item.cantidad === 1 ? 'video' : 'videos'}
                      </Text>
                    </View>
                    {mesSeleccionado === item.mes && (
                      <Text style={{ color: '#fff', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                        ✓ Seleccionado
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>
                    {busquedaMes ? 'No se encontraron meses' : 'No hay meses disponibles'}
                  </Text>
                }
              />
            </View>
          </View>
        </Modal>

        {Object.keys(agrupados).length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>
            No hay contenido disponible
          </Text>
        ) : (
          Object.keys(agrupados).map((semana) => (
            <View key={semana} style={styles.seccion}>
              <Text style={styles.separador}>{semana}</Text>
              {agrupados[semana].map((video) => {
                const hasPreview = !!video.video_url || !!video.informe_url || !!(video as any).pdf_url;
                return (
                  <View key={String(video.id)} style={styles.card}>
                    {renderPreviews(video)}

                    {/* --- descripción: ahora en cuadrito centrado --- */}
                    <View style={styles.descripcionContainer}>
                      <Text style={styles.descripcionTitulo}>Descripción</Text>
                                          
                      <Text style={styles.descripcionTitulo}>{video.descripcion || 'Sin descripción'}</Text>
                    </View>

                    <Text style={styles.fecha}>
                      Subido:{' '}
                      {format(new Date(video.creado_en ?? video.fecha ?? Date.now()), 'dd MMM yyyy', {
                        locale: es,
                      })}
                    </Text>

                    {tipoStr === 'analisis' && (
                      <View style={{ marginTop: 6 }}>
                        <Text style={{ color: '#999', marginBottom: 6 }}>
                          Partido asociado:{' '}
                          {video.partido_id
                            ? partidosDisponibles.find((p) => p.id === video.partido_id)?.descripcion ??
                              'Partido'
                            : 'Sin partido'}
                        </Text>
                        {video.informe_url && (
                          <Text style={{ color: '#999', marginBottom: 6 }}>Informe: disponible</Text>
                        )}
                      </View>
                    )}

                    <View style={styles.botonesContainer}>
                      {/* No mostramos botones "Ver" ni "Ver informe" porque las previews son clickables.
                          Mantenemos Editar/Borrar con la estética solicitada. */}

                      {tipoStr === 'analisis' ? (
                        canUploadAnalisis && (
                          <TouchableOpacity
                            style={[styles.botonEditar]}
                            onPress={() => abrirEditarAnalisis(video)}
                          >
                            <Text style={styles.textoAccionBlanco}>✏️ Editar</Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        canUploadOtros && (
                          <TouchableOpacity
                            style={[styles.botonEditar]}
                            onPress={() => goToEditarVideo(video.id)}
                          >
                            <Text style={styles.textoAccionBlanco}>✏️ Editar</Text>
                          </TouchableOpacity>
                        )
                      )}

                      {tipoStr === 'analisis' ? (
                        canUploadAnalisis && (
                          <TouchableOpacity
                            style={[styles.botonBorrar]}
                            onPress={() => confirmarEliminar(video)}
                          >
                            <Text style={styles.textoAccionBlanco}>🗑️ Borrar</Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        canUploadOtros && (
                          <TouchableOpacity
                            style={[styles.botonBorrar]}
                            onPress={() => confirmarEliminar(video)}
                          >
                            <Text style={styles.textoAccionBlanco}>🗑️ Borrar</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

    </View>
  );
};

export default ContenidoPorCategoria;

// estilos actualizados para estética unificada
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Platform.OS === 'web' ? 24 : 16,
    paddingBottom: Platform.OS === 'web' ? 100 : 36,
    backgroundColor: 'transparent',
    width: Platform.OS === 'web' ? '100%' : '100%',
    maxWidth: Platform.OS === 'web' ? '100%' : '100%',
    alignSelf: 'stretch',
  },
  // título igual que en InformesJugador
  titulo: {
    fontSize: Platform.OS === 'web' ? 24 : 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    color: '#fff',
  },
  botonSubir: {
    backgroundColor: '#00AA00',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    flexShrink: 1,
  },
  botonSubirNube: {
    backgroundColor: '#d32f2f',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    flexShrink: 1,
  },
  textoBoton: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Platform.OS === 'web' ? 14 : 14,
  },
  filtrarBtn: {
    backgroundColor: '#fff',
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  filtrarText: {
    color: '#000',
    fontWeight: '600',
    fontSize: Platform.OS === 'web' ? 13 : 13,
  },
  seccion: {
    marginBottom: 24,
  },
  separador: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    fontWeight: '600',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#333',
    paddingBottom: 6,
    color: '#fff',
  },
  card: {
    backgroundColor: '#1F1F1F',
    padding: Platform.OS === 'web' ? 14 : 16,
    borderRadius: 16,
    marginBottom: 12,
    width: Platform.OS === 'web' ? '90%' : '100%',
    maxWidth: Platform.OS === 'web' ? 900 : '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  // descripción: ahora dentro de un cuadrito centrado
  descripcionContainer: {
    backgroundColor: '#2B2B2B',
    borderRadius: 14,
    padding: Platform.OS === 'web' ? 16 : 12,
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: '100%',
  },
  descripcionTitulo: {
    fontSize: Platform.OS === 'web' ? 15 : 14,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    flexWrap: 'wrap',
    maxWidth: '100%',
  },

  fecha: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    color: '#AAA',
    marginVertical: 6,
  },
  botonesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },

  // botones edit / delete actualizados (coinciden con estilo general)
  botonEditar: {
    backgroundColor: '#00AA00',
    paddingVertical: Platform.OS === 'web' ? 8 : 6,
    paddingHorizontal: Platform.OS === 'web' ? 14 : 12,
    borderRadius: 12,
    marginLeft: 8,
    marginTop: 4,
  },
  botonBorrar: {
    backgroundColor: '#d32f2f',
    paddingVertical: Platform.OS === 'web' ? 8 : 6,
    paddingHorizontal: Platform.OS === 'web' ? 14 : 12,
    borderRadius: 12,
    marginLeft: 8,
    marginTop: 4,
  },
  textoAccionBlanco: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: '700',
    color: '#fff',
  },

  // previews
  previewsRow: {
    flexDirection: 'row',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-start',
    gap: 14,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  previewTouchable: {
    width: previewWidth,
    height: previewHeight,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  previewTouchableSingle: {
    width: Platform.OS === 'web' ? '100%' : previewWidth * 2 + 14,
    maxWidth: Platform.OS === 'web' ? 600 : previewWidth * 2 + 14,
    height: previewHeight,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignSelf: 'center',
  },
  previewHover: Platform.select({
    web: {
      transform: [{ scale: 1.02 }],
      shadowColor: '#FFF',
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    default: {},
  }),
  previewLabel: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12,
    color: '#AAA',
    fontWeight: '500', // ajuste para homogeneizar con InformesJugador
  },
  filtroInfoContainer: {
    backgroundColor: '#1F1F1F',
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  filtroInfoText: {
    color: '#00AA00',
    fontSize: 14,
    fontWeight: '600',
  },
  mesOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#1F1F1F',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mesOptionSelected: {
    backgroundColor: '#2B2B2B',
    borderColor: '#00AA00',
  },
  mesOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  mesOptionTextSelected: {
    color: '#00AA00',
    fontWeight: '700',
  },
  mesCantidadBadge: {
    backgroundColor: '#00AA00',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  mesCantidadText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
