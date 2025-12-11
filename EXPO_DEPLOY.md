# 🚀 Desplegar con Expo (Web + Móvil)

Esta guía te ayudará a desplegar tu aplicación usando **Expo** para web y móvil.

---

## 📋 Requisitos Previos

- ✅ Cuenta en [expo.dev](https://expo.dev) (ya tienes: juesloba)
- ✅ EAS CLI instalado (ya instalado)
- ✅ Proyecto vinculado a Expo

---

## 🌐 DESPLEGAR WEB CON EXPO

### Opción 1: Expo Hosting (Recomendado)

Expo Hosting es la forma más fácil de desplegar tu web con Expo.

#### Paso 1: Configurar el proyecto

```bash
# Asegúrate de estar logueado
eas login

# Vincular el proyecto (si no está vinculado)
eas project:init
```

#### Paso 2: Exportar la web

```bash
npm run build:web
```

Esto genera la carpeta `dist/` con todos los archivos estáticos.

#### Paso 3: Desplegar a Expo Hosting

```bash
# Instalar Expo CLI (si no lo tienes)
npm install -g expo-cli

# Desplegar
npx expo publish:web
```

O usar EAS Update:

```bash
# Desplegar actualización web
eas update --branch production --platform web
```

### Opción 2: EAS Update para Web

```bash
# Desplegar actualización a producción
eas update --branch production --platform web

# O desplegar a todos los canales
eas update --branch production --platform all
```

---

## 📱 DESPLEGAR MÓVIL CON EAS BUILD

### Android

#### Paso 1: Crear build de producción

```bash
eas build --platform android --profile production
```

#### Paso 2: Seguir el proceso

- El build se creará en los servidores de Expo
- Recibirás un enlace para descargar el APK/AAB
- El proceso toma ~15-20 minutos

#### Paso 3: Descargar y distribuir

```bash
# Ver tus builds
eas build:list

# Descargar build específico
eas build:download [BUILD_ID]
```

### iOS

#### Paso 1: Crear build de producción

```bash
eas build --platform ios --profile production
```

#### Paso 2: Configurar certificados (primera vez)

Si es la primera vez, EAS te guiará para:
- Crear certificados de distribución
- Configurar provisioning profiles
- Necesitarás tu Apple Developer Account

#### Paso 3: Descargar y subir a App Store

```bash
# Ver tus builds
eas build:list

# Descargar build
eas build:download [BUILD_ID]
```

---

## 🔄 ACTUALIZACIONES OTA (Over The Air)

Una vez que tengas la app instalada, puedes actualizarla sin pasar por las tiendas:

### Para Web

```bash
npm run build:web
eas update --branch production --platform web
```

### Para Móvil

```bash
eas update --branch production --platform all
```

Los usuarios recibirán la actualización automáticamente la próxima vez que abran la app.

---

## 📊 Comandos Útiles

```bash
# Ver información del proyecto
eas project:info

# Ver builds en progreso
eas build:list

# Ver actualizaciones
eas update:list

# Ver canales/branches
eas channel:list

# Crear un nuevo canal
eas channel:create production

# Ver logs de un build
eas build:view [BUILD_ID]
```

---

## 🎯 Workflow Completo

### Primera vez (Build inicial)

1. **Web**:
   ```bash
   npm run build:web
   # Sube dist/ a Expo Hosting o usa EAS Update
   ```

2. **Android**:
   ```bash
   eas build --platform android --profile production
   # Descarga el APK/AAB y súbelo a Google Play
   ```

3. **iOS**:
   ```bash
   eas build --platform ios --profile production
   # Descarga el IPA y súbelo a App Store
   ```

### Actualizaciones posteriores (OTA)

```bash
# Actualizar código (sin rebuild)
eas update --branch production --platform all

# O solo web
eas update --branch production --platform web
```

**Nota**: Las actualizaciones OTA solo funcionan para cambios en JavaScript. Si cambias código nativo, necesitas un nuevo build.

---

## 🔧 Configuración de Canales

Puedes tener diferentes canales para diferentes entornos:

```bash
# Canal de producción
eas update --branch production --platform all

# Canal de desarrollo
eas update --branch development --platform all

# Canal de staging
eas update --branch staging --platform all
```

---

## 📝 Variables de Entorno

Las variables de entorno se configuran automáticamente desde tu archivo `.env` durante el build.

Para verificar qué variables están disponibles:

```bash
eas secret:list
```

Para agregar secrets:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "tu-valor"
```

---

## ✅ Checklist

### Web
- [ ] Build generado (`npm run build:web`)
- [ ] Desplegado a Expo Hosting o EAS Update
- [ ] URL de producción verificada

### Android
- [ ] Build creado (`eas build --platform android`)
- [ ] APK/AAB descargado
- [ ] Subido a Google Play (opcional)

### iOS
- [ ] Build creado (`eas build --platform ios`)
- [ ] Certificados configurados
- [ ] IPA descargado
- [ ] Subido a App Store (opcional)

---

## 🚀 Comandos Rápidos

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
```

---

## 📞 Soporte

- [Documentación de EAS](https://docs.expo.dev/build/introduction/)
- [Documentación de EAS Update](https://docs.expo.dev/eas-update/introduction/)
- [Expo Forums](https://forums.expo.dev/)

---

¡Listo para desplegar con Expo! 🎉

