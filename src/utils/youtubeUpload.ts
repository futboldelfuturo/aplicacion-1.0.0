import { Platform } from 'react-native';
import { supabase } from './supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

type FileOrAsset = DocumentPicker.DocumentPickerAsset | File;

/**
 * Obtiene un access_token válido para el canal del equipo
 */
async function obtenerAccessToken(equipoId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('No hay sesión activa');
  }

  if (!SUPABASE_URL) {
    throw new Error('URL de Supabase no configurada');
  }

  const functionUrl = `${SUPABASE_URL}/functions/v1/youtube-token`;
  console.log('[YouTube Upload] Llamando a Edge Function:', functionUrl);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ equipoId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[YouTube Upload] Error de Edge Function:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      throw new Error(errorData.error || `Error HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('No se recibió el access_token de la Edge Function');
    }

    return data.access_token;
  } catch (error: any) {
    console.error('[YouTube Upload] Error al llamar Edge Function:', error);
    if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      throw new Error('Error de conexión con el servidor. Verifica tu conexión a internet.');
    }
    throw error;
  }
}

/**
 * Sube un video directamente a YouTube desde el cliente
 * El video NUNCA pasa por tu backend
 */
export async function subirVideoAYoutube(
  videoFile: FileOrAsset,
  titulo: string,
  descripcion: string,
  privacidad: 'private' | 'unlisted' = 'unlisted',
  equipoId: string,
  onProgress?: (progress: number) => void
): Promise<{ videoId: string; videoUrl: string; embedUrl: string }> {
  
  if (!equipoId) {
    throw new Error('equipoId es requerido para subir videos a YouTube');
  }

  // 1. Obtener access_token del backend usando el equipoId (solo token, sin video)
  onProgress?.(5);
  let accessToken: string;
  try {
    accessToken = await obtenerAccessToken(equipoId);
    console.log('[YouTube Upload] Token obtenido exitosamente');
  } catch (error: any) {
    console.error('[YouTube Upload] Error al obtener token:', error);
    throw new Error(`Error al obtener token: ${error.message || 'Error desconocido'}`);
  }
  onProgress?.(10);

  // 3. Preparar metadata del video
  const metadata = {
    snippet: {
      title: titulo,
      description: descripcion || '',
      tags: ['futbol', 'entrenamiento'],
      categoryId: '17', // Deportes
    },
    status: {
      privacyStatus: privacidad,
      selfDeclaredMadeForKids: false,
    },
  };

  // 4. Preparar el archivo de video según la plataforma
  let videoFileForUpload: any;
  let mimeType: string;
  
  try {
    if (Platform.OS === 'web') {
      const file = videoFile as File;
      videoFileForUpload = file;
      mimeType = file.type || 'video/mp4';
      console.log('[YouTube Upload] Archivo web, tamaño:', file.size);
    } else {
      // En móvil, usar el formato correcto para React Native FormData
      const asset = videoFile as DocumentPicker.DocumentPickerAsset;
      
      if (!asset.uri) {
        throw new Error('URI del archivo no disponible');
      }

      mimeType = asset.mimeType || 'video/mp4';
      
      // En React Native, FormData necesita el objeto con uri, type y name
      videoFileForUpload = {
        uri: asset.uri,
        type: mimeType,
        name: asset.name || `video_${Date.now()}.mp4`,
      };
      
      console.log('[YouTube Upload] Archivo móvil preparado:', {
        uri: asset.uri,
        type: mimeType,
        name: asset.name,
      });
    }
  } catch (error: any) {
    console.error('[YouTube Upload] Error al preparar el archivo:', error);
    throw new Error(`Error al preparar el video: ${error.message || 'Error desconocido'}`);
  }

  // 5. Preparar la subida según la plataforma
  console.log('[YouTube Upload] Metadata a enviar:', JSON.stringify(metadata, null, 2));
  console.log('[YouTube Upload] Privacidad seleccionada:', privacidad);
  
  // 6. Subir DIRECTAMENTE a YouTube (el video nunca pasa por tu backend)
  onProgress?.(20);
  
  try {
    console.log('[YouTube Upload] Iniciando subida a YouTube...');
    
    let uploadResponse: Response;
    let videoData: any;
    
    if (Platform.OS === 'web') {
      // En web, usar FormData estándar
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { 
        type: 'application/json' 
      }));
      formData.append('video', videoFileForUpload);
      
      uploadResponse = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[YouTube Upload] Error de respuesta:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }
        
        // Manejar error de límite de videos de YouTube
        const errorMessage = errorData.error?.message || `Error HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`;
        if (errorMessage.includes('uploadLimitExceeded') || errorMessage.includes('exceeded the number of videos')) {
          throw new Error('Has alcanzado el límite de videos que puedes subir a YouTube. Por favor, elimina algunos videos antiguos o contacta al administrador para aumentar el límite.');
        }
        
        throw new Error(errorMessage);
      }

      onProgress?.(90);
      videoData = await uploadResponse.json();
    } else {
      // En móvil, usar FormData nativo con formato correcto para React Native
      const asset = videoFile as DocumentPicker.DocumentPickerAsset;
      const metadataString = JSON.stringify(metadata);
      
      console.log('[YouTube Upload] Usando FormData nativo para subida móvil');
      
      // Crear archivo temporal para metadata usando expo-file-system
      const metadataPath = `${FileSystem.cacheDirectory}youtube_metadata_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(metadataPath, metadataString, {
        encoding: 'utf8',
      });
      
      try {
        const formData = new FormData();
        
        // Para metadata, usar el archivo temporal
        formData.append('metadata', {
          uri: metadataPath,
          type: 'application/json',
          name: 'metadata.json',
        } as any);
        
        // Para el video, usar el formato correcto de React Native
        formData.append('video', {
          uri: asset.uri,
          type: mimeType,
          name: asset.name || 'video.mp4',
        } as any);
        
        console.log('[YouTube Upload] FormData preparado, iniciando subida...');
        
        uploadResponse = await fetch(
          `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              // NO incluir Content-Type - React Native lo agrega automáticamente con el boundary correcto
            },
            body: formData as any,
          }
        );

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('[YouTube Upload] Error de respuesta:', errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }
          
          // Verificar si el error es por límite de videos excedido
          if (errorData.error?.reason === 'uploadLimitExceeded' || 
              errorData.error?.message?.includes('exceeded the number of videos')) {
            throw new Error('Has alcanzado el límite de videos permitidos en tu canal de YouTube. Por favor, elimina algunos videos antes de subir más o contacta al administrador.');
          }
          
          throw new Error(errorData.error?.message || `Error HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`);
        }

        onProgress?.(90);
        videoData = await uploadResponse.json();
      } finally {
        // Limpiar archivo temporal
        try {
          const fileInfo = await FileSystem.getInfoAsync(metadataPath);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(metadataPath, { idempotent: true });
          }
        } catch (e) {
          console.warn('[YouTube Upload] No se pudo eliminar archivo temporal:', e);
        }
      }
    }
    
    const videoId = videoData.id;

    if (!videoId) {
      throw new Error('No se recibió el ID del video de YouTube');
    }

    // Verificar que la privacidad se aplicó correctamente
    console.log('[YouTube Upload] Video subido exitosamente, ID:', videoId);
    console.log('[YouTube Upload] Privacidad solicitada:', privacidad);
    console.log('[YouTube Upload] Privacidad del video:', videoData.status?.privacyStatus);
    
    // Si la privacidad no coincide, hacer una actualización inmediata
    if (videoData.status?.privacyStatus !== privacidad) {
      console.warn('[YouTube Upload] La privacidad no coincide, actualizando...');
      try {
        const updateResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=status`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: videoId,
              status: {
                privacyStatus: privacidad,
                selfDeclaredMadeForKids: false,
              },
            }),
          }
        );
        
        if (updateResponse.ok) {
          console.log('[YouTube Upload] Privacidad corregida exitosamente');
        } else {
          console.warn('[YouTube Upload] No se pudo corregir la privacidad automáticamente');
        }
      } catch (updateError) {
        console.warn('[YouTube Upload] Error al corregir privacidad:', updateError);
      }
    }

    onProgress?.(100);

    return {
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    };
  } catch (error: any) {
    console.error('[YouTube Upload] Error al subir a YouTube:', error);
    // Si es un error de red, dar un mensaje más claro
    if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      throw new Error('Error de conexión. Verifica tu internet y que el video no sea muy grande. Si el problema persiste, intenta con un video más pequeño.');
    }
    throw new Error(`Error al subir video: ${error.message || 'Error desconocido'}`);
  }
}
