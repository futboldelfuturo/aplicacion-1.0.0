import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

serve(async (req) => {
  try {
    const { equipoId } = await req.json();

    if (!equipoId) {
      return new Response(
        JSON.stringify({ error: "equipoId es requerido" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Obtener equipo y su canal asignado
    const { data: equipo, error: equipoError } = await supabase
      .from("teams")
      .select("youtube_canal_id")
      .eq("id", equipoId)
      .single();

    if (equipoError || !equipo?.youtube_canal_id) {
      return new Response(
        JSON.stringify({ error: "El equipo no tiene canal de YouTube asignado" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Obtener credenciales del canal
    const { data: canal, error: canalError } = await supabase
      .from("youtube_canales")
      .select("access_token, refresh_token, token_expires_at")
      .eq("id", equipo.youtube_canal_id)
      .single();

    if (canalError || !canal) {
      return new Response(
        JSON.stringify({ error: "Canal no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Verificar si el token está expirado y renovarlo si es necesario
    let accessToken = canal.access_token;
    const tokenExpiresAt = canal.token_expires_at ? new Date(canal.token_expires_at) : new Date(0);
    const now = new Date();

    if (!canal.access_token || tokenExpiresAt < now) {
      // Renovar token (solo si está expirado)
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: canal.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        return new Response(
          JSON.stringify({ error: "Error al renovar token: " + (errorData.error || "desconocido") }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in || 3600;

      // Actualizar en BD (solo el token, no el video)
      await supabase
        .from("youtube_canales")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        })
        .eq("id", equipo.youtube_canal_id);
    }

    // 4. Devolver SOLO el access_token (el cliente sube el video directamente)
    return new Response(
      JSON.stringify({
        access_token: accessToken,
        expires_in: 3600,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Error desconocido" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});



