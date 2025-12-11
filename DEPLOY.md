# 🚀 Guía de Despliegue a Producción

Esta guía te ayudará a desplegar la aplicación **Futbol del Futuro** a producción.

## 📋 Requisitos Previos

1. **Cuenta de Expo**: Regístrate en [expo.dev](https://expo.dev)
2. **Cuenta de Supabase**: Proyecto configurado con todas las tablas
3. **Google Cloud Console**: Proyecto con OAuth configurado para YouTube API
4. **Node.js**: Versión 18 o superior
5. **EAS CLI** (para builds nativos): `npm install -g eas-cli`

---

## 🔧 Paso 1: Configurar Variables de Entorno

### Opción A: Usar archivo .env (Recomendado)

1. Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. Completa las variables en `.env`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=tu_google_client_id.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=tu_google_client_secret
   ```

### Opción B: Usar app.json (Alternativa)

Las variables también pueden estar en `app.json` en la sección `extra`, pero es menos seguro para valores sensibles.

---

## 🌐 Paso 2: Desplegar Web (React Native Web)

### Opción A: Expo Hosting (Recomendado)

1. **Instalar EAS CLI** (si no lo tienes):
   ```bash
   npm install -g eas-cli
   ```

2. **Iniciar sesión en Expo**:
   ```bash
   eas login
   ```

3. **Configurar el proyecto**:
   ```bash
   eas build:configure
   ```

4. **Exportar y desplegar web**:
   ```bash
   npm run build:web
   ```

5. **Subir a Expo Hosting**:
   ```bash
   npx expo export:web
   eas update --branch production --platform web
   ```

### Opción B: Desplegar en tu propio servidor

1. **Exportar la aplicación**:
   ```bash
   npm run build:web
   ```

2. **Los archivos estarán en la carpeta `web-build/`**

3. **Sube la carpeta `web-build/` a tu servidor** (Netlify, Vercel, AWS S3, etc.)

   **Ejemplo para Netlify:**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=web-build
   ```

   **Ejemplo para Vercel:**
   ```bash
   npm install -g vercel
   vercel --prod web-build
   ```

---

## 📱 Paso 3: Desplegar Aplicación Móvil

### Android

1. **Configurar EAS Build**:
   ```bash
   eas build:configure
   ```

2. **Crear build de producción**:
   ```bash
   eas build --platform android --profile production
   ```

3. **Obtener el APK/AAB**:
   - El build estará disponible en [expo.dev](https://expo.dev)
   - Descarga el archivo y súbelo a Google Play Console

### iOS

1. **Configurar EAS Build**:
   ```bash
   eas build:configure
   ```

2. **Crear build de producción**:
   ```bash
   eas build --platform ios --profile production
   ```

3. **Obtener el IPA**:
   - El build estará disponible en [expo.dev](https://expo.dev)
   - Descarga el archivo y súbelo a App Store Connect

---

## 🔐 Paso 4: Configurar Supabase Edge Functions

Asegúrate de que todas las Edge Functions estén desplegadas:

```bash
# Desde la carpeta del proyecto
cd supabase/functions

# Desplegar delete-user
supabase functions deploy delete-user

# Desplegar update-user-password (opcional)
supabase functions deploy update-user-password

# Desplegar youtube-token
supabase functions deploy youtube-token
```

**Configurar variables de entorno en Supabase Dashboard:**
- Ve a tu proyecto en Supabase
- Settings → Edge Functions → Secrets
- Agrega:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

---

## ✅ Paso 5: Verificaciones Finales

Antes de lanzar a producción, verifica:

- [ ] Todas las variables de entorno están configuradas
- [ ] Las Edge Functions están desplegadas
- [ ] Los builds se generan correctamente
- [ ] La aplicación web carga sin errores
- [ ] La autenticación funciona
- [ ] Los videos se suben correctamente a YouTube
- [ ] No hay `console.log` exponiendo información sensible (ya corregido)

---

## 📝 Comandos Útiles

### Desarrollo
```bash
npm start              # Iniciar servidor de desarrollo
npm run web            # Iniciar solo web
npm run android        # Iniciar en Android
npm run ios            # Iniciar en iOS
```

### Producción
```bash
npm run build:web      # Exportar web para producción
eas build --platform android  # Build Android
eas build --platform ios      # Build iOS
```

### Actualizaciones OTA (Over The Air)
```bash
eas update --branch production --platform all
```

---

## 🐛 Solución de Problemas

### Error: Variables de entorno no encontradas
- Verifica que el archivo `.env` existe y tiene las variables correctas
- Reinicia el servidor de desarrollo después de cambiar `.env`

### Error: Build falla
- Verifica que todas las dependencias estén instaladas: `npm install`
- Limpia la caché: `expo start -c`

### Error: Edge Functions no funcionan
- Verifica que estén desplegadas: `supabase functions list`
- Revisa los logs en Supabase Dashboard

---

## 📞 Soporte

Si encuentras problemas durante el despliegue:
1. Revisa los logs en Expo Dashboard
2. Verifica la configuración de Supabase
3. Consulta la documentación de [Expo](https://docs.expo.dev) y [Supabase](https://supabase.com/docs)

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu aplicación estará en producción. 

**Recuerda:**
- Mantén las variables de entorno seguras
- No subas archivos `.env` al repositorio
- Haz backups regulares de la base de datos
- Monitorea los logs de producción regularmente

