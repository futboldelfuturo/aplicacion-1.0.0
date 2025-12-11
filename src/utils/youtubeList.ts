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
  console.log('[YouTube List] Llamando a Edge Function:', functionUrl);

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
      console.error('[YouTube List] Error de Edge Function:', errorText);
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
    console.error('[YouTube List] Error al llamar Edge Function:', error);
    if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      throw new Error('Error de conexión con el servidor. Verifica tu conexión a internet.');
    }
    throw error;
  }
}

/**
 * Obtiene el channel_id del equipo
 */
async function obtenerChannelId(equipoId: string): Promise<string> {
  const { data: team, error } = await supabase
    .from('teams')
    .select(`
      youtube_canal_id,
      youtube_canales:youtube_canal_id (
        channel_id
      )
    `)
    .eq('id', equipoId)
    .single();

  if (error || !team?.youtube_canal_id) {
    throw new Error('El equipo no tiene un canal de YouTube asignado');
  }

  const canal = team.youtube_canales as any;
  if (!canal?.channel_id) {
    throw new Error('No se pudo obtener el channel_id del canal');
  }

  return canal.channel_id;
}

export type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  privacyStatus: string;
  videoUrl: string;
  embedUrl: string;
};

/**
 * Lista videos del canal de YouTube del equipo
 */
export async function listarVideosYouTube(
  equipoId: string,
  maxResults: number = 50,
  pageToken?: string
): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string; prevPageToken?: string }> {
  if (!equipoId) {
    throw new Error('equipoId es requerido');
  }

  // 1. Obtener access_token
  const accessToken = await obtenerAccessToken(equipoId);

  // 2. Obtener channel_id
  const channelId = await obtenerChannelId(equipoId);

  // 3. Listar videos del canal usando la API de YouTube
  try {
    // Primero obtener los uploads del canal
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      throw new Error(errorData.error?.message || `Error HTTP ${channelResponse.status}`);
    }

    const channelData = await channelResponse.json();
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      throw new Error('No se pudo obtener la lista de videos del canal');
    }

    // Obtener videos de la playlist de uploads
    let videosUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}`;
    if (pageToken) {
      videosUrl += `&pageToken=${pageToken}`;
    }

    const videosResponse = await fetch(videosUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!videosResponse.ok) {
      const errorText = await videosResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      throw new Error(errorData.error?.message || `Error HTTP ${videosResponse.status}`);
    }

    const videosData = await videosResponse.json();
    
    // Mapear videos a nuestro formato
    const videos: YouTubeVideo[] = (videosData.items || []).map((item: any) => {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      return {
        id: videoId,
        title: item.snippet?.title || 'Sin título',
        description: item.snippet?.description || '',
        thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
        publishedAt: item.snippet?.publishedAt || '',
        privacyStatus: item.snippet?.privacyStatus || 'public',
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
      };
    });

    return {
      videos,
      nextPageToken: videosData.nextPageToken,
      prevPageToken: videosData.prevPageToken,
    };
  } catch (error: any) {
    console.error('[YouTube List] Error al listar videos:', error);
    throw new Error(`Error al listar videos: ${error.message || 'Error desconocido'}`);
  }
}


