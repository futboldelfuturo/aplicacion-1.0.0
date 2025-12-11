import React, { useState, useEffect } from 'react';
import { View, Alert, Platform, ScrollView, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Button, TextInput, ActivityIndicator, Text, ProgressBar } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../utils/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { subirVideoAYoutube } from '../../utils/youtubeUpload';
import HeaderLogo from '../../components/HeaderLogo';
import { Feather } from '@expo/vector-icons';

type SubirAnalisisParams = {
  SubirAnalisis: {
    equipoId: string;
    categoriaId: string;
  };
};

type FileOrAsset = DocumentPicker.DocumentPickerAsset | File;

type PartidoItem = {
  id: string | null;
  descripcion: string | null;
  creado_en?: string | null;
  video_url?: string | null;
};

const generarNombreArchivo = (extension: string) => {
  const randomString = Math.random().toString(36).substring(2, 10);
  return `${Date.now()}_${randomString}.${extension}`;
};

export default function SubirAnalisis() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<SubirAnalisisParams, 'SubirAnalisis'>>();

  const { equipoId = '', categoriaId = '' } = route.params || {};

  const [videoFile, setVideoFile] = useState<FileOrAsset | null>(null);
  const [pdfFile, setPdfFile] = useState<FileOrAsset | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [destino, setDestino] = useState<'supabase' | 'youtube'>('youtube');
  const [canalAsignado, setCanalAsignado] = useState<string | null>(null);
  const [privacidad, setPrivacidad] = useState<'private' | 'unlisted'>('unlisted');
  const [partidosDisponibles, setPartidosDisponibles] = useState<PartidoItem[]>([]);
  const [selectedPartido, setSelectedPartido] = useState<PartidoItem | null>(null);
  const [filtroPartidos, setFiltroPartidos] = useState('');
  const [mostrarSelectorPartidos, setMostrarSelectorPartidos] = useState(false);

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

  // Cargar partidos disponibles
  useEffect(() => {
    const fetchPartidos = async () => {
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
    fetchPartidos();
  }, [equipoId, categoriaId]);

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

      const analista_id = authData.user.id;

      let video_url: string;
      let video_path: string | null = null;
      let youtube_video_id: string | null = null;
      let es_youtube = false;
      let informe_url: string | null = null;
      let informe_path: string | null = null;

      if (destino === 'youtube') {
        if (!equipoId) {
          throw new Error('Debes seleccionar un equipo para subir videos a YouTube.');
        }
        
        if (!canalAsignado) {
          throw new Error('El equipo seleccionado no tiene un canal de YouTube asignado. Contacta al administrador.');
        }

        const titulo = descripcion.trim() || `Análisis de partido - ${new Date().toLocaleDateString()}`;
        
        const result = await subirVideoAYoutube(
          videoFile,
          titulo,
          descripcion.trim() || '',
          privacidad,
          equipoId, // Pasar equipoId
          (progress) => setProgreso(progress)
        );

        youtube_video_id = result.videoId;
        video_url = result.videoUrl;
        es_youtube = true;
        
        // Guardar inmediatamente después de recibir videoId (sin esperar procesamiento completo)
        setProgreso(90);
        
        // Subir PDF si existe
        let pdf_url_final = '';
        if (pdfFile) {
          const pdfData = await subirArchivo(pdfFile, 'informes', 'analisis');
          pdf_url_final = pdfData.url;
        }
        
        const partido_id = selectedPartido?.id ?? null;
        const insertObj: any = {
          partido_id: partido_id || null,
          analista_id,
          video_url,
          descripcion: descripcion.trim() || null,
          categoria_id: categoriaId || null,
          equipo_id: equipoId || null,
          pdf_url: pdf_url_final,
          fecha: new Date().toISOString(),
        };
        
        const { error: insertError } = await supabase.from('analisispartidos').insert([insertObj]);
        if (insertError) throw insertError;
        
        setProgreso(100);
        if (Platform.OS === 'web') {
          window.alert('✅ Análisis subido correctamente.\n\nEl video está siendo procesado por YouTube y aparecerá en la aplicación.');
          navigation.goBack();
          return;
        } else {
          Alert.alert('Éxito', 'Análisis subido correctamente.\n\nEl video está siendo procesado por YouTube y aparecerá en la aplicación.');
          navigation.goBack();
          return;
        }
      } else {
        const carpeta = 'analisis';
        setProgreso(10);
        const result = await subirArchivo(videoFile, 'videos1', carpeta);
        video_url = result.url;
        video_path = result.path;
        setProgreso(60);
      }

      if (pdfFile) {
        const pdfData = await subirArchivo(pdfFile, 'informes', 'analisis');
        informe_url = pdfData.url;
        informe_path = pdfData.path;
      }
      setProgreso(90);

      const partido_id = selectedPartido?.id ?? null;
      
      // Construir objeto de inserción - NO incluir campos de YouTube que no existen en la tabla
      // analista_id ya está definido al inicio de la función (línea 190)
      const insertObj: any = {
        partido_id: partido_id || null,
        analista_id, // Ya obtenido al inicio de la función
        video_url, // Este campo siempre existe y contiene la URL (ya sea Supabase o YouTube)
        descripcion: descripcion.trim() || null,
        categoria_id: categoriaId || null,
        equipo_id: equipoId || null,
        fecha: new Date().toISOString(),
      };

      // Agregar pdf_url siempre (la tabla requiere NOT NULL, usar string vacío si no hay PDF)
      insertObj.pdf_url = informe_url || '';

      // Solo agregar video_path si existe (Supabase)
      if (video_path) {
        insertObj.video_path = video_path;
      }

      // NO agregar youtube_video_id ni es_youtube - estos campos no existen en analisispartidos
      // El video_url ya contiene la URL de YouTube si se subió allí

      const { error: insertError } = await supabase.from('analisispartidos').insert([insertObj]);

      if (insertError) throw insertError;

      setProgreso(100);
      if (Platform.OS === 'web') {
        window.alert('✅ Análisis subido correctamente.');
        navigation.goBack();
      } else {
        Alert.alert('Éxito', 'Análisis subido correctamente.');
        navigation.goBack();
      }
    } catch (err: any) {
      console.error('Error en handleSubir:', err);
      const errorMessage = err?.message ?? 'Error desconocido al subir.';
      
      // Mensaje específico para límite de YouTube
      if (errorMessage.includes('límite de videos') || errorMessage.includes('uploadLimitExceeded')) {
        if (Platform.OS === 'web') {
          window.alert(`❌ Error de YouTube\n\n${errorMessage}\n\nIntenta subir el video directamente a Supabase en lugar de YouTube.`);
        } else {
          Alert.alert('Error de YouTube', `${errorMessage}\n\nIntenta subir el video directamente a Supabase en lugar de YouTube.`);
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(`❌ Error\n\n${errorMessage}`);
        } else {
          Alert.alert('Error', errorMessage);
        }
      }
    } finally {
      setLoading(false);
      setProgreso(0);
    }
  };

  const partidosFiltrados = partidosDisponibles.filter((p) =>
    (p.descripcion ?? '').toLowerCase().includes(filtroPartidos.trim().toLowerCase())
  );

  return (
    <ScrollView 
      {...(Platform.OS === 'web' ? { 'data-scrollview-web': true } : {})}
      style={{ flex: 1, backgroundColor: '#121212' }} 
      contentContainerStyle={{ padding: 20, paddingTop: 100, paddingBottom: Platform.OS === 'web' ? 100 : 40 }}
      scrollEnabled={true}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
    >
      <HeaderLogo />
      <Text style={{ 
        marginBottom: 24, 
        fontWeight: 'bold', 
        color: '#fff', 
        fontSize: 24,
        textAlign: 'center'
      }}>
        Subir nuevo análisis
      </Text>

      <TextInput
        label="Descripción"
        value={descripcion}
        onChangeText={setDescripcion}
        style={{ marginBottom: 20, backgroundColor: Platform.OS === 'web' ? '#fff' : '#1F1F1F' }}
        mode="outlined"
        multiline
        numberOfLines={4}
        textColor={Platform.OS === 'web' ? '#000' : undefined}
        theme={{
          colors: {
            primary: "#00AA00",
            text: Platform.OS === 'web' ? "#000" : "#fff",
            placeholder: Platform.OS === 'web' ? "#666" : "#aaa",
            background: Platform.OS === 'web' ? "#fff" : "#1F1F1F",
          },
        }}
      />

      {/* Selector de partido */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ marginBottom: 12, color: '#fff', fontWeight: '600', fontSize: 16 }}>
          Partido asociado
        </Text>
        <Button
          mode="outlined"
          onPress={() => setMostrarSelectorPartidos(true)}
          style={{ 
            backgroundColor: selectedPartido ? '#1F3F1F' : '#1F1F1F',
            borderColor: selectedPartido ? '#00AA00' : '#666',
            borderWidth: 2,
            paddingVertical: 12
          }}
          labelStyle={{ 
            color: '#fff',
            fontWeight: '600',
            fontSize: 15
          }}
          icon={selectedPartido ? 'check-circle' : 'soccer'}
          disabled={loading}
        >
          {selectedPartido 
            ? (selectedPartido.id === null ? 'Sin partido asociado' : selectedPartido.descripcion || 'Partido seleccionado')
            : 'Seleccionar partido'}
        </Button>
      </View>

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
            Subiendo análisis...
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
          Subir análisis
        </Button>
      )}

      {/* Modal para seleccionar partido */}
      <Modal
        visible={mostrarSelectorPartidos}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMostrarSelectorPartidos(false)}
      >
        <View style={modalStyles.modalContainer}>
          <View style={modalStyles.modalContent}>
            <TouchableOpacity
              style={modalStyles.closeButton}
              onPress={() => setMostrarSelectorPartidos(false)}
            >
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={modalStyles.modalTitle}>Seleccionar Partido</Text>
            <TextInput
              label="Buscar partido"
              value={filtroPartidos}
              onChangeText={setFiltroPartidos}
              mode="outlined"
              style={[modalStyles.searchBar, Platform.OS === 'web' && { backgroundColor: '#fff' }]}
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
              data={partidosFiltrados}
              keyExtractor={(item, index) => item.id || `null-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    modalStyles.partidoItem,
                    selectedPartido?.id === item.id && modalStyles.selectedPartidoItem,
                  ]}
                  onPress={() => {
                    setSelectedPartido(item);
                    setMostrarSelectorPartidos(false);
                    setFiltroPartidos('');
                  }}
                >
                  <Text style={[
                    modalStyles.partidoText,
                    selectedPartido?.id === item.id && modalStyles.selectedPartidoText,
                  ]}>
                    {item.id === null ? 'Sin partido asociado' : (item.descripcion ?? 'Sin descripción')}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={modalStyles.emptyText}>No hay partidos disponibles.</Text>
              }
            />
            {selectedPartido && (
              <Button
                mode="outlined"
                onPress={() => {
                  setSelectedPartido(null);
                  setMostrarSelectorPartidos(false);
                  setFiltroPartidos('');
                }}
                style={modalStyles.clearSelectionButton}
              >
                Quitar asociación
              </Button>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const modalStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
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
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  searchBar: {
    marginBottom: 15,
    backgroundColor: '#1F1F1F',
    borderRadius: 5,
  },
  partidoItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  selectedPartidoItem: {
    backgroundColor: '#00AA00',
    borderRadius: 5,
  },
  partidoText: {
    color: '#fff',
    fontSize: 16,
  },
  selectedPartidoText: {
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 20,
  },
  clearSelectionButton: {
    marginTop: 20,
    backgroundColor: '#FF6347',
  },
});

