# 🌐 Cambiar URL de Netlify a "futbol-del-futuro"

## 📍 Estado Actual

- **Sitio actual**: `stately-otter-455b9c`
- **URL actual**: https://stately-otter-455b9c.netlify.app
- **Nueva URL deseada**: https://futbol-del-futuro.netlify.app

## ✅ Método Recomendado: Desde el Dashboard

### Pasos:

1. **Ve al Dashboard de Netlify**:
   - https://app.netlify.com/projects/stately-otter-455b9c

2. **Ve a Site settings**:
   - Haz clic en **Site settings** (en el menú lateral)

3. **Cambia el nombre**:
   - En la sección **General** → **Site details**
   - Haz clic en **Change site name**
   - Cambia a: `futbol-del-futuro`
   - Haz clic en **Save**

4. **Verifica**:
   - Tu nueva URL será: **https://futbol-del-futuro.netlify.app**

## 🔄 Alternativa: Crear nuevo sitio con el nombre correcto

Si prefieres empezar de cero:

```powershell
# Desvincular sitio actual
netlify unlink

# Crear nuevo sitio con el nombre deseado
netlify deploy --prod --dir=web-build --create-site futbol-del-futuro
```

## ⚠️ Nota Importante

- El nombre debe ser único en Netlify
- Solo puede contener letras minúsculas, números y guiones
- Si `futbol-del-futuro` ya está tomado, prueba variaciones como:
  - `futbol-del-futuro-app`
  - `futboldelfuturo`
  - `futbol-del-futuro-web`

---

## 🎯 Resultado Esperado

Después del cambio, tu aplicación estará en:
**https://futbol-del-futuro.netlify.app**

---

¡Sigue los pasos del Dashboard y tendrás tu URL personalizada! 🚀

