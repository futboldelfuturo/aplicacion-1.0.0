import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar método
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método no permitido" }),
        { 
          status: 405, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { userId } = await req.json();

    if (!userId || typeof userId !== "string") {
      return new Response(
        JSON.stringify({ error: "userId es requerido y debe ser un string" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Crear cliente con Service Role Key para tener permisos de admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Configuración de Supabase faltante" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Primero eliminar de la tabla usuarios (para evitar problemas de foreign key)
    const { error: dbError } = await supabaseAdmin
      .from("usuarios")
      .delete()
      .eq("id", userId);

    if (dbError) {
      console.error("Error al eliminar de usuarios:", dbError);
      // Continuar aunque falle, puede que ya no exista
    }

    // 2. Eliminar usuario de Auth usando Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Error al eliminar de Auth:", authError);
      // Si falla Auth pero la BD se eliminó, consideramos éxito parcial
      if (!dbError) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: "Usuario eliminado de la base de datos. Error al eliminar de Auth (puede que ya no exista).",
            warning: authError.message
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      // Si ambos fallan, retornar error
      return new Response(
        JSON.stringify({ 
          error: "Error al eliminar usuario",
          details: authError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Usuario eliminado correctamente" 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: any) {
    console.error("Error en delete-user:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Error desconocido al eliminar usuario" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

