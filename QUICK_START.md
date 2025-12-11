# 🚀 Inicio Rápido - Despliegue a Producción

## ⚡ Pasos Rápidos

### 1. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
EXPO_PUBLIC_GOOGLE_CLIENT_ID=tu_google_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=tu_google_client_secret
```

### 2. Desplegar Web

```bash
# Exportar la aplicación web
npm run build:web

# Los archivos estarán en la carpeta web-build/
# Súbelos a tu servidor (Netlify, Vercel, etc.)
```

### 3. Desplegar Móvil (Android/iOS)

```bash
# Instalar EAS CLI (si no lo tienes)
npm install -g eas-cli

# Iniciar sesión
eas login

# Configurar
eas build:configure

# Build Android
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production
```

### 4. Desplegar Edge Functions de Supabase

```bash
cd supabase/functions
supabase functions deploy delete-user
supabase functions deploy youtube-token
```

### 5. Configurar Secrets en Supabase

En Supabase Dashboard → Settings → Edge Functions → Secrets:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

---

## 📚 Documentación Completa

Para más detalles, consulta [DEPLOY.md](./DEPLOY.md)

---

## ✅ Checklist Pre-Producción

- [ ] Variables de entorno configuradas
- [ ] Edge Functions desplegadas
- [ ] Secrets configurados en Supabase
- [ ] Build de web generado y probado
- [ ] Build de móvil generado y probado
- [ ] Aplicación probada en producción

---

¡Listo para producción! 🎉

