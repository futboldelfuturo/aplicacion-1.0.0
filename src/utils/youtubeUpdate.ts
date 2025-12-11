import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

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

  if (!equipoId) {
    throw new Error('equipoId es requerido');
  }

  const functionUrl = `${SUPABASE_URL}/functions/v1/youtube-token`;
  console.log('[YouTube Update] Llamando a Edge Function:', functionUrl);

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
      console.error('[YouTube Update] Error de Edge Function:', errorText);
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
    console.error('[YouTube Update] Error al llamar Edge Function:', error);
    if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      throw new Error('Error de conexión con el servidor. Verifica tu conexión a internet.');
    }
    throw error;
  }
}

/**
 * Actualiza los metadatos de un video de YouTube
 */
export async function actualizarVideoYouTube(
  youtubeVideoId: string,
  titulo: string,
  descripcion: string,
  privacidad: 'private' | 'unlisted' | 'public',
  madeForKids: boolean = false,
  equipoId: string
): Promise<void> {
  
  if (!equipoId) {
    throw new Error('equipoId es requerido');
  }

  // 1. Obtener access_token
  const accessToken = await obtenerAccessToken(equipoId);

  // 3. Primero obtener el video actual para preservar campos que no queremos cambiar
  let videoActual: any = null;
  try {
    const getResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${youtubeVideoId}&part=snippet,status`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (getResponse.ok) {
      const getData = await getResponse.json();
      videoActual = getData.items?.[0];
    }
  } catch (err) {
    console.warn('[YouTube Update] No se pudo obtener video actual, continuando con actualización básica');
  }

  // 4. Preparar datos de actualización (preservar campos existentes si están disponibles)
  const updateData: any = {
    id: youtubeVideoId,
    snippet: {
      title: titulo,
      description: descripcion || '',
      tags: videoActual?.snippet?.tags || ['futbol', 'entrenamiento'],
      categoryId: videoActual?.snippet?.categoryId || '17', // Preservar categoría existente o usar Deportes
      defaultLanguage: videoActual?.snippet?.defaultLanguage || 'es',
      defaultAudioLanguage: videoActual?.snippet?.defaultAudioLanguage || 'es',
    },
    status: {
      privacyStatus: privacidad,
      selfDeclaredMadeForKids: madeForKids,
      embeddable: videoActual?.status?.embeddable !== undefined ? videoActual.status.embeddable : true,
      license: videoActual?.status?.license || 'youtube',
    },
  };

  console.log('[YouTube Update] Datos a actualizar:', JSON.stringify(updateData, null, 2));

  // 5. Actualizar video en YouTube
  try {
    const updateResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[YouTube Update] Error de respuesta:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      throw new Error(errorData.error?.message || `Error HTTP ${updateResponse.status}: ${updateResponse.statusText}`);
    }

    const videoData = await updateResponse.json();
    console.log('[YouTube Update] Video actualizado exitosamente:', videoData.id);
  } catch (error: any) {
    console.error('[YouTube Update] Error al actualizar video:', error);
    throw new Error(`Error al actualizar video: ${error.message || 'Error desconocido'}`);
  }
}

/**
 * Obtiene la información de un video de YouTube
 */
export async function obtenerInfoVideoYouTube(youtubeVideoId: string, equipoId: string): Promise<{
  title: string;
  description: string;
  privacyStatus: string;
  selfDeclaredMadeForKids: boolean;
}> {
  
  if (!equipoId) {
    throw new Error('equipoId es requerido');
  }

  // 1. Obtener access_token
  const accessToken = await obtenerAccessToken(equipoId);

  // 3. Obtener información del video
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${youtubeVideoId}&part=snippet,status`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      throw new Error(errorData.error?.message || `Error HTTP ${response.status}`);
    }

    const data = await response.json();
    const video = data.items?.[0];
    
    if (!video) {
      throw new Error('Video no encontrado en YouTube');
    }

    return {
      title: video.snippet?.title || '',
      description: video.snippet?.description || '',
      privacyStatus: video.status?.privacyStatus || 'public',
      selfDeclaredMadeForKids: video.status?.selfDeclaredMadeForKids || false,
    };
  } catch (error: any) {
    console.error('[YouTube Update] Error al obtener info del video:', error);
    throw new Error(`Error al obtener información del video: ${error.message || 'Error desconocido'}`);
  }
}

