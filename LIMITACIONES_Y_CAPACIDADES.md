# Limitaciones y Capacidades de la Aplicación

## ✅ LO QUE SÍ SE PUEDE HACER (100% Funcional)

### Gestión de Usuarios
- ✅ **Crear usuarios**: Nombre, email, contraseña, roles, equipos, categorías, canal de YouTube
- ✅ **Editar usuarios**: Cambiar nombre, email, roles, equipos, categorías, canal de YouTube
- ✅ **Eliminar usuarios**: Se elimina de Auth y de la base de datos
- ✅ **Ver información del usuario**: Datos completos del usuario
- ✅ **Ver estadísticas**: Videos de entrenador y análisis del usuario
- ✅ **Filtrar usuarios**: Por rol, equipo, nombre, correo
- ✅ **Ver contraseña al crear**: Se muestra la contraseña asignada solo al momento de crear (se guarda temporalmente)

### Gestión de Contenido
- ✅ **Subir videos**: A Supabase o YouTube
- ✅ **Editar videos**: Descripción, asociaciones
- ✅ **Eliminar videos**: De Supabase y YouTube
- ✅ **Subir análisis**: Con video y PDF opcional
- ✅ **Editar análisis**: Descripción, partido asociado, PDF
- ✅ **Filtrar contenido**: Por mes, categoría, tipo

### Gestión de Equipos y Categorías
- ✅ **Crear/Editar/Eliminar equipos**
- ✅ **Crear/Editar/Eliminar categorías**
- ✅ **Asignar equipos y categorías a usuarios**

### Gestión de Canales YouTube
- ✅ **Crear canales YouTube**
- ✅ **Asignar canales a usuarios**
- ✅ **Subir videos a YouTube**
- ✅ **Eliminar videos de YouTube**

---

## ❌ LO QUE NO SE PUEDE HACER (Limitaciones Técnicas)

### Contraseñas
- ❌ **Ver contraseñas de usuarios existentes**: Las contraseñas en Supabase Auth están encriptadas (hasheadas) y no se pueden recuperar por seguridad. Esto es una práctica estándar de seguridad.
- ❌ **Recuperar contraseñas antiguas**: Una vez creada, la contraseña no se puede ver nunca más.
- ✅ **Solución**: 
  - Al crear un usuario, se muestra la contraseña temporalmente
  - Si un usuario olvida su contraseña, debe usar "Olvidé mi contraseña" en el login
  - O el administrador puede crear un nuevo usuario con nueva contraseña

### Actualización de Videos de YouTube
- ❌ **Editar metadatos de videos de YouTube desde la app**: YouTube API requiere permisos especiales que no están disponibles en el scope actual.
- ✅ **Solución**: Editar directamente en YouTube. La app solo permite editar la descripción local.

### Eliminación de Usuarios
- ⚠️ **Requiere Edge Function desplegada**: La eliminación completa (Auth + BD) requiere la Edge Function `delete-user` desplegada en Supabase.
- ✅ **Fallback**: Si la Edge Function falla, se intenta eliminar directamente de la base de datos.

---

## 🔧 CONFIGURACIÓN NECESARIA

### Edge Functions Requeridas
Para que todas las funcionalidades funcionen, necesitas desplegar estas Edge Functions en Supabase:

1. **`delete-user`**: Elimina usuarios de Auth y BD
   ```bash
   supabase functions deploy delete-user
   ```

2. **`update-user-password`**: Actualiza contraseñas (actualmente no se usa, pero está disponible)
   ```bash
   supabase functions deploy update-user-password
   ```

3. **`youtube-token`**: Obtiene tokens de YouTube (ya desplegada)

### Variables de Entorno
Las Edge Functions usan automáticamente:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Estas se configuran automáticamente en Supabase, no necesitas hacer nada.

---

## 📝 RECOMENDACIONES

1. **Contraseñas**: 
   - Guarda las contraseñas en un lugar seguro cuando creas usuarios
   - Usa contraseñas seguras y únicas
   - Considera usar un gestor de contraseñas

2. **Eliminación de Usuarios**:
   - Verifica que la Edge Function esté desplegada antes de eliminar
   - Si falla, verifica los logs en Supabase Dashboard

3. **Actualizaciones**:
   - La lista se actualiza automáticamente al volver a la pantalla
   - Si no ves cambios, recarga manualmente

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### Error al eliminar usuario
1. Verifica que la Edge Function `delete-user` esté desplegada
2. Revisa los logs en Supabase Dashboard > Edge Functions
3. Verifica que el `userId` sea correcto

### No se actualiza la lista
1. Navega a otra pantalla y vuelve
2. La lista se actualiza automáticamente con `useFocusEffect`
3. Si persiste, reinicia la app

### No puedo ver contraseñas
- Esto es normal y por seguridad
- Solo puedes ver la contraseña al momento de crear el usuario
- Para usuarios existentes, deben usar "Olvidé mi contraseña"



