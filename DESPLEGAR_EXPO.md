# 🚀 Desplegar con Expo - Guía Paso a Paso

Tu proyecto ya está vinculado a Expo: `@juesloba/futbol-del-futuro`

---

## 🌐 PASO 1: DESPLEGAR WEB CON EXPO

### Opción A: Usar EAS Update (Recomendado)

```bash
# 1. Generar build web
npm run build:web

# 2. Desplegar a Expo
eas update --branch production --platform web
```

Esto subirá tu web a Expo y obtendrás una URL como:
`https://futbol-del-futuro.web.app` o similar

### Opción B: Usar Expo Hosting

Si prefieres usar Expo Hosting directamente:

```bash
# 1. Generar build
npm run build:web

# 2. Subir a Expo Hosting
npx expo publish:web
```

---

## 📱 PASO 2: DESPLEGAR MÓVIL CON EAS BUILD

### Android

```bash
# Crear build de producción para Android
eas build --platform android --profile production
```

**Proceso:**
1. EAS creará el build en la nube (~15-20 minutos)
2. Recibirás un enlace para descargar el APK/AAB
3. Descarga el archivo y súbelo a Google Play Console

**Para descargar después:**
```bash
# Ver tus builds
eas build:list

# Descargar un build específico
eas build:download [BUILD_ID]
```

### iOS

```bash
# Crear build de producción para iOS
eas build --platform ios --profile production
```

**Proceso:**
1. Si es la primera vez, EAS te guiará para configurar certificados
2. Necesitarás tu Apple Developer Account ($99/año)
3. El build tomará ~20-30 minutos
4. Descarga el IPA y súbelo a App Store Connect

---

## 🔄 ACTUALIZACIONES FUTURAS (OTA)

Una vez desplegado, puedes actualizar sin rebuild:

### Actualizar Web y Móvil

```bash
# Actualizar todo
eas update --branch production --platform all
```

### Solo Web

```bash
npm run build:web
eas update --branch production --platform web
```

### Solo Móvil

```bash
eas update --branch production --platform android
# o
eas update --branch production --platform ios
```

**Nota:** Las actualizaciones OTA solo funcionan para cambios en JavaScript. Si cambias código nativo, necesitas un nuevo build.

---

## 📋 COMANDOS RÁPIDOS

```bash
# Build web
npm run build:web

# Desplegar web
eas update --branch production --platform web

# Build Android
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production

# Actualizar todo
eas update --branch production --platform all

# Ver builds
eas build:list

# Ver actualizaciones
eas update:list
```

---

## ✅ CHECKLIST

### Web
- [x] Build generado (`dist/`)
- [ ] Desplegado con `eas update --branch production --platform web`
- [ ] URL verificada

### Android
- [ ] Build creado con EAS
- [ ] APK/AAB descargado
- [ ] Subido a Google Play (opcional)

### iOS
- [ ] Build creado con EAS
- [ ] Certificados configurados
- [ ] IPA descargado
- [ ] Subido a App Store (opcional)

---

## 🎯 EMPEZAR AHORA

### 1. Desplegar Web (2 minutos)

```bash
eas update --branch production --platform web
```

### 2. Build Android (15-20 minutos)

```bash
eas build --platform android --profile production
```

### 3. Build iOS (20-30 minutos, si aplica)

```bash
eas build --platform ios --profile production
```

---

## 📞 Información del Proyecto

- **Proyecto Expo**: `@juesloba/futbol-del-futuro`
- **ID**: `2902ff9f-e609-4523-9b2c-a804be250bab`
- **Usuario**: juesloba

Puedes ver tu proyecto en: https://expo.dev/accounts/juesloba/projects/futbol-del-futuro

---

¡Listo para desplegar! 🚀

