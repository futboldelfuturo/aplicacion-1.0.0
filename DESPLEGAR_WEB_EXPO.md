# 🌐 Desplegar Web con Expo

**Importante:** EAS Update NO soporta web. Para web necesitas usar otro método.

---

## ✅ OPCIÓN 1: Expo Hosting (Recomendado - Si está disponible)

Expo Hosting es la forma más fácil de desplegar web con Expo.

### Paso 1: Generar build

```bash
npm run build:web
```

### Paso 2: Desplegar

```bash
# Opción A: Usar Expo CLI (si está disponible)
npx expo publish:web

# Opción B: Subir manualmente la carpeta dist/
# Ve a https://expo.dev y sube la carpeta dist/
```

---

## ✅ OPCIÓN 2: Usar Servicios de Hosting Externos

### Netlify (Gratis y Fácil)

1. **Generar build**:
   ```bash
   npm run build:web
   ```

2. **Instalar Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

3. **Desplegar**:
   ```bash
   cd dist
   netlify deploy --prod --dir=.
   ```

   O simplemente arrastra la carpeta `dist/` a: https://app.netlify.com/drop

### Vercel (Gratis y Fácil)

1. **Generar build**:
   ```bash
   npm run build:web
   ```

2. **Instalar Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

3. **Desplegar**:
   ```bash
   cd dist
   vercel --prod
   ```

### GitHub Pages

1. **Generar build**:
   ```bash
   npm run build:web
   ```

2. **Subir carpeta `dist/` a un repositorio de GitHub**

3. **Configurar GitHub Pages** en la configuración del repositorio

---

## 📱 DESPLEGAR MÓVIL CON EAS (Funciona perfectamente)

### Android

```bash
npm run build:android
```

O:
```bash
eas build --platform android --profile production
```

### iOS

```bash
npm run build:ios
```

O:
```bash
eas build --platform ios --profile production
```

### Actualizar Móvil (OTA)

```bash
eas update --branch production --platform android
# o
eas update --branch production --platform ios
# o ambos
eas update --branch production --platform all
```

---

## 🎯 Resumen

- **Web**: Usa Netlify, Vercel, o Expo Hosting (si disponible)
- **Móvil**: Usa EAS Build y EAS Update ✅

---

## 🚀 Comandos Actualizados

```bash
# Build web
npm run build:web

# Desplegar web (genera build y muestra instrucciones)
npm run deploy:web

# Build Android
npm run build:android

# Build iOS
npm run build:ios

# Actualizar móvil
eas update --branch production --platform all
```

---

¡Listo! 🎉

