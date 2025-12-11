import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Linking, TouchableOpacity, Text, ActivityIndicator, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useRoute, useNavigation } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';

type VideoPlayerRouteProp = RouteProp<RootStackParamList, 'VideoPlayer'>;

export default function VideoPlayer() {
  const videoRef = useRef<Video>(null);
  const route = useRoute<VideoPlayerRouteProp>();
  const { videoUrl, titulo, descripcion } = route.params;
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  // Detectar si es YouTube (contiene youtube.com o youtube.com/watch)
  const esYoutube = videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be');
  const youtubeVideoId = esYoutube 
    ? videoUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1]
    : null;

  useEffect(() => {
    // En web, no usar ScreenOrientation ni presentFullscreenPlayer
    if (!esYoutube && Platform.OS !== 'web') {
      // Solo para videos de Supabase en móvil - mantener landscape
      const prepareVideo = async () => {
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          videoRef.current?.presentFullscreenPlayer();
        } catch (error) {
          console.warn('Error preparando video:', error);
        }
      };

      const cleanup = async () => {
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } catch (error) {
          console.warn('Error limpiando orientación:', error);
        }
      };

      prepareVideo();

      return () => {
        cleanup();
      };
    }
    // Para YouTube o web, no cambiar orientación - mantener portrait
  }, [esYoutube]);

  // Si es YouTube, mostrar solo botón para abrir
  if (esYoutube && youtubeVideoId) {
    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    const abrirYouTube = async () => {
      setLoading(true);
      try {
        // Intentar abrir en la app de YouTube si está instalada, sino en el navegador
        const canOpen = await Linking.canOpenURL(youtubeUrl);
        if (canOpen) {
          await Linking.openURL(youtubeUrl);
        } else {
          await WebBrowser.openBrowserAsync(youtubeUrl);
        }
      } catch (error) {
        console.error('Error al abrir YouTube:', error);
        // Fallback: abrir en navegador web
        await WebBrowser.openBrowserAsync(youtubeUrl);
      } finally {
        setLoading(false);
      }
    };

    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <View style={{ alignItems: 'center', marginBottom: 30 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
            {titulo}
          </Text>
          <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 30 }}>
            {descripcion}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.youtubeButton}
          onPress={abrirYouTube}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.youtubeButtonText}>Abrir en YouTube</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Si es video de Supabase, usar el reproductor normal
  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={styles.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={Platform.OS !== 'web'} // En web, no reproducir automáticamente para evitar bloqueos
        isMuted={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: Platform.OS === 'web' ? '100%' : Dimensions.get('window').width,
    height: Platform.OS === 'web' ? '100%' : Dimensions.get('window').width * 0.5625,
    maxWidth: Platform.OS === 'web' ? '100%' : undefined,
    maxHeight: Platform.OS === 'web' ? '100%' : undefined,
  },
  youtubeWebView: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  youtubeButtonContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 10,
  },
  youtubeButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  youtubeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
