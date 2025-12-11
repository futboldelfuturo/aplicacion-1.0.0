// IntroVideo.tsx
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Image, Platform } from 'react-native';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';

const { width } = Dimensions.get('window');
const VIDEO_RATIO = 0.5625; // 16:9
const VIDEO_WIDTH = width * 1.2; // 120% del ancho
const VIDEO_HEIGHT = VIDEO_WIDTH * VIDEO_RATIO;

interface IntroVideoProps {
  onFinish: () => void;
  muted?: boolean; // opcional, si quieres silenciar
}

const IntroVideo: React.FC<IntroVideoProps> = ({ onFinish, muted = false }) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const skipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasSkippedRef = useRef(false);

  const handlePlaybackStatus = (status: AVPlaybackStatus | any) => {
    if ('didJustFinish' in status && status.didJustFinish) {
      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
        skipTimeoutRef.current = null;
      }
      onFinish(); // cambia a la siguiente pantalla sin transición fea
    }
    
    // Detectar cuando el video está reproduciéndose
    if ('isPlaying' in status && status.isPlaying) {
      if (!isPlaying) {
        setIsPlaying(true);
        console.log('[IntroVideo] Video reproduciéndose correctamente');
        // Si se está reproduciendo, cancelar el timeout de salto
        if (skipTimeoutRef.current) {
          clearTimeout(skipTimeoutRef.current);
          skipTimeoutRef.current = null;
        }
      }
    }
  };

  useEffect(() => {
    // En web, configurar timeout para saltar el video si no se reproduce después de 3 segundos
    if (Platform.OS === 'web') {
      skipTimeoutRef.current = setTimeout(() => {
        if (!isPlaying && !hasSkippedRef.current) {
          console.log('[IntroVideo] Timeout en web (3s): video no se está reproduciendo, saltando automáticamente');
          hasSkippedRef.current = true;
          onFinish();
        }
      }, 3000);
    }

    return () => {
      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
        skipTimeoutRef.current = null;
      }
    };
  }, [isPlaying, onFinish]);

  useEffect(() => {
    // En web, intentar reproducir el video después de cargar
    if (Platform.OS === 'web' && videoRef.current) {
      const setupVideo = async () => {
        try {
          // Esperar a que el video esté listo
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Obtener el estado actual
          const status = await videoRef.current?.getStatusAsync();
          
          if (status && 'isLoaded' in status && status.isLoaded) {
            // Si no está reproduciéndose, intentar reproducir
            if (!status.isPlaying) {
              try {
                await videoRef.current?.playAsync();
                console.log('[IntroVideo] Video reproducido manualmente en web');
              } catch (playError) {
                console.warn('[IntroVideo] No se pudo reproducir automáticamente (política del navegador):', playError);
                // Si falla, el timeout se encargará de saltar el video
              }
            }
          }
        } catch (error) {
          console.error('[IntroVideo] Error al configurar video:', error);
        }
      };

      const timer = setTimeout(setupVideo, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={require('../../assets/intro.mp4')}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={true} // Reproducir automáticamente
        isMuted={false} // Con sonido
        isLooping={false}
        useNativeControls={false}
        onPlaybackStatusUpdate={handlePlaybackStatus}
        onLoadStart={() => {
          console.log('[IntroVideo] Video comenzando a cargar');
        }}
        onLoad={async () => {
          console.log('[IntroVideo] Video cargado completamente');
          // En web, intentar reproducir después de cargar
          if (Platform.OS === 'web' && videoRef.current) {
            try {
              await new Promise(resolve => setTimeout(resolve, 300));
              
              const status = await videoRef.current.getStatusAsync();
              
              if (status && 'isLoaded' in status && status.isLoaded) {
                if (!status.isPlaying) {
                  console.log('[IntroVideo] Intentando reproducir en web después de cargar');
                  try {
                    await videoRef.current.playAsync();
                  } catch (playError) {
                    console.warn('[IntroVideo] No se pudo reproducir automáticamente (política del navegador)');
                    // El timeout se encargará de saltar el video si no se reproduce
                  }
                }
              }
            } catch (error) {
              console.warn('[IntroVideo] Error al intentar reproducir:', error);
            }
          }
        }}
        onError={(error) => {
          console.error('[IntroVideo] Error en video:', error);
        }}
      />

      {/* Logo encima del video */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/Flogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black', // fondo negro para que el video negro se vea continuo
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // oculta bordes que sobresalen
    width: '100%',
    height: '100%',
  },
  video: {
    width: Platform.OS === 'web' ? '100%' : VIDEO_WIDTH,
    height: Platform.OS === 'web' ? '100%' : VIDEO_HEIGHT,
    maxWidth: Platform.OS === 'web' ? '100%' : undefined,
    maxHeight: Platform.OS === 'web' ? '100%' : undefined,
  },
  logoContainer: {
    position: 'absolute',
    top: 30, // ajusta según quieras el logo
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 80,
  },
});

export default IntroVideo;
