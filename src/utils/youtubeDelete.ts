import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

/**
 * Obtiene un access_token válido para el canal del usuario
 */
async function obtenerAccessToken(usuarioId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('No hay sesión activa');
  }

  if (!SUPABASE_URL) {
    throw new Error('URL de Supabase no configurada');
  }

  const functionUrl = `${SUPABASE_URL}/functions/v1/youtube-token`;
  console.log('[YouTube Delete] Llamando a Edge Function:', functionUrl);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ usuarioId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[YouTube Delete] Error de Edge Function:', errorText);
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
    console.error('[YouTube Delete] Error al llamar Edge Function:', error);
    if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      throw new Error('Error de conexión con el servidor. Verifica tu conexión a internet.');
    }
    throw error;
  }
}

/**
 * Elimina un video de YouTube
 */
export async function eliminarVideoYouTube(youtubeVideoId: string): Promise<void> {
  // 1. Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  // 2. Obtener access_token
  let accessToken: string;
  try {
    accessToken = await obtenerAccessToken(user.id);
    console.log('[YouTube Delete] Token obtenido exitosamente');
  } catch (error: any) {
    console.error('[YouTube Delete] Error al obtener token:', error);
    throw new Error(`Error al obtener token: ${error.message || 'Error desconocido'}`);
  }

  // 3. Eliminar video de YouTube
  try {
    const deleteResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${youtubeVideoId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('[YouTube Delete] Error de respuesta:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      throw new Error(errorData.error?.message || `Error HTTP ${deleteResponse.status}: ${deleteResponse.statusText}`);
    }

    console.log('[YouTube Delete] Video eliminado exitosamente:', youtubeVideoId);
  } catch (error: any) {
    console.error('[YouTube Delete] Error al eliminar video:', error);
    throw new Error(`Error al eliminar video: ${error.message || 'Error desconocido'}`);
  }
}




