// src/screens/entrenador/InformesJugador.tsx
import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  Linking,
  Image,
  Animated,
  Modal,
  FlatList,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { supabase } from '@/utils/supabase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import VideoPreview from '@/components/VideoPreview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppContext } from '@/context/AppContext';
import HeaderLogo from '@/components/HeaderLogo';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;
const previewHeight = Platform.OS === 'web' ? 140 : 180;
// En web, usar un ancho más pequeño y centrado
const previewWidth = Platform.OS === 'web' 
  ? Math.min(280, (screenWidth - 120) / 2.5) 
  : Math.min(540, (screenWidth - 32 - 50) / 2);

type RouteProps = RouteProp<RootStackParamList, 'InformesJugador'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'InformesJugador'>;

interface AnalisisJugador {
  id: string;
  descripcion?: string | null;
  video_url?: string | null;
  informe_url?: string | null;
  fecha?: string | null;
  creado_en?: string | null;
}

interface Agrupado {
  [semana: string]: AnalisisJugador[];
}

interface MesDisponible {
  mes: string;
  nombre: string;
  cantidad: number;
}

const InformesJugador: React.FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { equipoId, categoriaId, jugadorId, jugadorNombre } = route.params;
  const { rolActual } = useAppContext();

  const [agrupados, setAgrupados] = useState<Agrupado>({});
  const [analisisOriginales, setAnalisisOriginales] = useState<AnalisisJugador[]>([]);
  const [analisisFiltrados, setAnalisisFiltrados] = useState<AnalisisJugador[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mesSeleccionado, setMesSeleccionado] = useState<string | null>(null);
  const [mesesDisponibles, setMesesDisponibles] = useState<MesDisponible[]>([]);
  const [modalMesVisible, setModalMesVisible] = useState(false);
  const [busquedaMes, setBusquedaMes] = useState('');
  const [jugadorInfo, setJugadorInfo] = useState<{
    foto_url?: string | null;
    posicion?: string | null;
    equipo_nombre?: string | null;
    ano_nacimiento?: number | null;
    club?: string | null;
  } | null>(null);

  const esAnalista = String(rolActual || '').toLowerCase() === 'analista';
  const AnimatedTouchable = useRef(Animated.createAnimatedComponent(TouchableOpacity)).current;

  // Calcular meses disponibles
  const calcularMesesDisponibles = (lista: AnalisisJugador[]) => {
    const mesesMap: { [key: string]: number } = {};
    
    lista.forEach((item) => {
      const fechaStr = item.fecha ?? item.creado_en ?? new Date().toISOString();
      const fecha = new Date(fechaStr);
      if (!isNaN(fecha.getTime())) {
        const mesKey = format(fecha, 'yyyy-MM');
        mesesMap[mesKey] = (mesesMap[mesKey] || 0) + 1;
      }
    });

    const ahora = new Date();
    const meses: MesDisponible[] = [];
    
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

  // Cargar filtro guardado
  const cargarFiltroGuardado = async (): Promise<string | null> => {
    try {
      const key = `filtro_mes_futpro_${equipoId}_${jugadorId}`;
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
      const key = `filtro_mes_futpro_${equipoId}_${jugadorId}`;
      if (mes) {
        await AsyncStorage.setItem(key, mes);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Error guardando filtro:', e);
    }
  };

  // Aplicar filtro por mes
  const aplicarFiltroMes = (lista: AnalisisJugador[], mes: string | null) => {
    let filtrados = [...lista];

    if (mes && mes !== 'todos') {
      const [year, month] = mes.split('-').map(Number);
      const inicio = startOfMonth(new Date(year, month - 1));
      const fin = endOfMonth(new Date(year, month - 1));
      
      filtrados = filtrados.filter((item) => {
        const fechaStr = item.fecha ?? item.creado_en ?? '';
        if (!fechaStr) return false;
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) return false;
        return isWithinInterval(fecha, { start: inicio, end: fin });
      });
    }

    setAnalisisFiltrados(filtrados);
    agruparPorSemana(filtrados);
  };

  // Cargar información del jugador
  const fetchJugadorInfo = async () => {
    try {
      const { data: jugador, error } = await supabase
        .from('jugadores')
        .select('foto_url, posicion, equipo_id, ano_nacimiento, club')
        .eq('id', jugadorId)
        .maybeSingle();

      if (error) throw error;

      let equipoNombre = null;
      if (jugador?.equipo_id) {
        const { data: equipoData } = await supabase
          .from('teams')
          .select('nombre')
          .eq('id', jugador.equipo_id)
          .maybeSingle();
        equipoNombre = equipoData?.nombre || null;
      }

      setJugadorInfo({
        foto_url: jugador?.foto_url || null,
        posicion: jugador?.posicion || null,
        equipo_nombre: equipoNombre,
        ano_nacimiento: jugador?.ano_nacimiento || null,
        club: jugador?.club || null,
      });
    } catch (err) {
      console.error('Error al cargar información del jugador:', err);
    }
  };

  // --- FETCH ---
  const fetchAnalisis = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('analisisjugadores')
        .select('*')
        .eq('jugador_id', jugadorId)
        .eq('equipo_id', equipoId);
      
      // Solo filtrar por categoria_id si está presente y no está vacío
      if (categoriaId && categoriaId.trim() !== '') {
        query = query.eq('categoria_id', categoriaId);
      }
      
      const { data, error } = await query.order('fecha', { ascending: false });

      if (error) throw error;
      
      const analisis = (data || []).map((a: any) => ({
        id: a.id,
        descripcion: a.descripcion,
        video_url: a.video_url,
        informe_url: a.informe_url,
        fecha: a.fecha ?? a.created_at,
        creado_en: a.fecha ?? a.created_at,
      }));

      setAnalisisOriginales(analisis);
      calcularMesesDisponibles(analisis);
      const filtroGuardado = await cargarFiltroGuardado();
      aplicarFiltroMes(analisis, filtroGuardado || mesSeleccionado);
    } catch (err) {
      console.error('Error al cargar informes:', err);
      Alert.alert('Error', 'No se pudieron cargar los informes del jugador');
    } finally {
      setLoading(false);
    }
  };

  const agruparPorSemana = (lista: AnalisisJugador[]) => {
    const resultado: Agrupado = {};
    lista.forEach((item) => {
      const fechaStr = item.fecha ?? item.creado_en ?? new Date().toISOString();
      const fecha = isNaN(new Date(fechaStr).getTime()) ? new Date() : new Date(fechaStr);
      const inicio = startOfWeek(fecha, { weekStartsOn: 1 });
      const fin = endOfWeek(fecha, { weekStartsOn: 1 });
      const clave = `Semana del ${format(inicio, 'dd MMM', { locale: es })} al ${format(
        fin,
        'dd MMM',
        { locale: es }
      )}`;
      if (!resultado[clave]) resultado[clave] = [];
      resultado[clave].push(item);
    });
    setAgrupados(resultado);
  };

  useFocusEffect(
    useCallback(() => {
      fetchJugadorInfo();
      fetchAnalisis();
    }, [jugadorId, equipoId])
  );

  // --- VISTAS ---
  const verVideo = (item: AnalisisJugador) => {
    if (!item.video_url) return Alert.alert('No hay video disponible');
    
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

  const verPdf = (item: AnalisisJugador) => {
    const url = item.informe_url;
    if (!url) return Alert.alert('No hay informe disponible');
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir el PDF'));
    }
  };

  const confirmarEliminar = (item: AnalisisJugador) => {
    if (!item.id) {
      Alert.alert('Error', 'ID no disponible para eliminar.');
      return;
    }
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar informe? Esta acción no se puede deshacer.')) {
        eliminarRegistro(item);
      }
    } else {
      Alert.alert(
        '¿Eliminar informe?',
        'Esta acción no se puede deshacer.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => eliminarRegistro(item) },
        ],
        { cancelable: true }
      );
    }
  };

  const eliminarRegistro = async (item: AnalisisJugador) => {
    try {
      if (!item.id) {
        Alert.alert('Error', 'ID no disponible para eliminar.');
        return;
      }
      const { error } = await supabase.from('analisisjugadores').delete().eq('id', item.id);
      if (error) throw error;
      Alert.alert('Éxito', 'Informe eliminado correctamente.');
      fetchAnalisis();
    } catch (err: any) {
      console.error('Error eliminando:', err);
      Alert.alert('Error', 'No se pudo eliminar.');
    }
  };

  const handleSubirInforme = () => {
    navigation.navigate('SubirVideo', {
      tipo: 'futpro',
      equipoId,
      categoriaId,
      jugadorId,
    });
  };

  const handleSubirDeNube = () => {
    if (!equipoId) {
      Alert.alert('Error', 'No hay equipo seleccionado.');
      return;
    }
    navigation.navigate('SubirDeNube', { 
      equipoId, 
      categoriaId: categoriaId || '', 
      tipo: 'futpro' as any,
      jugadorId,
    });
  };

  const handleEditarAnalisis = (item: AnalisisJugador) => {
    if (!item.id) {
      Alert.alert('Error', 'ID del análisis no disponible.');
      return;
    }
    navigation.navigate('EditarAnalisisJugador', { analisisId: String(item.id) });
  };

  const renderPreviews = (item: AnalisisJugador) => {
    const hasVideo = !!item.video_url;
    const hasPdf = !!item.informe_url;

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
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
        {/* Información del jugador */}
        <View style={styles.jugadorInfoContainer}>
          <View style={styles.jugadorInfoContent}>
            {jugadorInfo?.foto_url ? (
              <Image source={{ uri: jugadorInfo.foto_url }} style={styles.jugadorFoto} />
            ) : (
              <View style={styles.jugadorFotoPlaceholder}>
                <Feather name="user" size={40} color="#666" />
              </View>
            )}
            <View style={styles.jugadorInfoText}>
              <Text style={styles.jugadorNombre}>{jugadorNombre}</Text>
              <View style={styles.jugadorInfoDetails}>
                {jugadorInfo?.posicion && (
                  <View style={styles.jugadorInfoDetailItem}>
                    <Feather name="target" size={14} color="#aaa" />
                    <Text style={styles.jugadorInfoDetailText}>{jugadorInfo.posicion}</Text>
                  </View>
                )}
                {jugadorInfo?.ano_nacimiento && (
                  <View style={styles.jugadorInfoDetailItem}>
                    <Feather name="calendar" size={14} color="#aaa" />
                    <Text style={styles.jugadorInfoDetailText}>{jugadorInfo.ano_nacimiento}</Text>
                  </View>
                )}
                {jugadorInfo?.club && (
                  <View style={styles.jugadorInfoDetailItem}>
                    <Feather name="map-pin" size={14} color="#aaa" />
                    <Text style={styles.jugadorInfoDetailText}>{jugadorInfo.club}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={styles.titulo}>Informes</Text>
          {mesSeleccionado && (
            <View style={styles.filtroInfoContainer}>
              <Text style={styles.filtroInfoText}>
                {mesSeleccionado === 'todos' 
                  ? `Todos los informes (${analisisOriginales.length})`
                  : mesesDisponibles.find(m => m.mes === mesSeleccionado) 
                    ? `${mesesDisponibles.find(m => m.mes === mesSeleccionado)?.nombre} (${analisisFiltrados.length} informes)`
                    : `Mes seleccionado (${analisisFiltrados.length} informes)`
                }
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8, alignItems: 'center' }}>
          {/* Botón Subir - solo para analistas */}
          {esAnalista && (
            <TouchableOpacity style={[styles.botonSubir, { flex: 1 }]} onPress={handleSubirInforme}>
              <Text style={styles.textoBoton}>Subir</Text>
            </TouchableOpacity>
          )}

          {/* Botón +Youtube - solo para analistas */}
          {esAnalista && (
            <TouchableOpacity style={[styles.botonSubirNube, { flex: 1 }]} onPress={handleSubirDeNube}>
              <Text style={styles.textoBoton}>+Youtube</Text>
            </TouchableOpacity>
          )}

          {/* Botón Filtrar */}
          <TouchableOpacity 
            style={[styles.filtrarBtn, { flex: 1 }]} 
            onPress={() => setModalMesVisible(true)}
          >
            <Text style={styles.filtrarText}>
              {mesSeleccionado === 'todos' 
                ? `Todos (${analisisOriginales.length})` 
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
                  { mes: 'todos', nombre: 'Todos', cantidad: analisisOriginales.length },
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
                      aplicarFiltroMes(analisisOriginales, item.mes);
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
                        {item.cantidad} {item.cantidad === 1 ? 'informe' : 'informes'}
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
            No hay informes disponibles para este jugador.
          </Text>
        ) : (
          Object.keys(agrupados).map((semana) => (
            <View key={semana} style={styles.seccion}>
              <Text style={styles.separador}>{semana}</Text>
              {agrupados[semana].map((item) => (
                <View key={item.id} style={styles.card}>
                  {renderPreviews(item)}

                  {/* Descripción */}
                  <View style={styles.descripcionContainer}>
                    <Text style={styles.descripcionTitulo}>Descripción</Text>
                    <Text style={styles.descripcionTitulo}>{item.descripcion || 'Sin descripción'}</Text>
                  </View>

                  {/* Fecha */}
                  <Text style={styles.fecha}>
                    Subido:{' '}
                    {format(new Date(item.fecha ?? item.creado_en ?? Date.now()), 'dd MMM yyyy', {
                      locale: es,
                    })}
                  </Text>

                  {/* Botones de acción - solo para analistas */}
                  {esAnalista && (
                    <View style={styles.botonesContainer}>
                      <TouchableOpacity
                        style={[styles.botonEditar]}
                        onPress={() => handleEditarAnalisis(item)}
                      >
                        <Text style={styles.textoAccionBlanco}>✏️ Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.botonBorrar]}
                        onPress={() => confirmarEliminar(item)}
                      >
                        <Text style={styles.textoAccionBlanco}>🗑️ Borrar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default InformesJugador;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Platform.OS === 'web' ? 24 : 16,
    paddingBottom: Platform.OS === 'web' ? 100 : 36,
    backgroundColor: 'transparent',
    width: Platform.OS === 'web' ? '100%' : '100%',
    maxWidth: Platform.OS === 'web' ? '100%' : '100%',
    alignSelf: 'stretch',
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#121212' 
  },
  loadingText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '500' 
  },
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
    fontWeight: '500',
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
  jugadorInfoContainer: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  jugadorInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  jugadorFoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
  },
  jugadorFotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jugadorInfoText: {
    flex: 1,
  },
  jugadorNombre: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  jugadorInfoDetails: {
    gap: 8,
  },
  jugadorInfoDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jugadorInfoDetailText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '500',
  },
  botonEditar: {
    backgroundColor: '#00AA00',
    paddingVertical: Platform.OS === 'web' ? 8 : 6,
    paddingHorizontal: Platform.OS === 'web' ? 14 : 12,
    borderRadius: 12,
    marginLeft: 8,
    marginTop: 4,
  },
});
