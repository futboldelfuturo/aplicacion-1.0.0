# 🚀 Guía Completa: Desplegar Web desde Cero

## ⚠️ IMPORTANTE: Antes de empezar

**Cierra completamente:**
- El explorador de archivos de Windows si tienes la carpeta `dist` abierta
- Cualquier editor (VS Code, etc.) que tenga archivos de `dist` abiertos
- Cualquier terminal que esté en la carpeta `dist`

---

## 📋 PASO 1: Limpiar y Preparar

Ejecuta estos comandos **uno por uno** en PowerShell:

```powershell
# 1. Ir a la carpeta del proyecto
cd "C:\Users\juanp\futbol-del-futuro - copia (2) - copia"

# 2. Eliminar carpeta dist bloqueada (si existe)
# Si da error, cierra el explorador y vuelve a intentar
Remove-Item -Path dist -Recurse -Force -ErrorAction SilentlyContinue

# 3. Verificar que se eliminó
if (Test-Path dist) {
    Write-Host "⚠️ La carpeta dist aún existe. Cierra el explorador y vuelve a intentar." -ForegroundColor Yellow
} else {
    Write-Host "✅ Carpeta dist eliminada correctamente" -ForegroundColor Green
}
```

---

## 📦 PASO 2: Generar Build Web

```powershell
# Generar el build de producción
npm run build:web
```

**Esto tomará 1-2 minutos.** Deberías ver al final:
```
Exported: dist
```

---

## 🌐 PASO 3: Desplegar a Netlify

### Opción A: Desde la raíz del proyecto (Recomendado)

```powershell
# Asegúrate de estar en la raíz del proyecto
cd "C:\Users\juanp\futbol-del-futuro - copia (2) - copia"

# Desplegar (NO entres a la carpeta dist)
netlify deploy --prod --dir=dist
```

### Opción B: Si ya tienes el proyecto vinculado en Netlify

```powershell
# Verificar que estás vinculado
netlify status

# Desplegar
netlify deploy --prod --dir=dist
```

---

## ✅ PASO 4: Verificar Despliegue

Después del deploy, Netlify te dará:
- **URL de producción**: `https://FutbolDelFuturo.netlify.app`
- **URL de admin**: `https://app.netlify.com/projects/FutbolDelFuturo`

Abre la URL de producción en tu navegador para verificar que funciona.

---

## 🔧 Si algo falla

### Error: "dist está bloqueado"
1. Cierra el explorador de archivos
2. Cierra VS Code o cualquier editor
3. Ejecuta: `Remove-Item -Path dist -Recurse -Force`
4. Vuelve a intentar `npm run build:web`

### Error: "No se puede desplegar"
1. Verifica que estás en la raíz del proyecto (no dentro de `dist`)
2. Verifica que la carpeta `dist` existe y tiene archivos
3. Ejecuta: `netlify deploy --prod --dir=dist`

### Error: "netlify no encontrado"
```powershell
npm install -g netlify-cli
```

---

## 📝 Resumen de Comandos

```powershell
# 1. Ir al proyecto
cd "C:\Users\juanp\futbol-del-futuro - copia (2) - copia"

# 2. Limpiar
Remove-Item -Path dist -Recurse -Force -ErrorAction SilentlyContinue

# 3. Build
npm run build:web

# 4. Deploy
netlify deploy --prod --dir=dist
```

---

## 🎯 Tu Sitio Web

Una vez desplegado, tu aplicación estará disponible en:
**https://FutbolDelFuturo.netlify.app**

---

¡Sigue estos pasos y tu web estará en línea! 🚀

