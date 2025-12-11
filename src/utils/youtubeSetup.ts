import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!;
const REDIRECT_URI = AuthSession.makeRedirectUri();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

/**
 * Obtiene refresh token para un canal de YouTube
 * Este proceso debe hacerse una vez por cada canal que quieras usar
 */
export async function obtenerRefreshTokenParaCanal() {
  try {
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ],
      responseType: AuthSession.ResponseType.Code,
      redirectUri: REDIRECT_URI,
      usePKCE: true,
    });

    const result = await request.promptAsync(discovery);

    if (result.type === 'success') {
      // Intercambiar código por tokens
      // ⚠️ NOTA: En producción, esto debería hacerse en un backend
      // Por ahora, esto funciona pero expone el client_secret
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: result.params.code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET || '', // ⚠️ Solo para desarrollo
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Error al obtener tokens');
      }

      const tokenData = await response.json();
      
      // Obtener información del canal
      const channelResponse = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        }
      );

      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0];

      if (!channel) {
        throw new Error('No se pudo obtener información del canal');
      }

      // Verificar si el canal ya existe
      const { data: canalExistente } = await supabase
        .from('youtube_canales')
        .select('id')
        .eq('channel_id', channel.id)
        .maybeSingle();

      if (canalExistente) {
        throw new Error('Este canal ya está registrado en la aplicación');
      }

      // Guardar en Supabase
      const { error } = await supabase.from('youtube_canales').insert({
        channel_id: channel.id,
        nombre_canal: channel.snippet?.title || 'Canal sin nombre',
        refresh_token: tokenData.refresh_token,
        access_token: tokenData.access_token,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        activo: true, // Activar por defecto
      });

      if (error) throw error;

      return {
        refresh_token: tokenData.refresh_token,
        channel_id: channel.id,
        channel_name: channel.snippet?.title,
      };
    }

    throw new Error('Autenticación cancelada');
  } catch (error: any) {
    console.error('Error en obtenerRefreshTokenParaCanal:', error);
    throw error;
  }
}

