import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // Verificar método
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método no permitido" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: "userId y newPassword son requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validar que la contraseña tenga al menos 6 caracteres
    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Crear cliente con Service Role Key para tener permisos de admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Actualizar contraseña usando Admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) {
      console.error("Error al actualizar contraseña:", error);
      return new Response(
        JSON.stringify({ 
          error: "Error al actualizar contraseña",
          details: error.message 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Contraseña actualizada correctamente" 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  } catch (error: any) {
    console.error("Error en update-user-password:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Error desconocido al actualizar contraseña" 
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
});



